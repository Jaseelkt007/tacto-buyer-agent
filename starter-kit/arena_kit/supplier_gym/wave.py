"""One scheduled wave over isolated case APIs; the kit's wave runner remains unchanged."""

import itertools
import json
import threading
import time
from contextlib import ExitStack, contextmanager
from copy import deepcopy
from dataclasses import dataclass

import httpx

from ..client import ArenaClient
from ..sim import Sim, create_app
from .sim import GymSim


@dataclass
class WaveSchedule:
    start: float
    cap: float = 480
    clock: object = time.time
    finished: bool = False

    def waves(self):
        now, end = self.clock(), self.start + self.cap
        return [
            {
                "n": 1,
                "theme": "Sunday local practice",
                "opens": self.start,
                "closes": end,
                "started": now >= self.start,
                "running": self.start <= now < end and not self.finished,
                "closed": now >= end or self.finished,
                "seconds_left": 0 if self.finished else max(0, round(end - now)) if now >= self.start else None,
            }
        ]


class WaveGym(GymSim):
    def __init__(self, case, profiles, chooser, schedule, instance, facts=None, on_end=None):
        super().__init__(case, profiles, chooser, facts)
        self.schedule, self.clock, self.no_clock = schedule, schedule.clock, False
        self.ids = itertools.count(instance * 10000 + 1)
        self.rehearsal = (schedule.start, schedule.cap, 0)
        self.final = {case["case_id"]: (1, {**deepcopy(case), "set": "hidden"})}
        self.finished_at, self.on_end = None, on_end

    def waves(self):
        return self.schedule.waves()

    def _answer(self, s, th, msg, sheets):
        reply = super()._answer(s, th, msg, sheets)
        self._capped(s)
        return reply

    def _end(self, s, reason, sup):
        super()._end(s, reason, sup)
        self.finished_at = self.clock()
        if self.on_end:
            self.on_end(s["case"]["case_id"], self.finished_at, s["result"])


class LocalWave:
    def __init__(
        self,
        fixtures,
        new_chooser,
        *,
        cap=480,
        wait=3,
        facts=None,
        clock=time.time,
        on_end=None,
        finish_when_done=False,
    ):
        if not 1 <= len(fixtures) <= 10 or cap <= 0 or wait < 0:
            raise ValueError("one wave requires 1–10 cases, a positive cap and nonnegative wait")
        self.clock, self.wait = clock, wait
        self.schedule = WaveSchedule(clock() + wait, cap, clock)
        self.finish_when_done = finish_when_done
        self.gyms = {
            case["case_id"]: WaveGym(case, profiles, new_chooser(), self.schedule, i, facts, on_end)
            for i, (case, profiles) in enumerate(fixtures)
        }
        if len(self.gyms) != len(fixtures):
            raise ValueError("duplicate case IDs")
        self.coordinator = Sim({}, clock=clock)
        self.coordinator.waves = self.schedule.waves
        self.coordinator.final = {cid: value for gym in self.gyms.values() for cid, value in gym.final.items()}
        self.requests, self._routes, self._lock = [], {}, threading.Lock()

    @contextmanager
    def client(self):
        from fastapi.testclient import TestClient

        with ExitStack() as stack:
            servers = {}
            for cid, sim in [(None, self.coordinator), *self.gyms.items()]:
                sim.teams["local-wave"] = "Local wave"
                servers[cid] = stack.enter_context(TestClient(create_app(sim)))
            # Start only after all HTTP adapters are ready; the runner sees the pre-wave 403.
            self.schedule.start = self.clock() + self.wait
            for gym in self.gyms.values():
                gym.rehearsal = (self.schedule.start, self.schedule.cap, 0)

            def request(req):
                if req.url.host != "supplier-wave.invalid":
                    raise ValueError("wave transport refuses external hosts")
                path = req.url.path
                if (
                    path == "/v1/cases"
                    and self.finish_when_done
                    and all(g.finished_at is not None for g in self.gyms.values())
                ):
                    self.schedule.finished = True
                body = json.loads(req.content) if req.content else {}
                cid = None
                if path == "/v1/sessions" and req.method == "POST":
                    cid = body.get("case_id")
                    if cid not in self.gyms:
                        return httpx.Response(404, json={"detail": "no such case"})
                elif path.startswith("/v1/sessions/"):
                    with self._lock:
                        cid = self._routes.get(path.split("/")[3])
                    if cid is None:
                        return httpx.Response(404, json={"detail": "no such session"})
                elif path != "/v1/cases":
                    return httpx.Response(404, json={"detail": "not exposed by local wave transport"})
                started = self.clock()
                response = servers[cid].request(
                    req.method, req.url.raw_path.decode(), headers=dict(req.headers), content=req.content
                )
                ended = self.clock()
                with self._lock:
                    if path == "/v1/sessions" and response.status_code == 200:
                        self._routes[response.json()["session_id"]] = cid
                    self.requests.append(
                        {
                            "case_id": cid,
                            "method": req.method,
                            "path": path,
                            "started": started,
                            "ended": ended,
                            "status": response.status_code,
                            "supplier_call": path.endswith("/messages") and not body.get("message", {}).get("action"),
                        }
                    )
                return httpx.Response(response.status_code, headers=dict(response.headers), content=response.content)

            client = ArenaClient(
                base_url="http://supplier-wave.invalid", api_key="local-wave", transport=httpx.MockTransport(request)
            )
            try:
                yield client
            finally:
                client.http.close()

    def metrics(self):
        intervals = [r for r in self.requests if r["supplier_call"]]
        events = sorted([(r["started"], 1) for r in intervals] + [(r["ended"], -1) for r in intervals])
        active, peak = 0, 0
        for _, change in events:
            active += change
            peak = max(peak, active)
        finished = [g.finished_at - self.schedule.start for g in self.gyms.values() if g.finished_at is not None]
        return {
            "cap_seconds": self.schedule.cap,
            "completion_mode": "when_done" if self.finish_when_done else "full_clock",
            "closed_early": self.schedule.finished and self.clock() < self.schedule.start + self.schedule.cap,
            "parallel_cases": len(self.gyms),
            "peak_overlapping_supplier_requests": peak,
            "last_case_finished_seconds": round(max(finished), 3) if finished else None,
            "pre_wave_403s": sum(r["status"] == 403 for r in self.requests),
            "http_errors": [
                r for r in self.requests if r["status"] >= 400 and not (r["path"] == "/v1/cases" and r["status"] == 403)
            ],
            "thread_timeouts": sum(
                len(th["late"]) for g in self.gyms.values() for s in g.sessions.values() for th in s["threads"].values()
            ),
            "wave_cap_closures": sum(
                s["end_reason"] == "wave_cap" for g in self.gyms.values() for s in g.sessions.values()
            ),
        }
