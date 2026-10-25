"""Rebuild the homepage's final-run figures from the saved arena log."""

import ast
import hashlib
import json
import re
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
source = ROOT / "starter-kit/logs/final.log"
text = source.read_text()
waves = []
case_waves = {}
for line in text.splitlines():
    if match := re.search(r"wave (\d+) started: (.+)", line):
        waves.append({"number": int(match[1]), "name": match[2]})
    if match := re.search(r"setup (case:H\d+):", line):
        case_waves[match[1]] = waves[-1]["number"]

cases = []
for match in re.finditer(r"(case:H\d+) (\{'deal': .*?'score': [\d.e+-]+\})", text):
    result = ast.literal_eval(match[2])
    opening = int(Decimal(str(result["c_open"])) * 100)
    agreed = None if result["c_deal"] is None else int(Decimal(str(result["c_deal"])) * 100)
    cases.append({"id": match[1], "wave": case_waves[match[1]],
                  "openingCents": opening, "agreedCents": agreed})

assert len(cases) == len(case_waves) == len({c["id"] for c in cases}) == 30
assert len(waves) == 5
deals = [c for c in cases if c["agreedCents"] is not None]
opening = sum(c["openingCents"] for c in deals)
agreed = sum(c["agreedCents"] for c in deals)
for wave in waves:
    members = [c for c in cases if c["wave"] == wave["number"]]
    closed = [c for c in members if c["agreedCents"] is not None]
    wave.update(cases=len(members), deals=len(closed),
                savingsCents=sum(c["openingCents"] - c["agreedCents"] for c in closed))

output = {"source": str(source.relative_to(ROOT)),
          "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
          "caseCount": len(cases), "dealCount": len(deals),
          "openingCents": opening, "agreedCents": agreed,
          "savingsCents": opening - agreed, "waves": waves, "cases": cases}
(ROOT / "web/src/data/final-run.json").write_text(json.dumps(output, indent=2) + "\n")
print(json.dumps({k: v for k, v in output.items() if k != "cases"}, indent=2))
