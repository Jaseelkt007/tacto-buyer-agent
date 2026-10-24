"""Build web/src/data/demo/code.json for the /demo deck: a reading of the engine code.

    cd web && npm run sync:code

Verbatim strings (the LLM SYSTEM prompt, regexes, claim and e-mail f-strings) are pulled from the
source; every file/line it cites is checked against the text on that line, and the script stops on
a mismatch. The prose (summaries, issues) is written here by hand, so when the engine changes, a
failed check tells you which part to re-read and update. Read-only on the engine code."""

import ast
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # repo root
SK = "starter-kit/arena_kit"
POL = f"{SK}/agents/procudeal/policy.py"
ECO = f"{SK}/agents/procudeal/economics.py"
CLM = f"{SK}/agents/procudeal/claims.py"
DOS = f"{SK}/agents/procudeal/dossier.py"
SIG = f"{SK}/agents/procudeal/signals.py"
WRI = f"{SK}/agents/procudeal/writer.py"
INI = f"{SK}/agents/procudeal/__init__.py"
LLM = f"{SK}/agents/llm.py"
NAI = f"{SK}/agents/naive.py"
PLAY = f"{SK}/play.py"
CLI = f"{SK}/cli.py"
COST = f"{SK}/cost.py"
CLIENT = f"{SK}/client.py"
BENCH = "starter-kit/scripts/bench.py"

_cache = {}


def lines(f):
    if f not in _cache:
        _cache[f] = (ROOT / f).read_text().splitlines()
    return _cache[f]


def L(f, n, expect):
    """Line n of f must contain `expect` (guards every citation)."""
    if expect not in lines(f)[n - 1]:
        sys.exit(f"citation mismatch {f}:{n}: {expect!r} not in {lines(f)[n - 1]!r}")
    return n


def src(f, a, b=None):
    """Verbatim source lines a..b, joined, leading indentation stripped per line."""
    b = b or a
    return " ".join(x.strip() for x in lines(f)[a - 1 : b])


def module_const(f, name):
    tree = ast.parse((ROOT / f).read_text())
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == name for t in node.targets):
            return ast.literal_eval(node.value)
    raise KeyError(name)


def regex_src(f, n_from, n_to):
    """A re.compile(...) pattern, as the concatenated raw string literals."""
    tree = ast.parse((ROOT / f).read_text())
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and getattr(node.func, "attr", "") == "compile" and n_from <= node.lineno <= n_to:
            return ast.literal_eval(node.args[0])
    raise KeyError((f, n_from))


SYSTEM = module_const(LLM, "SYSTEM")
ASKS = module_const(SIG, "ASKS")
TRAITS = module_const(SIG, "TRAITS")
CASH = regex_src(DOS, 36, 40)
WORK = regex_src(DOS, 41, 41)
FULL = regex_src(DOS, 42, 44)

out = {
    "commit": "5cab21a",
    "engine": "v1.6c",
    "generated_from": "source of starter-kit/arena_kit at 5cab21a (worktree web-viz, code identical); docs not used as evidence",
}

# ---------------------------------------------------------------- stages
out["stages"] = [
    {
        "id": "runner_start",
        "name": "Runner start",
        "kind": "code",
        "when": "once per run",
        "file": CLI,
        "line": L(CLI, 32, "def agent_factory"),
        "function": "agent_factory",
        "summary": "Loads the data package once and builds the LLM closure `complete`, then hands out one fresh ProcuDealAgent per case.",
        "inputs": ["--agent procudeal", "--data / ARENA_DATA", "LLM_* env vars"],
        "outputs": ["factory: lambda: ProcuDealAgent(complete, package)"],
        "details": [
            "DataPackage(data) and package.lookup('') build the ID index once, shared by all cases (cli.py:41-42).",
            "complete = llm_from_env() runs for every non-naive agent, procudeal included (cli.py:43). It only builds a client; no model call here.",
            "llm_from_env reads os.environ['LLM_MODEL'] with no default (llm.py:56): if it is missing, the runner stops with a KeyError although the engine never calls the model.",
            "Each ProcuDealAgent builds an LLMAgent(complete, package) as its fallback (procudeal/__init__.py:27).",
        ],
    },
    {
        "id": "session_open",
        "name": "Open session, read quotes",
        "kind": "arena",
        "when": "once per case",
        "file": PLAY,
        "line": L(PLAY, 145, "table.open(case_id)"),
        "function": "play",
        "summary": "Opens the case on the arena; every supplier's quote e-mail arrives at once (round 0). Every attachment is downloaded and turned into text.",
        "inputs": ["case_id"],
        "outputs": ["case file", "threads {supplier_id: [quote e-mail]}", "attachment text (quote PDF)"],
        "details": [
            "From here the 60 s clock runs per thread (brief/api.md:75).",
            "fetch_documents adds att['text'] to each attachment (play.py:118-123); the quote PDF text is what standard_terms() parses.",
            "A 409 'one session per case in the final' resumes the running session instead (play.py:46-49).",
        ],
    },
    {
        "id": "loop_and_cap",
        "name": "Move loop, cap check, dispatch",
        "kind": "code",
        "when": "every move",
        "file": PLAY,
        "line": L(PLAY, 152, "while live_threads(threads)"),
        "function": "play",
        "summary": "While any thread is live, the runner asks ProcuDealAgent.decide for one decision; it creates the Negotiator on a case's first move and runs the engine inside try/except. Near a Live Final wave cap the runner uses closing_move instead.",
        "inputs": ["threads", "deadline (final only)"],
        "outputs": ["decision {supplier_id, message}"],
        "details": [
            "Cap check: time.time() > cap - max(CLOSE_BEFORE_CAP_S=90, slowest round + ROUND_MARGIN_S=15) (play.py:155).",
            "No deadline in `arena play`, `arena run --set practice` or bench.py: closing_move never fires there.",
            "A decision slower than 45 s (0.75 x MOVE_LIMIT_S) only logs a warning (play.py:160-161).",
            "One decision per loop pass: the loop is single-threaded per case, so in RFQ cases threads are served one at a time.",
            "ProcuDealAgent.decide (procudeal/__init__.py:31): new Negotiator when case_id changes; remember_prices() runs but its result is never read.",
            "Engine move with 'action' -> {'action': ...}; otherwise writer.offer_email builds the e-mail (__init__.py:38-45).",
            "Any engine exception -> kit LLMAgent.decide, trace source 'kit-llm' (__init__.py:47-49).",
        ],
    },
    {
        "id": "setup_economics",
        "name": "Setup: C_open, limit, ceilings",
        "kind": "code",
        "when": "once per case (first move)",
        "file": POL,
        "line": L(POL, 80, "def setup"),
        "function": "Negotiator.setup",
        "summary": "Prices every opening quote with the supplier's standard terms, takes the cheapest that keeps the must-haves as C_open, and sets the walk-away limit to min(C_alt, C_open).",
        "inputs": ["opening term sheets", "standard terms from quote PDFs", "buyer alternative"],
        "outputs": ["c_open", "limit", "per-side ceiling"],
        "details": [
            "First pass without supplier estimates (policy.py:85-86), then again with each side's estimate (policy.py:90-99).",
            "C_open stays infinite when no opening quote keeps the must-haves; the limit is then min(C_alt, inf).",
            "ceiling = price_ceiling(mix, limit): the highest unit price on our term mix with C < limit; None becomes 0.0 (policy.py:100-102).",
            "Runs inside the first move's 60 s window (observed ~0.02 s in runs/P18).",
        ],
    },
    {
        "id": "dossier_claims",
        "name": "Dossier and claim bank",
        "kind": "code",
        "when": "once per supplier per case",
        "file": DOS,
        "line": L(DOS, 76, "def build"),
        "function": "dossier.build / claims.build_bank",
        "summary": "Reads the supplier's owner type, documents and news from SQLite to estimate its cost of money and full cost, then builds every data claim the package supports, strongest first.",
        "inputs": ["supplier_id", "case parts", "data package (SQLite, facts)"],
        "outputs": ["Dossier (interest_rate, full_cost, cash_need, ...)", "claim bank"],
        "details": [
            "interest_rate = OWNER_RATE[owner_type] (group 0.05, private 0.07, family 0.075, founder 0.10; default 0.075), +0.05 if CASH_SIGNS match.",
            "full_cost: own-plant should_cost row, else generic row x COUNTRY_COST, else quote price x (1 - 0.10).",
            "wants_work and capacity_full are computed but never used by the policy.",
            "Claim bank: notice period, index falls, should-cost, scorecard, forecast; each claim kept only if every ref exists in the package or case facts (claims.py:42).",
            "A failing claim builder is logged and skipped (claims.py:38-39).",
        ],
    },
    {
        "id": "plan_anchor",
        "name": "Term mix, anchor, health price",
        "kind": "code",
        "when": "once per supplier per case",
        "file": POL,
        "line": L(POL, 105, "def new_side"),
        "function": "Negotiator.new_side",
        "summary": "Searches every allowed mix of non-price terms for the one that costs us least at equal value to the supplier, converts its quote to that mix, and sets the first offer (anchor) a fixed share below it.",
        "inputs": ["quote", "standard terms", "dossier estimate", "category_goal", "reply_delay_days"],
        "outputs": ["mix", "plan", "anchor", "best_for_us", "ceiling", "bank"],
        "details": [
            "plan_terms tries up to MAX_COMBOS=2000 term_options combinations (economics.py:106-138).",
            "anchor = quote-on-our-mix x (ANCHOR[goal] + shift); ANCHOR leverage 0.80, routine 0.84, quality_first 0.88, secure_supply 0.90, stabilise 0.92, else 0.85.",
            "shift -0.03 if reply delay >= 4 days or owner founder; +0.03 if owner group and delay <= 2 days.",
            "stabilise / secure_supply: anchor = max(anchor, best_for_us) where best_for_us minimises C incl. the relationship charge.",
            "price_increase cases: anchor = min(anchor, current_unit_price).",
        ],
    },
    {
        "id": "observe_reply",
        "name": "Read the supplier's reply",
        "kind": "code",
        "when": "on reply",
        "file": POL,
        "line": L(POL, 285, "def observe"),
        "function": "Negotiator.observe / react",
        "summary": "For each new supplier e-mail: regex-read asks and traits, cap the full-cost estimate by its price, convert its standing price to our term mix, and react (re-plan on a payment ask, drop index claims if hedged, adopt a cheaper alternative sheet it sent).",
        "inputs": ["new supplier messages"],
        "outputs": ["side.theirs (its price on our mix)", "side.asks", "side.last (traits)", "maybe new side.mix"],
        "details": [
            "Asks accumulate over the thread; traits are from the latest e-mail only.",
            "bound_full_cost: full_cost <= max(price x 0.995, error-band floor) (dossier.py:67-73).",
            "payment ask (once, if payment_days negotiable): interest_rate += 0.05 unless cash_need already set it, then replan (policy.py:306-310).",
            "A supplier alternative sheet that keeps must-haves and costs us > EUR 1 less than its standing sheet becomes our mix (policy.py:313-331).",
            "side.ceiling is not recomputed when the mix changes.",
        ],
    },
    {
        "id": "standing_check",
        "name": "Accept check, board, readiness",
        "kind": "code",
        "when": "every move",
        "file": POL,
        "line": L(POL, 162, "the best sheet any supplier stands on"),
        "function": "Negotiator.decide / eco.accept_check / Negotiator.ready",
        "summary": "Prices every live supplier's standing sheet. A sheet can be accepted only with a price, all must-haves kept, and C below min(C_alt, C_open). Each thread is then marked ready or not.",
        "inputs": ["standing sheets", "standard terms", "estimates", "c_open"],
        "outputs": ["best (C, sid, sheet_id, why)", "board / leader", "ready map"],
        "details": [
            "accept_check: C >= limit -> 'C x does not beat the limit y' (economics.py:53-55).",
            "ready: final_offer, or moves_left <= 1, or agreed (unless below the health band), or its price within 0.5 % of our last offer, or (relationship goals) at best_for_us.",
            "board: every live standing sheet with a price that keeps the must-haves (the limit is not applied); leader = lowest C.",
        ],
    },
    {
        "id": "rfq_auction",
        "name": "RFQ: drop rule and reverse auction",
        "kind": "code",
        "when": "every move, RFQ only (more than 1 live thread)",
        "file": POL,
        "line": L(POL, 225, "def rfq_close"),
        "function": "Negotiator.rfq_close / last_call_offer",
        "summary": "Once the leader is ready, the cheapest runner-up gets one 'last call' to beat the leader's C by 2 %. While each call improves the best C by at least 0.5 %, the new runner-up is called; then the best sheet is accepted. Bidders more than 10 % above the leader stop getting rounds.",
        "inputs": ["board", "ready map", "last_call state"],
        "outputs": ["last-call offer", "accept", "dropped flags"],
        "details": [
            "AUCTION_EDGE 0.02, AUCTION_MIN_GAIN 0.005, AUCTION_CALLS 4, DROP_GAP 0.10.",
            "A bidder at final_offer is never called; an agreed bidder can be.",
            "Drop rule needs at least 2 prices from the bidder (its quote + one reply).",
        ],
    },
    {
        "id": "close_or_walk",
        "name": "Close or walk",
        "kind": "code",
        "when": "every move",
        "file": POL,
        "line": L(POL, 206, "if best and (ready[best[1]]"),
        "function": "Negotiator.decide / accept / walk",
        "summary": "Accept the best passing sheet when its supplier is ready (or every thread is). Walk away when nothing passes and every thread is at final_offer or out of messages.",
        "inputs": ["best", "ready map", "statuses", "moves_left"],
        "outputs": ["accept {term_sheet_id}", "walk_away", "or continue to offer"],
        "details": [
            "Trace why for an accept: '<ready reason>; C x below the limit y' (policy.py:560-562).",
            "walk_away goes to live[0]; it ends the whole case.",
        ],
    },
    {
        "id": "offer_build",
        "name": "Next price, term sheets, claims",
        "kind": "code",
        "when": "every move that sends",
        "file": POL,
        "line": L(POL, 403, "def offer"),
        "function": "Negotiator.next_price / offer / pick_claims / answers",
        "summary": "Picks the thread that waited longest, computes the next price by closing a share of the gap, and builds up to 3 term sheets that cost us the same, plus claim and answer sentences.",
        "inputs": ["side state", "standing terms", "leader (RFQ)"],
        "outputs": ["sheets (1-3)", "claims", "answers", "why dict"],
        "details": [
            "Gap share: 0.30 per round, 0.10 after a deep (>= 6 %) drop, 0.45 when the supplier says it is stuck, 0 (its price) when its price is frozen.",
            "Price is capped at the ceiling and at 0.998 x its price on our mix; never below our last price except by those caps.",
            "Claims: 3 in the first e-mail, 2 after a data request, else 1; in RFQ the rival's offer is cited first.",
        ],
    },
    {
        "id": "writer",
        "name": "E-mail writer (template)",
        "kind": "template",
        "when": "every move that sends",
        "file": WRI,
        "line": L(WRI, 15, "def offer_email"),
        "function": "writer.offer_email",
        "summary": "Wraps the move in a fixed English e-mail: greeting, answers, claim sentences, a line about the packages, sign-off. No model is called.",
        "inputs": ["move (sheets, claims, answers)", "side.dossier.cash_need"],
        "outputs": ["{subject, body, term_sheets, refs}"],
        "details": [
            "Subject: 'Re: ' + the supplier's last subject (or case title), max 300 chars.",
            "refs = sorted set of every claim's data IDs.",
        ],
    },
    {
        "id": "send_and_record",
        "name": "Send, read reply, record trace",
        "kind": "arena",
        "when": "every move",
        "file": PLAY,
        "line": L(PLAY, 162, 'sid, msg = decision["supplier_id"], decision["message"]'),
        "function": "play / ProcuDealAgent.record",
        "summary": "Posts the message; the call blocks until the supplier replies (up to about a minute). An action ends the loop. A 409 (late, ended, round limit) is turned into a reply or a result.",
        "inputs": ["decision"],
        "outputs": ["supplier reply appended to the thread", "or the case result"],
        "details": [
            "accept / walk_away -> table.close -> return result (play.py:164-166).",
            "409 -> table.missed: case ended -> result; thread closed -> status walked_away; else the timeout answer (play.py:74-90).",
            "409 on an action while the case runs -> append the reply and decide again (play.py:173-175).",
            "Any other ArenaError is re-raised and stops this case (play.py:169-170).",
            "Trace entry written before sending (__init__.py:50); bench.py saves agent.trace as 'decisions' (bench.py:67).",
        ],
    },
    {
        "id": "fallbacks",
        "name": "Fallbacks: kit LLM, naive, closing move",
        "kind": "llm",
        "when": "on exception / at close",
        "file": INI,
        "line": L(INI, 47, "except Exception as e"),
        "function": "LLMAgent.decide / NaiveAgent.decide / play.closing_move",
        "summary": "Only when the engine raises: one LLM call writes the move, guarded by code; if the LLM fails, the naive agent moves. Separately, near a Live Final wave cap the runner closes with closing_move (no LLM).",
        "inputs": ["case", "threads"],
        "outputs": ["decision"],
        "details": [
            "LLM call timeout 45 s (both providers); Anthropic SDK default max_retries 2 applies.",
            "NaiveAgent accepts without a must-have or alternative check.",
            "closing_move: cheapest live standing sheet that keeps must-haves and has C < C_alt, else walk_away (play.py:126-139).",
        ],
    },
]

# ---------------------------------------------------------------- decide_flow
out["decide_flow"] = [
    {"order": 0, "id": "new_negotiator", "condition": "first move of a case: self.negotiator is None or self.negotiator.case['case_id'] != case['case_id']", "action": "create Negotiator(case, package)", "reason_key": None, "file": INI, "line": L(INI, 33, "self.negotiator is None")},
    {"order": 1, "id": "setup_once", "condition": "no sides yet: `if not self.sides`", "action": "setup(threads): C_open, limit, one Side per supplier", "reason_key": None, "file": POL, "line": L(POL, 156, "if not self.sides")},
    {"order": 2, "id": "observe_live", "condition": "for every live thread (status not in {'walked_away','no_bid'})", "action": "observe(): read new replies, update side.theirs / asks / traits, react()", "reason_key": None, "file": POL, "line": L(POL, 158, "live = live_threads(threads)")},
    {"order": 3, "id": "collect_offers", "condition": "standing sheet exists and eco.accept_check(...) is ok: price present, must_haves_ok, C < min(C_alt, C_open)", "action": "offers sorted by C; best = cheapest or None", "reason_key": "check text: 'C x below the limit y' (appended to the accept why)", "file": POL, "line": L(POL, 163, "offers = []")},
    {"order": 4, "id": "ready_map", "condition": "ready(side, events) per live thread (see ready_flow)", "action": "ready[sid] = reason string or False", "reason_key": "ready reason (first part of accept why)", "file": POL, "line": L(POL, 175, "ready = {sid: self.ready")},
    {"order": 5, "id": "rfq_flag_board", "condition": "self.rfq = len(live) > 1; board = live sheets with a price that keep must-haves", "action": "leader = lowest C on the board", "reason_key": None, "file": POL, "line": L(POL, 176, "self.rfq = len(live) > 1")},
    {"order": 6, "id": "rfq_guard", "condition": "RFQ and (not best or leader is None or best[1] != leader)", "action": "skip the auction (rfq_close returns None)", "reason_key": None, "file": POL, "line": L(POL, 229, "if not best or leader is None or best[1] != leader")},
    {"order": 7, "id": "rfq_wait_for_call", "condition": "a last call is out and the runner is live and has not replied: `self.sides[runner].replies <= replies`", "action": "hold (return None, fall through to the normal flow)", "reason_key": None, "file": POL, "line": L(POL, 233, "self.sides[runner].replies <= replies")},
    {"order": 8, "id": "rfq_judge_call", "condition": "the call was answered: calls += 1; `best[0] >= c_before * (1 - AUCTION_MIN_GAIN) or self.calls >= AUCTION_CALLS`", "action": "accept best", "reason_key": "best after {calls} auction call(s)", "file": POL, "line": L(POL, 237, "best[0] >= c_before * (1 - AUCTION_MIN_GAIN)")},
    {"order": 9, "id": "rfq_leader_not_ready", "condition": "no call out and the leader is not ready: `elif not ready.get(leader)`", "action": "no auction yet (return None)", "reason_key": None, "file": POL, "line": L(POL, 239, "elif not ready.get(leader)")},
    {"order": 10, "id": "rfq_call_runner", "condition": "runners = live, != leader, moves_left > 0, on the board, not dropped, status != final_offer; take the lowest C; last_call_offer returns a sheet", "action": "send last call: one sheet priced so its C = leader C x 0.98 (capped at 0.998 x its price)", "reason_key": "why {price, last_call: true, leader, leader_c}", "file": POL, "line": L(POL, 241, "runners = [")},
    {"order": 11, "id": "rfq_no_runner_left", "condition": "no call could be made and at least one call was made before: `move is None and self.calls`", "action": "accept best", "reason_key": "best after {calls} auction call(s), no runner-up left", "file": POL, "line": L(POL, 256, "if move is None and self.calls")},
    {"order": 12, "id": "rfq_drop", "condition": "RFQ, sid != leader, on the board, len(side.theirs) >= 2, its C > leader C x 1.10, not yet dropped", "action": "side.dropped = True (no more rounds unless nobody else can talk)", "reason_key": "log: '... is >10% above the leader's C - no more rounds'", "file": POL, "line": L(POL, 188, "bidders that cannot catch the leader")},
    {"order": 13, "id": "accept_ready", "condition": "`best and (ready[best[1]] or all(ready.values()))`", "action": "accept best", "reason_key": "'<ready reason>; <check text>' e.g. 'final_offer; C 257,459 below the limit 295,173'", "file": POL, "line": L(POL, 206, "if best and (ready[best[1]] or all(ready.values()))")},
    {"order": 14, "id": "walk_nothing_passes", "condition": "not best and every live thread is final_offer or has moves_left <= 0", "action": "walk_away (to live[0])", "reason_key": "no standing sheet passes the accept check", "file": POL, "line": L(POL, 211, "if not best and finished")},
    {"order": 15, "id": "talk_pick_1", "condition": "threads not ready, not dropped, moves_left > 0", "action": "candidates", "reason_key": None, "file": POL, "line": L(POL, 215, "talk = [s for s in live if not ready[s] and not self.sides[s].dropped")},
    {"order": 16, "id": "talk_pick_2", "condition": "if none: threads not ready with moves_left > 0 (dropped allowed)", "action": "candidates", "reason_key": None, "file": POL, "line": L(POL, 217, "talk = [s for s in live if not ready[s] and moves_left")},
    {"order": 17, "id": "talk_pick_3", "condition": "if none: any live thread with moves_left > 0 (ready ones too, incl. final_offer)", "action": "candidates", "reason_key": None, "file": POL, "line": L(POL, 219, "talk = [s for s in live if moves_left")},
    {"order": 18, "id": "no_moves_left", "condition": "no candidate at all", "action": "accept best if any, else walk_away", "reason_key": "no moves left", "file": POL, "line": L(POL, 221, '"no moves left"')},
    {"order": 19, "id": "offer", "condition": "otherwise; sid = candidate with the lowest side.seen (the oldest reply)", "action": "send offer(side): next_price, 1-3 sheets, claims, answers", "reason_key": "why {price, anchor, ceiling, their_price_on_our_terms, c_main, limit, sheets, claims, asks, traits, mix}", "file": POL, "line": L(POL, 222, "sid = min(talk, key=lambda s: self.sides[s].seen)")},
    {"order": 20, "id": "engine_exception", "condition": "any exception in remember_prices / decide / writer", "action": "kit LLMAgent.decide takes this move", "reason_key": "error: repr(e), source 'kit-llm'", "file": INI, "line": L(INI, 47, "except Exception as e")},
]

out["ready_flow"] = [
    {"order": 1, "condition": "status == 'final_offer' or moves_left(case, events) <= 1", "returns": "status (e.g. 'final_offer'; for an open thread on its last message the text is 'open', since `status or \"last move\"` only falls back when status is empty)", "file": POL, "line": L(POL, 361, 'if status == "final_offer" or moves_left(self.case, events) <= 1')},
    {"order": 2, "condition": "status == 'agreed'", "returns": "False if below_health (relationship goal and its price < best_for_us x 0.98) else 'agreed'", "file": POL, "line": L(POL, 363, 'if status == "agreed"')},
    {"order": 3, "condition": "no offer from us yet or no price from it: `not side.ours or not side.theirs`", "returns": "False", "file": POL, "line": L(POL, 365, "if not side.ours or not side.theirs")},
    {"order": 4, "condition": "`side.theirs[-1] <= side.ours[-1] * (1 + CLOSE_GAP)` (its price on our mix within 0.5 % of our last price)", "returns": "within half a percent of our offer", "file": POL, "line": L(POL, 367, "side.theirs[-1] <= side.ours[-1] * (1 + CLOSE_GAP)")},
    {"order": 5, "condition": "relationship goal and side.best_for_us and `side.theirs[-1] <= side.best_for_us` (and not below_health)", "returns": "at the price that is cheapest for us with the relationship charge", "file": POL, "line": L(POL, 369, "self.goal in RELATIONSHIP_GOALS and side.best_for_us and side.theirs[-1] <= side.best_for_us")},
    {"order": 6, "condition": "otherwise", "returns": "False", "file": POL, "line": L(POL, 373, "return False")},
]

# ---------------------------------------------------------------- pricing
out["pricing"] = {
    "summary": "All numbers come from the kit's total_cost. The engine picks the non-price term mix that is cheapest for us at equal value to the supplier, converts each supplier price to that mix, opens at a fixed share below it, then closes 30 % of the gap per round, capped where C would reach min(C_alt, C_open). Extra sheets are priced to cost us exactly the same as the main sheet.",
    "steps": [
        {"name": "Opening cost and limit", "formula": "c_open = min(total_cost(case, t, std, est) for opening quotes with a price and must_haves_ok); limit = min(alternative_cost(case), c_open)", "file": POL, "line": L(POL, 93, "costs = ["), "explain": "A deal must cost less than the cheapest opening quote and the no-deal alternative. If no opening keeps the must-haves, c_open stays infinite."},
        {"name": "Supplier estimate", "formula": "{'standard': reference terms, 'interest_rate': OWNER_RATE[owner] (+0.05 cash), 'full_cost': should-cost | generic x COUNTRY_COST | quote x 0.90}", "file": DOS, "line": L(DOS, 63, "def estimate"), "explain": "Used to value terms for the supplier and, in stabilise/secure_supply cases, to price the relationship charge."},
        {"name": "Term mix search", "formula": "for mix in term_mixes (<= 2000): price = price_for_value(mix, supplier, value(quote)); C at price x deal_ratio; sort by (round(C), number of changed terms)", "file": ECO, "line": L(ECO, 114, "def plan_terms"), "explain": "deal_ratio = (1 + anchor_ratio) / 2: mixes are compared at the price level we expect to close at. plan[0] becomes side.mix."},
        {"name": "Its price on our mix", "formula": "_their_price = price_for_value(case, mix, est, supplier_value(case, standing_terms, est))", "file": POL, "line": L(POL, 607, "def _their_price"), "explain": "Every standing offer is restated as the price that would be worth the same to the supplier on our mix, so rounds compare like with like (side.theirs)."},
        {"name": "Anchor", "formula": "anchor = q_eq * (ANCHOR[goal] + shift); anchor = max(anchor, best_for_us); price_increase: anchor = min(anchor, current_unit_price)", "file": POL, "line": L(POL, 126, "anchor = (q_eq or quote.get"), "explain": "leverage 0.80, routine 0.84, quality_first 0.88, secure_supply 0.90, stabilise 0.92 (else 0.85); shift +/-0.03 by owner type and reply delay."},
        {"name": "Health price (relationship goals)", "formula": "best_for_us = cheapest_price(case, mix, std, est)  # golden-section search on C over [0.01, 3 x price scale]", "file": ECO, "line": L(ECO, 59, "def cheapest_price"), "explain": "Only for stabilise / secure_supply: below this price the relationship charge makes C rise again. Other goals: 0."},
        {"name": "Ceiling", "formula": "ceiling = price_ceiling(case, mix, limit, std, est)  # bisection: highest price with C < limit, floored to cents; None -> 0.0", "file": ECO, "line": L(ECO, 76, "def price_ceiling"), "explain": "Set in setup for the setup mix. Not recomputed when the mix changes later. 0.0 is treated as 'no cap' by `if side.ceiling`."},
        {"name": "First offer", "formula": "price = min(side.anchor, theirs * 0.99)", "file": POL, "line": L(POL, 386, "price = min(side.anchor, theirs * 0.99)"), "explain": "At least 1 % below its quote on our mix."},
        {"name": "Price frozen", "formula": "price = theirs", "file": POL, "line": L(POL, 388, "price = theirs"), "explain": "Its e-mail says prices are frozen: match its price (then capped at 0.998 x) and win on terms. The next reply is then within 0.5 % and gets accepted."},
        {"name": "Stuck", "formula": "price = max(ours[-1] + STUCK_STEP * (theirs - ours[-1]), ours[-1])  # STUCK_STEP 0.45", "file": POL, "line": L(POL, 390, "STUCK_STEP"), "explain": "It says it cannot move without a move from us: bigger step."},
        {"name": "Normal concession", "formula": "step = HOLD_STEP (0.10) if deep else STEP (0.30); price = max(ours[-1] + step * (theirs - ours[-1]), ours[-1])", "file": POL, "line": L(POL, 396, "price = side.ours[-1] + step * (theirs - side.ours[-1])"), "explain": "deep = second offer after a first counter that dropped >= 6 %, or (RFQ) its last drop >= 6 %."},
        {"name": "Health override", "formula": "if relationship goal and best_for_us and ours and theirs < best_for_us * 0.98: price = min(best_for_us, ceiling or inf)", "file": POL, "line": L(POL, 384, "return round(min(side.best_for_us, side.ceiling or math.inf), 2)"), "explain": "Evaluated first in next_price: never push a strategic supplier below a healthy margin."},
        {"name": "Caps", "formula": "if side.ceiling: price = min(price, side.ceiling); price = min(price, theirs * 0.998); round(max(price, 0.01), 2)", "file": POL, "line": L(POL, 398, "if side.ceiling"), "explain": "We never offer at or above its own price; the 0.998 cap plus CLOSE_GAP 0.005 means a supplier that stands still is accepted next round."},
        {"name": "Main sheet", "formula": "main = complete_offer(case, {**side.mix, 'unit_price': price}); c_main = total_cost(case, main, std)", "file": POL, "line": L(POL, 407, "main = complete_offer"), "explain": "c_main has no relationship estimate: iso-cost sheets use our cash cost only."},
        {"name": "Extra sheets (max 3)", "formula": "first e-mail: up to 2 plan[1:] mixes at equal_cost_price(mix, c_main); later: its own mix at equal cost; RFQ non-leader: the leader's mix at equal cost (inserted at 1); clause ask: best-deadband index clause at equal cost (inserted at 1 if room)", "file": POL, "line": L(POL, 410, "if not side.ours:"), "explain": "Sheets that cost us the same let the supplier's choice show what it values. Relationship goals drop extra sheets priced below best_for_us x 0.995."},
        {"name": "Accept check", "formula": "ok = price present and must_haves_ok and total_cost(terms, std, est) < min(C_alt, c_open)", "file": ECO, "line": L(ECO, 46, "def accept_check"), "explain": "The only gate before any engine accept; the sheet ID is always the supplier's current standing sheet."},
    ],
}

# ---------------------------------------------------------------- rfq
out["rfq"] = {
    "summary": "With more than one live thread the engine runs the threads round-robin (oldest reply first), cites the best rival bid, offers the leader's term package to the others, stops talking to bidders more than 10 % above the leader in C, and once the leader is ready runs a short reverse auction (up to 4 last calls) before accepting the best sheet in C. Accepting one sheet ends the case.",
    "steps": [
        {"order": 1, "name": "RFQ mode", "condition": "len(live_threads) > 1, re-evaluated every move", "action": "self.rfq = True; if bidders walk away and one is left, the single-thread rules apply", "file": POL, "line": L(POL, 176, "self.rfq = len(live) > 1")},
        {"order": 2, "name": "Round-robin", "condition": "several threads can be talked to", "action": "pick the lowest side.seen = total prices seen across all threads when its last reply arrived (oldest reply first)", "file": POL, "line": L(POL, 222, "sid = min(talk")},
        {"order": 3, "name": "Leader board", "condition": "standing sheet with a price that keeps the must-haves", "action": "board[sid] = (C with estimate, sheet_id, terms); leader = lowest C", "file": POL, "line": L(POL, 177, "self.board = {}")},
        {"order": 4, "name": "Rival claim", "condition": "talking to a non-leader: cite the leader; talking to the leader: cite the bidder with the lowest unit price below its own; each rival sheet once per thread", "action": "first claim: 'Another supplier has offered EUR x per unit for this part (offer:...)'", "file": POL, "line": L(POL, 526, "rival = leader if leader")},
        {"order": 5, "name": "Leader's package", "condition": "non-leader thread, fewer than 3 sheets, leader's mix differs", "action": "add a sheet on the leader's term mix at the same C to us (position 1)", "file": POL, "line": L(POL, 432, "if self.rfq and leader and leader != side.sid")},
        {"order": 6, "name": "Leader terms line", "condition": "a rival claim was used and the leader has a shorter lead time and/or longer payment terms", "action": "'That offer also comes with ...' (words only, no figures)", "file": POL, "line": L(POL, 487, "def leader_terms_line")},
        {"order": 7, "name": "Small steps after a big drop", "condition": "RFQ and its last drop >= 6 %", "action": "concede 10 % of the gap instead of 30 %", "file": POL, "line": L(POL, 394, "deep = (len(side.ours) == 1")},
        {"order": 8, "name": "Drop rule", "condition": "non-leader with >= 2 prices and C > leader C x 1.10", "action": "dropped: no more rounds (unless no other thread can be talked to)", "file": POL, "line": L(POL, 195, "self.board[sid][0] > self.board[leader][0] * (1 + DROP_GAP)")},
        {"order": 9, "name": "Auction start", "condition": "best passing sheet is the leader's and the leader is ready (agreed, final_offer, within 0.5 %, last move, health price)", "action": "call the runner-up with the lowest C (not dropped, not final_offer, moves left)", "file": POL, "line": L(POL, 252, "runner = min(runners")},
        {"order": 10, "name": "Last call", "condition": "equal_cost_price(runner mix, leader C x 0.98) exists and keeps must-haves", "action": "one sheet at that price (max 0.998 x its price) + rival claim + fixed text: 'Another supplier has agreed to terms that cost us less overall...'", "file": POL, "line": L(POL, 260, "def last_call_offer")},
        {"order": 11, "name": "Judge the call", "condition": "after the runner's reply: best C improved by < 0.5 %, or 4 calls made", "action": "accept the best sheet ('best after N auction call(s)')", "file": POL, "line": L(POL, 237, "AUCTION_MIN_GAIN")},
        {"order": 12, "name": "Next call", "condition": "best C improved by >= 0.5 % (the runner overtook the leader)", "action": "call the new runner-up (often the old leader), without waiting for it to be ready", "file": POL, "line": L(POL, 241, "runners = [")},
        {"order": 13, "name": "No runner left", "condition": "no runner can be called and >= 1 call was made", "action": "accept best ('..., no runner-up left'); if no call was made, the normal accept_ready rule accepts the ready leader", "file": POL, "line": L(POL, 256, "if move is None and self.calls")},
    ],
    "examples": [
        "Two bidders (sandbox D02, practice run at commit f358cfe-dirty): the engine alternates counters J1, C1, J1, C1 for 5 rounds. J1 answers with final_offer and is the leader in C, so it is ready. C1 gets one last call to beat J1's C by 2 %. Its reply does not improve the best C by 0.5 %, so the engine accepts J1: 'best after 1 auction call(s); C 186,560 below the limit 214,296'.",
        "Three bidders (practice P05, commit f358cfe-dirty): all three get a first offer. After its first reply, sup:70240 is more than 10 % above the leader in C and is dropped (it got 1 message in total). sup:70250 reaches agreed and leads; sup:70210 gets a last call, beats it by at least 0.5 % and becomes the leader; sup:70250 (agreed, not final) gets the next call; that does not improve the best C enough, so sup:70210 is accepted after 2 calls.",
        "Leader at final_offer, runner also at final_offer: no runner can be called (final_offer is never pushed) and no call was made, so rfq_close returns None and accept_ready takes the leader at once.",
        "Nothing passes: if every live bidder is at final_offer or out of messages and no standing sheet beats min(C_alt, C_open), the engine walks away from the whole case ('no standing sheet passes the accept check').",
    ],
}

# ---------------------------------------------------------------- stop reasons
out["stop_reasons"] = [
    {"id": "accept_final_offer", "who": "buyer", "trigger": "supplier status final_offer and its sheet passes the accept check", "effect": "accept; why 'final_offer; C x below the limit y'. In saved practice runs this is the most common end (P02, P04, P07, P08, P10, P11, P18), after 2-5 rounds", "file": POL, "line": L(POL, 361, 'status == "final_offer"')},
    {"id": "accept_last_move", "who": "buyer", "trigger": "moves_left <= 1 (round_limit 10 -> after 9 of our messages)", "effect": "accept if the sheet passes; why starts with the status text ('open; ...'). The 10th message is never a counter", "file": POL, "line": L(POL, 361, "moves_left(self.case, events) <= 1")},
    {"id": "accept_agreed", "who": "buyer", "trigger": "supplier status agreed (it offers exactly one of our sheets), not below the health band", "effect": "accept; why 'agreed; ...'", "file": POL, "line": L(POL, 363, 'status == "agreed"')},
    {"id": "accept_within_gap", "who": "buyer", "trigger": "its price on our mix <= our last price x 1.005", "effect": "accept; why 'within half a percent of our offer; ...'", "file": POL, "line": L(POL, 367, "CLOSE_GAP")},
    {"id": "accept_health_price", "who": "buyer", "trigger": "stabilise/secure_supply: its price on our mix <= best_for_us and >= best_for_us x 0.98", "effect": "accept; why 'at the price that is cheapest for us with the relationship charge; ...'", "file": POL, "line": L(POL, 372, "at the price that is cheapest for us")},
    {"id": "accept_all_ready", "who": "buyer", "trigger": "every live thread is ready and the best sheet passes", "effect": "accept the best sheet in C", "file": POL, "line": L(POL, 206, "all(ready.values())")},
    {"id": "accept_auction_done", "who": "buyer", "trigger": "RFQ: after a last call the best C improved by < 0.5 %, or 4 calls made", "effect": "accept; why 'best after N auction call(s); ...'", "file": POL, "line": L(POL, 238, "best after {self.calls} auction call(s)")},
    {"id": "accept_no_runner_left", "who": "buyer", "trigger": "RFQ: at least one call made and no runner-up can be called", "effect": "accept; why 'best after N auction call(s), no runner-up left; ...'", "file": POL, "line": L(POL, 257, "no runner-up left")},
    {"id": "accept_no_moves_left", "who": "buyer", "trigger": "no live thread has moves_left > 0 and a sheet passes", "effect": "accept; why 'no moves left; ...'", "file": POL, "line": L(POL, 221, '"no moves left"')},
    {"id": "walk_nothing_passes", "who": "buyer", "trigger": "no standing sheet passes the accept check and every live thread is final_offer or out of messages", "effect": "walk_away: case ends without a deal (scores the alternative)", "file": POL, "line": L(POL, 212, "no standing sheet passes the accept check")},
    {"id": "walk_no_moves_left", "who": "buyer", "trigger": "no thread has moves left and nothing passes", "effect": "walk_away", "file": POL, "line": L(POL, 221, "self.walk(live[0], \"no moves left\")")},
    {"id": "llm_fallback_close", "who": "buyer", "trigger": "engine exception; the LLM answers accept or walk_away and the guard passes it", "effect": "accept (must-haves kept, C <= C_alt) or walk_away (no check)", "file": LLM, "line": L(LLM, 151, 'if kind == "walk_away"')},
    {"id": "naive_fallback_close", "who": "buyer", "trigger": "engine exception and the LLM fails or its reply fails the guard", "effect": "naive: accept at agreed / final_offer / no moves / within 1 % (no must-have or alternative check); walk_away if no supplier quotes a price", "file": NAI, "line": L(NAI, 36, 'if latest(events).get("status") in {"agreed", "final_offer"}')},
    {"id": "closing_move_cap", "who": "runner", "trigger": "Live Final only: now > wave cap - max(90 s, slowest round + 15 s)", "effect": "accept the cheapest live sheet with must-haves kept and C < C_alt (no C_open check, no relationship charge), else walk_away", "file": PLAY, "line": L(PLAY, 155, "CLOSE_BEFORE_CAP_S")},
    {"id": "no_live_threads", "who": "runner", "trigger": "every thread is walked_away / no_bid", "effect": "play() returns table.result()", "file": PLAY, "line": L(PLAY, 181, "return table.result()")},
    {"id": "case_crash", "who": "runner", "trigger": "an ArenaError other than 409 (e.g. 422 on a stale term_sheet_id, 5xx after retries) or any exception outside the agent", "effect": "play() raises; the case stops being played. In the final the session stays open until the wave cap (no deal)", "file": PLAY, "line": L(PLAY, 169, "if e.status != 409")},
    {"id": "supplier_walked_away", "who": "supplier", "trigger": "supplier ends its thread (status walked_away)", "effect": "thread no longer live; if it was the last live thread the reply carries the result and play() returns it", "file": PLAY, "line": L(PLAY, 24, "ENDED = {")},
    {"id": "supplier_no_bid", "who": "supplier", "trigger": "supplier declines to quote (status no_bid)", "effect": "thread not live from the start", "file": PLAY, "line": L(PLAY, 24, "no_bid")},
    {"id": "round_limit", "who": "arena", "trigger": "our messages in a thread reach case.round_limit (default 10)", "effect": "a further send gets 409; accept is still allowed. The engine stops countering at moves_left <= 1 anyway", "file": PLAY, "line": L(PLAY, 115, "round_limit")},
    {"id": "timeouts", "who": "arena", "trigger": "a message later than 60 s after the supplier's last reply; 3 in a row, or one after the last round", "effect": "409; our last offer is repeated and patience drops; after 3 the thread ends (missed() marks it walked_away)", "file": PLAY, "line": L(PLAY, 85, '"walked_away" if t["closed"]')},
    {"id": "wave_cap", "who": "arena", "trigger": "Live Final wave cap (8 min, read seconds_left)", "effect": "every open session ends without a deal (end_reason wave_cap); later calls 409 -> missed() returns the result", "file": PLAY, "line": L(PLAY, 78, 'if state.get("status") == "ended"')},
    {"id": "other_end_reasons", "who": "arena", "trigger": "session end_reason no_deal, timeout or window_closed (brief/api.md:122)", "effect": "case ends; the runner sees it as a result or a 409", "file": PLAY, "line": L(PLAY, 92, "def result")},
]

# ---------------------------------------------------------------- constants
C = []


def const(name, value, f, n, expect, meaning):
    C.append({"name": name, "value": value, "file": f, "line": L(f, n, expect), "meaning": meaning})


const("ANCHOR", module_const(POL, "ANCHOR"), POL, 26, "ANCHOR =", "First offer as a share of its quote on our mix, by category goal (default 0.85 for other goals, policy.py:118).")
const("STEP", 0.30, POL, 27, "STEP, HOLD_STEP", "Share of the gap we close per round.")
const("HOLD_STEP", 0.10, POL, 27, "STEP, HOLD_STEP", "Gap share after a deep drop (2nd offer, or RFQ last drop).")
const("DEEP_DROP", 0.06, POL, 28, "DEEP_DROP", "A price drop this large counts as deep.")
const("CLOSE_GAP", 0.005, POL, 29, "CLOSE_GAP", "Ready when its price is within this of our last offer.")
const("FIRST_CLAIMS", 3, POL, 30, "FIRST_CLAIMS", "Claims in the first e-mail to a supplier.")
const("LATER_CLAIMS", 1, POL, 30, "LATER_CLAIMS", "Claims per later e-mail.")
const("DATA_CLAIMS", 2, POL, 30, "DATA_CLAIMS", "Claims after it asked for data.")
const("DROP_GAP", 0.10, POL, 31, "DROP_GAP", "RFQ: a bidder this far above the leader's C gets no more rounds.")
const("AUCTION_EDGE", 0.02, POL, 32, "AUCTION_EDGE", "RFQ last call asks the runner-up to beat the leader's C by this.")
const("AUCTION_MIN_GAIN", 0.005, POL, 33, "AUCTION_MIN_GAIN", "Keep calling while the best C improves at least this much.")
const("AUCTION_CALLS", 4, POL, 34, "AUCTION_CALLS", "At most this many last calls.")
const("HEALTH_BAND", 0.98, POL, 35, "HEALTH_BAND", "Strategic goals: a price below best_for_us x this is countered at best_for_us.")
const("STUCK_STEP", 0.45, POL, 36, "STUCK_STEP", "Gap share when it says it cannot move without a move from us.")
const("PATIENT_SHIFT", 0.03, POL, 37, "PATIENT_SHIFT", "Anchor shift: -0.03 slow (delay >= 4 d) or founder-run, +0.03 group with delay <= 2 d.")
const("DONE", ["agreed", "final_offer"], POL, 38, "DONE =", "Defined but never used.")
const("first offer cap", 0.99, POL, 386, "theirs * 0.99", "First offer at most 99 % of its price on our mix.")
const("own price cap", 0.998, POL, 400, "theirs * 0.998", "Every offer at most 99.8 % of its price on our mix (also last calls, policy.py:267).")
const("health floor for extra sheets", 0.995, POL, 445, "side.best_for_us * 0.995", "Relationship goals: extra sheets below this are dropped.")
const("adopt alternative threshold (EUR)", 1, POL, 321, "standing_c - 1", "Its alternative sheet must cost us more than EUR 1 less to be adopted.")
const("replan default ratio", 0.9, POL, 338, "else 0.9", "deal_ratio fallback when re-planning without a first price.")
const("delay thresholds (days)", {"slow": 4, "quick": 2}, POL, 114, "(delay or 0) >= 4", "reply_delay_days of the quote e-mail that triggers the anchor shift.")
const("GOLDEN", "(sqrt(5) - 1) / 2", ECO, 14, "GOLDEN", "Golden-section ratio for cheapest_price.")
const("MAX_COMBOS", 2000, ECO, 15, "MAX_COMBOS", "Most term-option combinations tried by plan_terms.")
const("equal-cost offset (EUR)", 0.01, ECO, 144, "c_target + 0.01", "equal_cost_price searches for C < target + 0.01.")
const("OWNER_RATE", module_const(DOS, "OWNER_RATE"), DOS, 27, "OWNER_RATE", "Supplier's cost of money per year by owner type.")
const("DEFAULT_RATE", 0.075, DOS, 28, "DEFAULT_RATE", "Cost of money for an unknown owner type.")
const("CASH_PREMIUM", 0.05, DOS, 29, "CASH_PREMIUM", "Added to the rate when the dossier or an e-mail shows a cash need.")
const("COUNTRY_COST", module_const(DOS, "COUNTRY_COST"), DOS, 31, "COUNTRY_COST", "Factor on the generic (DE) should-cost by supplier country; other countries 1.0.")
const("ASSUMED_MARGIN", 0.10, DOS, 33, "ASSUMED_MARGIN", "Without should-cost: full cost = quote x 0.90.")
const("OWN_PLANT_BAND", 0.95, DOS, 35, "OWN_PLANT_BAND", "Full-cost floor = own-plant should-cost x 0.95.")
const("GENERIC_BAND", 0.85, DOS, 35, "GENERIC_BAND", "Full-cost floor = generic should-cost x 0.85.")
const("bound_full_cost factor", 0.995, DOS, 69, "price * 0.995", "Each offered price caps the full-cost estimate at 99.5 % of it.")
const("DB_LOCK", "threading.Lock()", DOS, 13, "DB_LOCK", "One SQLite connection shared by parallel cases.")
const("MIN_INDEX_FALL", -0.5, CLM, 13, "MIN_INDEX_FALL", "Index fall (in %) needed for an index claim.")
const("DATA_MONTH", "2026-09", CLM, 14, "DATA_MONTH", "Latest data month; index series must end within 11 months of it.")
const("should-cost claim threshold", 0.98, CLM, 150, "0.98 * price_ref", "Should-cost claim only if should-cost < 98 % of its quote price.")
const("OTD claim threshold (%)", 90, CLM, 173, "< 90", "Delivery-record claim only if on-time delivery < 90 %.")
const("SIGN_OFF", module_const(WRI, "SIGN_OFF"), WRI, 7, "SIGN_OFF", "E-mail signature.")
const("ENDED", ["walked_away", "no_bid"], PLAY, 24, "ENDED", "Thread statuses that are no longer live.")
const("MOVE_LIMIT_S", 60, PLAY, 26, "MOVE_LIMIT_S", "Seconds per message per thread (only used for a warning at 0.75 x).")
const("CLOSE_BEFORE_CAP_S", 90, PLAY, 29, "CLOSE_BEFORE_CAP_S", "Live Final: closing_move this long before the wave cap.")
const("ROUND_MARGIN_S", 15, PLAY, 29, "ROUND_MARGIN_S", "Or slowest round + this, if longer.")
const("round_limit default", 10, PLAY, 115, 'case.get("round_limit", 10)', "Messages per thread when the case does not say.")
const("LLM timeout (s)", 45.0, LLM, 60, "timeout=45.0", "Anthropic client timeout per request; same value for the OpenAI path (llm.py:82).")
const("LLM max_tokens", 16000, LLM, 66, "max_tokens=16000", "Anthropic path only.")
const("render: last messages", 6, LLM, 139, "events[-6:]", "Messages per thread shown to the model (body 800 chars, attachment 1500 chars).")
const("TIMEOUT_S", 180.0, CLIENT, 17, "TIMEOUT_S", "Arena HTTP timeout.")
const("CALLS_PER_SECOND", 9, CLIENT, 14, "CALLS_PER_SECOND", "Client pacing across threads.")
const("retries", 3, CLIENT, 39, "retries=3", "Arena HTTP retries (same X-Move-Id) on 429-short/5xx/transport errors.")
const("NaiveAgent anchor / close_gap", {"anchor": 0.10, "close_gap": 0.01}, NAI, 12, "anchor=0.10, close_gap=0.01", "Naive fallback: first offer 10 % below, accept within 1 %.")
const("RELATIONSHIP_GOALS", ["stabilise", "secure_supply"], COST, 16, "RELATIONSHIP_GOALS", "Goals where C includes the supplier-health charge.")
out["constants"] = C

# ---------------------------------------------------------------- claims
out["claims"] = [
    {"type": "notice_period", "strength": 7, "when_used": "the case's trigger letter is from this supplier and gives fewer days than a price clause of its contract", "sentence_template": src(CLM, 77, 78), "refs": "doc: (trigger letter) + ctr:<no>#<clause>", "file": CLM, "line": L(CLM, 63, "def _notice")},
    {"type": "index_change", "strength": "5 + driver weight", "when_used": "a cost-driver series of the part fell >= 0.5 % over any window of 1-12 months ending at its latest month (latest month within 11 months of 2026-09); removed from the bank once the supplier is 'hedged'", "sentence_template": src(CLM, 127, 128), "refs": "two idx:<series>@YYYY-MM ids", "file": CLM, "line": L(CLM, 95, "def _index_falls")},
    {"type": "should_cost", "strength": 6, "when_used": "single-part case; own-plant row, else generic row; only if unit_cost < 0.98 x its quote price", "sentence_template": src(CLM, 155, 156), "refs": "cost:<part> should_cost row id", "file": CLM, "line": L(CLM, 143, "def _should_cost")},
    {"type": "quality_record", "strength": 6, "when_used": "category_goal quality_first and the latest scorecard has ppm", "sentence_template": src(CLM, 171), "refs": "sc:<sup>@YYYYQn (latest)", "file": CLM, "line": L(CLM, 170, "quality_first")},
    {"type": "delivery_record", "strength": 4, "when_used": "latest scorecard on-time delivery < 90 %", "sentence_template": src(CLM, 174), "refs": "sc:<sup>@YYYYQn (latest)", "file": CLM, "line": L(CLM, 173, "otd_pct")},
    {"type": "volume_change", "strength": 4, "when_used": "latest forecast for the part has change_pct > 0", "sentence_template": src(CLM, 191), "refs": "fc:<part>@YYYY-MM (latest)", "file": CLM, "line": L(CLM, 179, "def _forecast")},
    {"type": "rival_offer", "strength": 8, "when_used": "RFQ only: always the first claim when a rival sheet applies (leader for non-leaders; cheaper unit price for the leader); once per rival sheet id per thread; the only claim in a last call", "sentence_template": src(CLM, 52), "refs": "offer:<rival standing sheet id>", "file": CLM, "line": L(CLM, 48, "def rival_claim")},
]
out["claims_selection"] = {
    "rule": "n = 3 for the first e-mail, 2 if its latest e-mail asked for data, else 1; rival claim first, then unused bank claims by strength; a claim (by its ref set) is never repeated in a thread",
    "file": POL,
    "line": L(POL, 523, "n = FIRST_CLAIMS"),
}

# ---------------------------------------------------------------- signals
ask_effect = {
    "volume": "answers(): 'We can commit to {volume_per_year:,} pieces per year over {contract_months} months, as set out in the packages below.' (policy.py:504-508)",
    "payment": "react(): once per thread, interest_rate += 0.05 unless the dossier already had cash_need, then replan the term mix (policy.py:306-310); answers(): 'We have included faster payment, as you asked.' if any sheet pays faster than its reference terms (policy.py:509-515)",
    "clause": "clause_sheet(): one sheet with the widest-deadband index clause at the same C to us, if index_clause is negotiable (policy.py:470-485); answers(): 'We are open to a price adjustment clause; one of the packages includes it.'",
    "data": "pick_claims(): 2 claims instead of 1 in the next e-mail (policy.py:523)",
}
ask_example = {
    "volume": "Which volume can you commit to?",
    "payment": "Faster payment is welcome; we can reflect it in the price.",
    "clause": "We can offer a Preisgleitklausel on AS-14404.",
    "data": "Which figures is that based on? Please send us the data.",
}
trait_effect = {
    "price_frozen": "next_price(): price = its price (then capped at 0.998 x), so the next reply is accepted as within 0.5 % (policy.py:387-388); answers(): 'We understand that your price is fixed for now, so we have looked at the terms instead.'",
    "hedged": "react(): remove every index_change claim from the bank for this supplier (policy.py:311-312)",
    "stuck": "next_price(): close 45 % of the gap instead of 30 % (policy.py:389-390)",
}
trait_example = {
    "price_frozen": "Due to the strict freeze on price reductions mandated by our management ...",
    "hedged": "As to the index change data you cited, that is not our reality: our AS-14404 is covered at fixed prices",
    "stuck": "Without movement from your side we cannot move either.",
}
out["signals"] = {
    "source": {"file": SIG, "line": L(SIG, 39, "def read"), "note": "case-insensitive search over subject + body of every new supplier e-mail; asks accumulate per thread, traits are from the latest e-mail only"},
    "asks": [{"key": k, "regex": v, "example": ask_example[k], "effect_in_policy": ask_effect[k]} for k, v in ASKS.items()],
    "traits": [{"key": k, "regex": v, "example": trait_example[k], "effect_in_policy": trait_effect[k]} for k, v in TRAITS.items()],
    "reply_delay": {"key": "signals.reply_delay_days (quote e-mail)", "effect": "anchor shift -0.03 if >= 4 days (or founder-run), +0.03 if <= 2 days and group-owned (policy.py:112-117)"},
    "dossier": [
        {"key": "cash_need", "regex": CASH, "effect": "interest_rate += 0.05 (cash is worth more to it: faster payment buys more price); writer adds 'If faster payment helps you, we are open to it, as shown in the packages.' when payment_days is negotiable", "file": DOS, "line": L(DOS, 36, "CASH_SIGNS")},
        {"key": "wants_work", "regex": WORK, "effect": "none: stored on the dossier, never read by the policy", "file": DOS, "line": L(DOS, 41, "WORK_SIGNS")},
        {"key": "capacity_full", "regex": FULL, "effect": "none: stored on the dossier, never read by the policy", "file": DOS, "line": L(DOS, 42, "FULL_SIGNS")},
        {"key": "owner_type", "regex": None, "effect": "OWNER_RATE sets interest_rate; founder -> anchor -0.03; group + quick reply -> anchor +0.03", "file": DOS, "line": L(DOS, 87, "OWNER_RATE.get")},
    ],
}

# ---------------------------------------------------------------- trace fields
out["trace_fields"] = [
    {"key": "round", "meaning": "our messages already sent in this thread before this decision (0 = first)"},
    {"key": "supplier_id", "meaning": "thread the decision goes to"},
    {"key": "their_status", "meaning": "status of the supplier's latest message (open, final_offer, agreed, ...)"},
    {"key": "their_offer", "meaning": "the supplier's standing term_sheet_id"},
    {"key": "their_terms", "meaning": "terms of that standing sheet"},
    {"key": "action", "meaning": "send, accept or walk_away"},
    {"key": "our_sheets", "meaning": "term sheets we sent (empty for an action)"},
    {"key": "seconds", "meaning": "decision time in seconds (engine, or the LLM fallback)"},
    {"key": "source", "meaning": "engine, or kit-llm when the engine raised and the kit LLM agent moved"},
    {"key": "why", "meaning": "accept / walk only: a string. Accept: '<ready reason>; C x below the limit y'. Walk: 'no standing sheet passes the accept check' or 'no moves left'"},
    {"key": "error", "meaning": "kit-llm only: repr of the engine exception"},
    {"key": "price", "meaning": "unit price of our main sheet"},
    {"key": "anchor", "meaning": "first-offer price for this supplier (fixed per case)"},
    {"key": "ceiling", "meaning": "highest price on our mix with C below the limit (0.0 = no price passes, Infinity = no limit)"},
    {"key": "their_price_on_our_terms", "meaning": "its standing price converted to our term mix (side.theirs[-1])"},
    {"key": "c_main", "meaning": "C of our main sheet (EUR, cash cost without the relationship estimate)"},
    {"key": "limit", "meaning": "min(C_alt, C_open) in EUR; null when infinite"},
    {"key": "sheets", "meaning": "number of term sheets sent (1-3)"},
    {"key": "claims", "meaning": "claim types used, in order"},
    {"key": "asks", "meaning": "asks found in its latest e-mail (volume, payment, clause, data)"},
    {"key": "traits", "meaning": "traits found in its latest e-mail (price_frozen, hedged, stuck)"},
    {"key": "mix", "meaning": "our non-price term mix for the main sheet"},
    {"key": "last_call", "meaning": "true for an RFQ reverse-auction call (then also leader, leader_c, price)"},
    {"key": "leader", "meaning": "last call: supplier_id of the current leader"},
    {"key": "leader_c", "meaning": "last call: the leader's C (rounded EUR)"},
]
out["trace_fields_source"] = {"file": INI, "line": L(INI, 58, "entry = {")}
out["run_file_fields"] = {
    "file": BENCH,
    "line": L(BENCH, 56, "record = {"),
    "keys": ["case_id", "agent", "commit", "note", "when", "seconds", "session_id", "result", "session", "backoffice", "decisions (= agent.trace)"],
    "path": "runs/<case>/<UTC %Y%m%dT%H%M%S>_<agent>_<session>.json",
    "note": "json.dumps keeps Infinity (allow_nan default), e.g. ceiling in runs/P10: JavaScript JSON.parse rejects it",
}

# ---------------------------------------------------------------- llm
render_sections = [
    {"section": "CASE FILE (once per case, prepare)", "content": src(LLM, 108) + "  -> the whole case file as JSON"},
    {"section": "LETTER (once per case, if trigger_doc)", "content": src(LLM, 111) + "  -> first 2,500 chars of the trigger letter"},
    {"section": "FACTS header", "content": src(LLM, 114)},
    {"section": "FACTS rows", "content": src(LLM, 117) + "  -> one row per id in case.suppliers + case.parts + case.refs, JSON cut at 600 chars"},
    {"section": "Alternative (every move, if the case has one with a price)", "content": src(LLM, 127)},
    {"section": "THREAD line (every live thread)", "content": src(LLM, 135, 137)},
    {"section": "Last 6 messages per thread", "content": src(LLM, 141) + "  -> head = status, term_sheets, missing_fields, claim_results; body cut at 800 chars"},
    {"section": "Attachments of those messages", "content": src(LLM, 143) + "  -> text cut at 1,500 chars"},
]
out["llm"] = {
    "engine_calls_per_move": 0,
    "engine_note": "policy.py, economics.py, claims.py, dossier.py, signals.py and writer.py never call `complete` or any model API; writer.py is a fixed template.",
    "fallback": {
        "trigger": "any Exception raised by negotiator.remember_prices, negotiator.decide or writer.offer_email inside ProcuDealAgent.decide",
        "file": INI,
        "line": L(INI, 47, "except Exception as e"),
        "calls_per_move": "1 call of complete(SYSTEM, render(...)) per fallback move (llm.py:99); no second call on failure. Anthropic path: the SDK client uses its default max_retries=2 (no override at llm.py:60), so one call can make up to 3 HTTP requests on timeout/429/5xx. OpenAI path: one httpx.post, no retry.",
        "timeout_s": 45,
        "timeout_note": "per HTTP request; with SDK retries the Anthropic worst case is ~3 x 45 s plus backoff, past the 60 s per-message window",
        "provider_env": ["LLM_PROVIDER (anthropic | openai, default openai)", "LLM_MODEL (required, no default)", "LLM_EFFORT (anthropic only, optional -> output_config.effort)", "ANTHROPIC_API_KEY (read by the Anthropic SDK)", "LLM_BASE_URL (openai path, default https://api.openai.com/v1)", "LLM_API_KEY (openai path, Bearer token)"],
        "provider_file": LLM,
        "provider_line": L(LLM, 54, "def llm_from_env"),
        "on_llm_failure": "any exception from the call, parse() (no JSON / bad JSON) or guard() is caught and logged ('LLM failed (...) - falling back to the naive move'); a guard result of None is treated the same. Either way NaiveAgent.decide makes the move: accept on agreed/final_offer/no moves left/within 1 %, else split the difference with one sheet and the body 'Thank you for your offer. We need a better price to go ahead.'; walk_away if no supplier quotes a price.",
        "on_llm_failure_line": L(LLM, 101, "except Exception as e"),
        "complete_constructed_always": "yes: agent_factory calls llm_from_env() for procudeal too (cli.py:43) and every ProcuDealAgent builds LLMAgent(complete, package). Construction makes no network call, but a missing LLM_MODEL raises KeyError at start-up.",
        "prepare_note": "LLMAgent.prepare (case file, letter, facts) runs on the first fallback move of a case only; it calls no model.",
        "system_prompt": SYSTEM,
        "system_prompt_line": L(LLM, 29, 'SYSTEM = """'),
        "user_prompt_structure": render_sections,
        "user_prompt_line": L(LLM, 123, "def render"),
        "expected_reply_schema": "ONE JSON object: {\"supplier_id\", \"action\": \"send\", \"subject\", \"body\", \"term_sheets\": [{\"unit_price\": 0.0, ...}]} or {\"supplier_id\", \"action\": \"accept\"} or {\"supplier_id\", \"action\": \"walk_away\"}. parse() takes the first {...} span (greedy, DOTALL), so code fences and chatter are tolerated.",
        "guard_steps": [
            "supplier_id must be a live thread, else None (llm.py:148-149).",
            "walk_away: passed through with no check (llm.py:151-152).",
            "accept: uses the supplier's current standing sheet id (the model cannot pick one); requires a sheet id, must_haves_ok with its standard terms, and C <= C_alt (or no alternative). No C_open check, no relationship charge (llm.py:154-167).",
            "send: action must be 'send' and moves_left > 0, else None (llm.py:168-169).",
            "term sheets: first 3 only; each = complete_offer(case, {**standing terms, **model terms}) so gaps take the supplier's standing values and options are snapped; duplicates removed (llm.py:170-174).",
            "data IDs in the body (ID_RE) that are neither a standing offer id nor a known fact are deleted, then empty '( )' removed (llm.py:177-183).",
            "body cut to 8,000 chars; subject default 'Re: {case title}', cut to 300 (llm.py:184-185). No 'refs' field is sent.",
        ],
        "guard_line": L(LLM, 146, "def guard"),
    },
    "other_call_sites": [],
    "other_call_sites_note": "None. play.py (play, closing_move, play_waves), cli.py, bench.py, cost.py, docs.py and naive.py contain no model call; llm_from_env's two `complete` closures (llm.py:63, llm.py:77) are only invoked from LLMAgent.decide (llm.py:99). tests/test_kit.py defines a fake complete for tests.",
}

# ---------------------------------------------------------------- email template
out["email_template"] = {
    "file": WRI,
    "line": L(WRI, 15, "def offer_email"),
    "verbatim_lines": [
        {"condition": "always", "text": "Dear Sir or Madam,", "line": L(WRI, 17, "Dear Sir or Madam")},
        {"condition": "always", "text": "(blank line)", "line": 17},
        {"condition": "first e-mail to this supplier: `not side.ours[:-1]`", "text": "Thank you for your offer and for explaining your position.", "line": L(WRI, 19, "Thank you for your offer")},
        {"condition": "later e-mails", "text": "Thank you for your reply and for the step you have taken.", "line": L(WRI, 21, "Thank you for your reply")},
        {"condition": "move['answers'] (from policy.answers / leader_terms_line / last call)", "text": "each answer sentence, one per line", "line": L(WRI, 23, 'move["answers"]')},
        {"condition": "answer: its latest e-mail asked about volume", "text": src(POL, 506, 507), "line": L(POL, 506, "We can commit to")},
        {"condition": "answer: it asked for faster payment and a sheet pays faster than its reference terms", "text": "We have included faster payment, as you asked.", "line": L(POL, 515, "We have included faster payment")},
        {"condition": "answer: a clause sheet was added", "text": "We are open to a price adjustment clause; one of the packages includes it.", "line": L(POL, 517, "price adjustment clause")},
        {"condition": "answer: trait price_frozen", "text": "We understand that your price is fixed for now, so we have looked at the terms instead.", "line": L(POL, 519, "We understand that your price is fixed")},
        {"condition": "answer: RFQ, a rival claim is used and the leader has better lead time / payment", "text": src(POL, 498), "line": L(POL, 498, "That offer also comes with")},
        {"condition": "answer: RFQ last call", "text": src(POL, 279, 280), "line": L(POL, 279, "Another supplier has agreed")},
        {"condition": "claims present", "text": "(blank line) then 'Our data shows a different picture on some points:' (first e-mail) or 'One more point from our side:' (later), then one claim sentence per line", "line": L(WRI, 26, "Our data shows a different picture")},
        {"condition": "always", "text": "(blank line)", "line": 28},
        {"condition": "more than 1 sheet", "text": src(WRI, 32), "line": L(WRI, 32, "Please find {n} packages below")},
        {"condition": "1 sheet", "text": "Please find our proposal below.", "line": L(WRI, 35, "Please find our proposal below.")},
        {"condition": "dossier cash_need and payment_days negotiable", "text": "If faster payment helps you, we are open to it, as shown in the packages.", "line": L(WRI, 37, "If faster payment helps you")},
        {"condition": "always", "text": "(blank line) We look forward to your reply. (blank line) Kind regards / Purchasing / Hollerau Pumpenwerke GmbH", "line": L(WRI, 38, "We look forward to your reply.")},
        {"condition": "subject", "text": src(WRI, 11, 12), "line": L(WRI, 11, "latest(events)")},
    ],
}

# ---------------------------------------------------------------- issues
out["issues"] = [
    {"title": "Most cases end on the supplier's first final_offer, after 2-5 rounds", "severity": "high",
     "detail": "ready() returns at status final_offer and the engine accepts at once if the sheet passes (by design: pushing past final_offer made suppliers walk). With a low anchor (leverage 0.80 of its quote) and 30 % (or 10 % after a deep drop) steps, suppliers declare final_offer early: in the saved practice runs the closing reason is 'final_offer' for P02, P04, P07, P08, P10, P11 and P18, with scores 0.50-0.86. Only convergence ('within half a percent'), 'agreed' or the auction end other cases. Round count is set by when the supplier calls final_offer, not by our round limit.",
     "file": POL, "line": L(POL, 361, 'status == "final_offer"')},
    {"title": "Ceiling is not recomputed when the term mix changes", "severity": "medium",
     "detail": "side.ceiling is computed in setup for the setup mix. react() (payment ask -> replan; adopting a cheaper alternative sheet) and replan() replace side.mix, but next_price keeps capping with the old ceiling. On a mix that is dearer for us (e.g. faster payment) the old ceiling is too high: we can offer a sheet whose C fails the limit, and an 'agreed' answer then cannot be accepted. On a cheaper mix it caps concessions too early.",
     "file": POL, "line": L(POL, 347, "side.mix = new")},
    {"title": "Ceiling 0.0 means 'no price passes' but is read as 'no cap'", "severity": "medium",
     "detail": "price_ceiling returns None when no price on the mix beats the limit; setup stores 0.0 and next_price uses `if side.ceiling:` and `side.ceiling or math.inf`, so the price is not capped at all. The accept check still blocks a bad accept, but the engine negotiates rounds that cannot end in an acceptable deal, then walks.",
     "file": POL, "line": L(POL, 398, "if side.ceiling")},
    {"title": "C_open becomes infinite when the opening quote breaks a must-have", "severity": "medium",
     "detail": "setup() only counts openings that keep the must-haves. If none does, c_open = inf, limit = min(C_alt, inf) and ceiling = inf: no price cap and any must-have-keeping sheet below C_alt passes. The arena still scores against the opening's C: in runs/P10 the engine logged 'below the limit inf' while the arena's c_open was 1,932,492. A deal above the arena's C_open would score 0.",
     "file": POL, "line": L(POL, 98, "self.c_open = min(costs, default=self.c_open)")},
    {"title": "Naive fallback accepts without any check", "severity": "medium",
     "detail": "If the engine raises and the LLM call fails (timeout, bad JSON) or its reply fails the guard, NaiveAgent.decide moves. It accepts at agreed, final_offer, no moves left or within 1 % with no must-have and no alternative check. A broken must-have scores 0.",
     "file": NAI, "line": L(NAI, 36, 'if latest(events).get("status") in {"agreed", "final_offer"}')},
    {"title": "LLM fallback can miss the 60 s window", "severity": "medium",
     "detail": "anthropic.Anthropic(timeout=45.0) keeps the SDK default max_retries=2, which retries timeouts, 429 and 5xx. One fallback move can take ~3 x 45 s plus backoff; max_tokens is 16000. A late message counts as a timeout. CLAUDE.md asks for <= 30 s. Only on the exception path.",
     "file": LLM, "line": L(LLM, 60, "anthropic.Anthropic(timeout=45.0)")},
    {"title": "procudeal needs LLM_MODEL set although the engine never calls a model", "severity": "medium",
     "detail": "agent_factory always calls llm_from_env(), which reads os.environ['LLM_MODEL'] with no default. Without it the runner stops with KeyError before the first case, including the Live Final runner.",
     "file": CLI, "line": L(CLI, 43, "complete = llm_from_env()")},
    {"title": "A partial setup failure sends every later move to the LLM", "severity": "medium",
     "detail": "setup() fills self.sides one supplier at a time. If new_side raises for the 2nd supplier, self.sides is non-empty, so setup never reruns and observe(self.sides[sid]) raises KeyError on every move: the whole case runs on the kit LLM fallback.",
     "file": POL, "line": L(POL, 156, "if not self.sides")},
    {"title": "RFQ rival claim can cite a higher price", "severity": "medium",
     "detail": "For a non-leader the cited rival is the leader in C, whatever its unit price. If the leader wins on terms but quotes a higher unit price, the e-mail says 'Another supplier has offered EUR x' with x above the addressee's own price, which reveals a weaker number. leader_terms_line adds words only for lead time and payment days.",
     "file": POL, "line": L(POL, 526, "rival = leader if leader")},
    {"title": "RFQ threads are served one at a time while every thread's clock runs", "severity": "medium",
     "detail": "play() is single-threaded per case and each send blocks until that supplier replies (up to about a minute). The 60 s clock runs per thread from the supplier's reply (api.md:75), and the engine has no per-thread elapsed time. With 2-3 bidders and slow replies, the leader can wait through several auction calls before the accept arrives. No timeouts are seen in the saved practice runs (fast replies), but final latency is unknown.",
     "file": PLAY, "line": L(PLAY, 167, "reply = table.send(sid, msg)")},
    {"title": "Third talk list can counter a supplier at final_offer", "severity": "low",
     "detail": "If no thread that is not ready has moves left and nothing passes yet (e.g. RFQ: A at final_offer above the limit, B open on its last message), `talk = [s for s in live if moves_left > 0]` includes ready threads, so the engine may send a counter to a final_offer supplier, which the team found makes suppliers walk.",
     "file": POL, "line": L(POL, 219, "talk = [s for s in live if moves_left")},
    {"title": "Last-move accept wastes the 10th message and mislabels the reason", "severity": "low",
     "detail": "ready() fires at moves_left <= 1, so at most 9 counters are sent per thread (the arena allows accept after the round limit). The reason is `status or \"last move\"`, which is 'open' for an open thread, so the trace reads 'open; C ...'.",
     "file": POL, "line": L(POL, 362, 'return status or "last move"')},
    {"title": "Last-call text says the rival 'agreed' even when it did not", "severity": "low",
     "detail": "The fixed text 'Another supplier has agreed to terms that cost us less overall' is sent whenever the leader is ready, which also covers final_offer, within 0.5 %, last move and the health price; after the first call the leader may be the previous runner-up that never agreed.",
     "file": POL, "line": L(POL, 279, "Another supplier has agreed")},
    {"title": "Auction only tries the cheapest runner-up", "severity": "low",
     "detail": "If last_call_offer returns None for the cheapest runner (no equal-cost price, or a must-have broken), no other runner is tried; with no earlier call the leader is accepted at once.",
     "file": POL, "line": L(POL, 252, "runner = min(runners")},
    {"title": "C_open and later C use different supplier estimates", "severity": "low",
     "detail": "c_open is fixed in setup with the setup estimate; later accept checks use the current estimate, which changes (bound_full_cost lowers full_cost each reply; a payment ask raises interest_rate). Only stabilise / secure_supply cases are affected (relationship charge).",
     "file": POL, "line": L(POL, 169, "eco.accept_check(self.case, terms, side.standard, side.estimate(), self.c_open)")},
    {"title": "Equal-cost sheets ignore the relationship charge", "severity": "low",
     "detail": "c_main = total_cost(case, main, std) without the estimate, so in strategic cases the 'equal cost' alternatives are not equal for us once the health charge counts; the 0.995 x best_for_us floor filter only removes the cheapest ones.",
     "file": POL, "line": L(POL, 408, "c_main = total_cost(case, main, std)")},
    {"title": "No-price quote gives a EUR 0.01 first offer", "severity": "low",
     "detail": "If its quote has no unit_price, anchor = 0 x ratio = 0 and side.theirs starts at inf, so next_price returns max(0, 0.01) = 0.01.",
     "file": POL, "line": L(POL, 126, "anchor = (q_eq or quote.get"), },
    {"title": "Dead code and unused signals", "severity": "low",
     "detail": "DONE (policy.py:38) is never used; remember_prices runs every move but _sheet_price is never called; Dossier.wants_work, capacity_full and notes are computed but never read, so 'looks for work' or 'capacity full' have no effect on the offer.",
     "file": POL, "line": L(POL, 549, "def _sheet_price")},
    {"title": "Run files contain Infinity", "severity": "low",
     "detail": "bench.py writes json.dumps(..., default=str) with allow_nan on, so an infinite ceiling is saved as Infinity (all runs/P10 files). JavaScript JSON.parse rejects it; the web loader must sanitise.",
     "file": BENCH, "line": L(BENCH, 71, "json.dumps(record")},
    {"title": "closing_move ignores C_open and the relationship charge", "severity": "low",
     "detail": "At the wave cap the runner accepts any must-have-keeping sheet with C < C_alt, priced without the supplier estimate. A deal above C_open scores 0, and in strategic cases a squeeze deal can cost more than it shows. Only in the Live Final.",
     "file": PLAY, "line": L(PLAY, 135, "must_haves_ok(case, terms, std) and (c := total_cost(case, terms, std)) < c_alt")},
]

dest = ROOT / "web/src/data/demo/code.json"
dest.parent.mkdir(parents=True, exist_ok=True)
dest.write_text(json.dumps(out, indent=1, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")
print("wrote", dest, len(out["stages"]), "stages", len(out["issues"]), "issues")
