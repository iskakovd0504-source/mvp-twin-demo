#!/usr/bin/env python3
"""QC mock.json vs app.js / index.html. Only stdlib. Exit 0=PASS, 1=FAIL."""
import json, re, sys
from pathlib import Path

WEB = Path(__file__).resolve().parent
MOCK_P = WEB / "mock.json"
APP_P = WEB / "app.js"
HTML_P = WEB / "index.html"

checks = []  # (name, ok, detail)

def check(name, ok, detail=""):
    checks.append((name, bool(ok), detail))

# 1. mock.json valid + parse
try:
    mock = json.loads(MOCK_P.read_text(encoding="utf-8"))
    check("mock.json valid JSON", True, f"{len(MOCK_P.read_text(encoding='utf-8').splitlines())} lines")
except Exception as e:
    mock = None
    check("mock.json valid JSON", False, str(e))

# 2. top-level keys read by app.js (statically derived from init()/updateCounts()/daily)
TOP_KEYS = ["objects", "objData", "object", "estimate", "tasks", "equipment",
            "networks", "floorBase", "plots", "parcel", "river", "roles",
            "docs", "sales", "savings", "sensors", "appeals", "feed"]
if mock is not None:
    for k in TOP_KEYS:
        check(f"top key '{k}'", k in mock, "" if k in mock else "missing")

# 3. cross-check: tokens MOCK.<key> found in app.js must exist in mock.json
if mock is not None:
    app = APP_P.read_text(encoding="utf-8")
    tokens = set(re.findall(r"MOCK\.([A-Za-z0-9_]+)", app))
    # filter JS builtins accidentally matched (none expected, but be safe)
    for tok in sorted(tokens):
        if tok in ("then",):
            continue
        check(f"app.js uses MOCK.{tok}", tok in mock, "" if tok in mock else "app.js reads it, mock lacks it")

# 4. objects gk/school/kinder structure
if mock is not None and "objects" in mock:
    for oid in ["gk", "school", "kinder"]:
        o = (mock.get("objects") or {}).get(oid)
        check(f"objects.{oid} exists", isinstance(o, dict))
        if isinstance(o, dict):
            for f in ["floors", "fh", "w", "d", "billQ", "demoFloors", "demoApt", "ownerLine", "salesLine", "agentOver"]:
                check(f"objects.{oid}.{f}", f in o, "" if f in o else "missing")
            # demoFloors/demoApt sanity
            df = o.get("demoFloors")
            check(f"objects.{oid}.demoFloors non-empty list", isinstance(df, list) and len(df) > 0, str(df))
            da = o.get("demoApt")
            check(f"objects.{oid}.demoApt [floor, apt]", isinstance(da, list) and len(da) == 2, str(da))

# 5. objData school/kinder structure (non-gk branch)
if mock is not None and "objData" in mock:
    for oid in ["school", "kinder"]:
        od = (mock.get("objData") or {}).get(oid)
        check(f"objData.{oid} exists", isinstance(od, dict))
        if isinstance(od, dict):
            for f in ["agentFloor", "lateFloor", "hotFrom", "lateText", "blackout",
                      "meta", "rooms", "estimate", "tasks", "equipment", "networks"]:
                check(f"objData.{oid}.{f}", f in od, "" if f in od else "missing")
            meta = od.get("meta") or {}
            for f in ["name", "address", "cadastre", "status"]:
                check(f"objData.{oid}.meta.{f}", f in meta, "" if f in meta else "missing")
            for arr in ["rooms", "estimate", "tasks", "equipment"]:
                v = od.get(arr)
                check(f"objData.{oid}.{arr} non-empty", isinstance(v, list) and len(v) > 0,
                      f"len={(len(v) if isinstance(v, list) else 'n/a')}")
            nets = od.get("networks") or {}
            for n in ["water", "heat", "power", "vent"]:
                ok = isinstance(nets.get(n), dict) and isinstance((nets.get(n) or {}).get("lines"), list) and len((nets.get(n) or {}).get("lines", [])) > 0
                check(f"objData.{oid}.networks.{n}.lines non-empty", ok)

# 6. gk-branch (object/estimate/tasks/equipment/networks/floorBase)
if mock is not None:
    for f in ["name", "address", "cadastre", "status"]:
        check(f"object.{f}", isinstance(mock.get("object"), dict) and f in mock["object"])
    for arr in ["estimate", "tasks", "equipment", "plots", "docs", "sensors", "appeals", "feed"]:
        v = mock.get(arr)
        check(f"{arr} non-empty array", isinstance(v, list) and len(v) > 0,
              f"len={(len(v) if isinstance(v, list) else 'n/a')}")
    nets = mock.get("networks") or {}
    for n in ["water", "heat", "power", "vent"]:
        ok = isinstance(nets.get(n), dict) and isinstance((nets.get(n) or {}).get("lines"), list) and len((nets.get(n) or {}).get("lines", [])) > 0
        check(f"networks.{n}.lines non-empty", ok)
    fb = mock.get("floorBase") or {}
    for f in ["concrete", "rebar", "facade", "pipes", "cable", "cost"]:
        check(f"floorBase.{f}", f in fb, "" if f in fb else "missing")
    for f in ["cadastre", "area", "status", "trees"]:
        check(f"parcel.{f}", isinstance(mock.get("parcel"), dict) and f in mock["parcel"])
    for f in ["name", "level", "forecast", "sensor"]:
        check(f"river.{f}", isinstance(mock.get("river"), dict) and f in mock["river"])
    for f in ["heatPct", "heatBase", "pumpAvoid"]:
        check(f"savings.{f}", isinstance(mock.get("savings"), dict) and f in mock["savings"])
    roles = mock.get("roles") or {}
    for r in ["dev", "gos", "inv", "own"]:
        ok = isinstance(roles.get(r), dict) and isinstance((roles.get(r) or {}).get("kpi"), list) and len((roles.get(r) or {}).get("kpi", [])) > 0
        check(f"roles.{r}.kpi non-empty", ok)
    sales = mock.get("sales") or {}
    check("sales.apt.total/sold", isinstance((sales.get("apt") or {}).get("total"), int) and isinstance((sales.get("apt") or {}).get("sold"), int))

# 7. referential integrity: tasks eq -> equipment id, tasks net -> networks key
if mock is not None:
    eq_ids = {e.get("id") for e in (mock.get("equipment") or []) if isinstance(e, dict)}
    for od in ["school", "kinder"]:
        for e in (((mock.get("objData") or {}).get(od) or {}).get("equipment") or []):
            if isinstance(e, dict) and e.get("id"):
                eq_ids.add(e["id"])
    net_keys = {"water", "heat", "power", "vent"}
    def check_tasks(tasks, label):
        for t in (tasks or []):
            if not isinstance(t, dict):
                check(f"{label} task shape", False, str(t)[:60]); continue
            for f in ["id", "text", "due"]:
                check(f"{label} task {t.get('id','?')}.{f}", f in t, "" if f in t else "missing")
            if "eq" in t:
                check(f"{label} task {t.get('id')} eq '{t.get('eq')}' exists", t["eq"] in eq_ids,
                      "" if t["eq"] in eq_ids else f"unknown eq, known={sorted(eq_ids)}")
            if "net" in t:
                check(f"{label} task {t.get('id')} net '{t.get('net')}' known", t["net"] in net_keys)
    check_tasks(mock.get("tasks"), "tasks")
    for od in ["school", "kinder"]:
        check_tasks((((mock.get("objData") or {}).get(od) or {}).get("tasks")), f"objData.{od}.tasks")
    # equipment net refs
    for e in (mock.get("equipment") or []):
        if isinstance(e, dict) and "net" in e:
            check(f"equipment {e.get('id')} net known", e["net"] in net_keys)

# 8. counters/arrays not empty where UI counts them: estimate done/plan numbers, sensors flag, appeals count
if mock is not None:
    for e in (mock.get("estimate") or []):
        ok = isinstance(e, dict) and isinstance(e.get("done"), (int, float)) and isinstance(e.get("sum"), (int, float))
        check(f"estimate '{(e.get('stage') if isinstance(e, dict) else '?')}' done/sum numbers", ok)
        break  # one representative + full loop below counts
    bad_est = [e.get("stage", "?") for e in (mock.get("estimate") or []) if not (isinstance(e, dict) and isinstance(e.get("done"), (int, float)) and isinstance(e.get("sum"), (int, float)))]
    if bad_est:
        check("estimate all rows numeric", False, str(bad_est))

# 9. index.html referenced local paths exist
html = HTML_P.read_text(encoding="utf-8")
# local src/href (skip http:, data:, #, importmap URLs inside JSON-ish script)
refs = set()
for m in re.finditer(r'''(?:src|href)\s*=\s*["']([^"'#]+)["']''', html):
    u = m.group(1).strip()
    if u.startswith(("http:", "https:", "data:", "blob:")):
        continue
    u = u.split("?")[0].split("#")[0]
    if not u:
        continue
    refs.add(u)
# fetch('...') in app.js (local json)
app_txt = APP_P.read_text(encoding="utf-8")
for m in re.finditer(r'''fetch\(\s*["']([^"'?#]+)''', app_txt):
    u = m.group(1).strip()
    if u.startswith(("http:", "https:", "data:", "blob:")):
        continue
    refs.add(u)
if not refs:
    check("index.html/app.js local refs found", False, "no refs parsed")
for r in sorted(refs):
    # strip leading ./ and /
    p = (WEB / r.lstrip("/")).resolve()
    try:
        inside = p == WEB or WEB in p.parents
    except Exception:
        inside = False
    ok = inside and p.is_file()
    check(f"ref '{r}' exists", ok, "" if ok else f"missing file {p}")

# report
fails = [c for c in checks if not c[1]]
for name, ok, detail in checks:
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail and not ok else ""))
print(f"\n{len(checks)-len(fails)}/{len(checks)} passed")
if fails:
    print("RESULT: FAIL")
    sys.exit(1)
print("RESULT: PASS")
