"""Zone 0's model client: one call = a system prompt, the evidence, a JSON schema -> a parsed dict.

Claude Opus 5.5 by default (`RESEARCH_MODEL`, `RESEARCH_EFFORT` override it for benchmarks), adaptive
thinking (always on for this model), structured JSON output, streaming (long outputs never hit an
HTTP timeout), server-side refusal fallback. Every answer is cached on disk by a hash of the whole
request, so a rerun after a crash or a prompt change only pays for what changed. Token usage and
cost are counted per tag for the run report. No time limit: this runs offline.
"""

import hashlib
import json
import logging
import os
import threading
import time
from collections import defaultdict
from pathlib import Path

import anthropic

log = logging.getLogger("research")
MODEL = os.environ.get("RESEARCH_MODEL", "claude-opus-5-5")
EFFORT = os.environ.get("RESEARCH_EFFORT", "high")
MAX_TOKENS = 64000
CACHE = Path(__file__).resolve().parents[4] / "knowledge" / ".cache"
FALLBACK_BETA = "server-side-fallback-2026-07-01"
PRICE = {  # USD per million tokens: input, output, cache read, cache write
    "claude-opus-5-5": (4.00, 20.00, 0.20, 5.00),
    "claude-sonnet-5-5": (2.00, 10.00, 0.20, 2.50),
    "claude-haiku-5-5": (0.10, 0.50, 0.01, 0.125),
}
_CLIENT, _LOCK = None, threading.Lock()
USAGE = defaultdict(lambda: defaultdict(float))  # tag -> counters


class ModelError(RuntimeError):
    """The model refused, ran out of tokens or returned no valid JSON."""


def client():
    global _CLIENT
    with _LOCK:
        if _CLIENT is None:
            _CLIENT = anthropic.Anthropic(max_retries=4, timeout=900.0)
        return _CLIENT


def _key(model, effort, system, user, schema):
    raw = json.dumps([model, effort, system, user, schema], sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode()).hexdigest()


def _record(tag, model, usage, seconds):
    cost = PRICE.get(model, PRICE["claude-opus-5-5"])
    i, o = usage.input_tokens or 0, usage.output_tokens or 0
    cr, cw = getattr(usage, "cache_read_input_tokens", 0) or 0, getattr(usage, "cache_creation_input_tokens", 0) or 0
    usd = (i * cost[0] + o * cost[1] + cr * cost[2] + cw * cost[3]) / 1e6
    with _LOCK:
        u = USAGE[tag]
        u["calls"] += 1
        u["input_tokens"] += i
        u["output_tokens"] += o
        u["cache_read_tokens"] += cr
        u["usd"] += usd
        u["seconds"] += seconds
    return usd


def _stream(timeout=None, **kwargs):
    """One streamed request; with the server-side refusal fallback where the API accepts it.
    `timeout` (seconds): a hard limit for a call made while a clock runs (one retry only)."""
    c = client().with_options(timeout=timeout, max_retries=1) if timeout else client()
    try:
        with c.beta.messages.stream(**kwargs, betas=[FALLBACK_BETA], fallbacks="default") as stream:
            return stream.get_final_message()
    except anthropic.BadRequestError as e:
        if "fallback" not in str(e).lower():
            raise
        log.warning("refusal fallback not accepted (%s) - plain request", e)
    with c.messages.stream(**kwargs) as stream:
        return stream.get_final_message()


def ask(system, user, schema, tag="", effort=None, model=None, cache=True, timeout=None):
    """The model's answer as a dict that matches `schema` (JSON Schema, additionalProperties false).
    `timeout`: seconds for a call inside the final's wave (offline research has none)."""
    model, effort = model or MODEL, effort or EFFORT
    key = _key(model, effort, system, user, schema)
    path = CACHE / f"{key}.json"
    if cache and path.is_file():
        with _LOCK:
            USAGE[tag]["cached"] += 1
        return json.loads(path.read_text(encoding="utf-8"))["answer"]
    t0 = time.monotonic()
    message = _stream(
        timeout=timeout,
        model=model,
        max_tokens=MAX_TOKENS,
        system=system,
        messages=[{"role": "user", "content": user}],
        output_config={"effort": effort, "format": {"type": "json_schema", "schema": schema}},
    )
    seconds = time.monotonic() - t0
    usd = _record(tag, model, message.usage, seconds)
    if message.stop_reason == "refusal":
        raise ModelError(f"{tag}: refused ({getattr(message, 'stop_details', None)})")
    if message.stop_reason == "max_tokens":
        raise ModelError(f"{tag}: ran out of output tokens")
    text = next((b.text for b in message.content if b.type == "text"), "")
    try:
        answer = json.loads(text)
    except ValueError as e:
        raise ModelError(f"{tag}: no valid JSON ({e})") from e
    log.info(
        "%s: %.0fs, %d in / %d out tokens, $%.3f",
        tag,
        seconds,
        message.usage.input_tokens,
        message.usage.output_tokens,
        usd,
    )
    CACHE.mkdir(parents=True, exist_ok=True)
    meta = {"model": model, "effort": effort, "tag": tag, "seconds": round(seconds, 1), "usd": round(usd, 4)}
    path.write_text(json.dumps({"meta": meta, "answer": answer}, ensure_ascii=False, indent=1), encoding="utf-8")
    return answer


def usage_report():
    """{tag: counters} plus a total, for knowledge/index.json."""
    with _LOCK:
        out = {tag: {k: round(v, 4) for k, v in u.items()} for tag, u in USAGE.items()}
    total = defaultdict(float)
    for u in out.values():
        for k, v in u.items():
            total[k] += v
    out["total"] = {k: round(v, 4) for k, v in total.items()}
    return out
