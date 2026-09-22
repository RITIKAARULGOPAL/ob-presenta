#!/usr/bin/env python3
"""Verify the template-system workbook against the codebase and against itself.

    python3 docs/template-system/verify.py

Exits non-zero on the first failure, so it can gate a commit.

The checks that matter most are 2, 3 and 7. Two of them keep the content
honest against real code — a layout or pillar id that does not exist would
make the rules engine emit a slide Presenta cannot render. The third re-runs
the rules and compares them to the worked examples, which is what stops the
examples from becoming an aspirational description of a system that does not
behave that way.
"""

import csv
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import model_slides as MS
import model_typology as MT
import model_rules as MR

from openpyxl import load_workbook

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
XLSX = os.path.join(HERE, "presenta-slide-template-system.xlsx")
DATA = os.path.join(HERE, "data")
IMG = os.path.join(REPO, "public", "template-library")

SLIDES = [dict(zip(MS.FIELDS, r)) for r in MS.SLIDE_ROWS]
IDS = {s["id"] for s in SLIDES}

fails, checks = [], 0


def check(name, ok, detail=""):
    global checks
    checks += 1
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f"  — {detail}" if detail else ""))
    if not ok:
        fails.append(name)


def read_csv(name):
    with open(os.path.join(DATA, f"{name}.csv"), encoding="utf-8") as f:
        return list(csv.reader(f))


# --- 1 · workbook structure ------------------------------------------------
print("\n1 · Workbook structure")
wb = load_workbook(XLSX, read_only=True)
check("13 tabs present", len(wb.sheetnames) == 13, f"{len(wb.sheetnames)}: {wb.sheetnames}")
check("README is the first tab", wb.sheetnames[0].startswith("00"), wb.sheetnames[0])
lib = wb["04 Slide Library"]
check("Slide Library has one row per slide", lib.max_row - 2 == len(SLIDES),
      f"{lib.max_row - 2} rows vs {len(SLIDES)} slides")
for tab, expect in (("05 Slide x Typology", len(SLIDES)), ("06 Slide x Concept", len(SLIDES)),
                    ("07 Slide x Pillar", len(SLIDES))):
    check(f"{tab} has one row per slide", wb[tab].max_row - 2 == expect,
          f"{wb[tab].max_row - 2}")
wb.close()

# --- 2 · layouts and styles exist in the real code -------------------------
print("\n2 · Layouts and styles resolve against src/types/slide.ts")
src = open(os.path.join(REPO, "src", "types", "slide.ts"), encoding="utf-8").read()
layouts = set(re.findall(r"'([a-z-]+)'",
                         src.split("export type SlideLayout =")[1].split(";")[0]))
styles = set(re.findall(r"'([a-z-]+)'",
                        src.split("export type SlideStyleKind =")[1].split(";")[0]))
used_l = {s["layout"] for s in SLIDES}
used_s = {s["style"] for s in SLIDES}
check("every layout is a real SlideLayout", used_l <= layouts,
      f"unknown: {sorted(used_l - layouts)}" if used_l - layouts else f"{len(used_l)} used of {len(layouts)}")
check("every style is a real SlideStyleKind", used_s <= styles,
      f"unknown: {sorted(used_s - styles)}" if used_s - styles else f"{len(used_s)} used of {len(styles)}")
unused = sorted(layouts - used_l)
print(f"         (layouts the library never uses: {unused or 'none'})")

# --- 3 · pillar and concept ids resolve ------------------------------------
print("\n3 · Pillar and concept ids resolve against src/lib/conceptLibrary.ts")
cl = open(os.path.join(REPO, "src", "lib", "conceptLibrary.ts"), encoding="utf-8").read()
pillar_ids, concept_ids = set(), set()
for block in cl.split("    id: '")[1:]:
    pass
# Pillars declare `id: 'x'` at 4-space indent; concepts at 8-space.
pillar_ids = set(re.findall(r"^    id: '([a-z0-9-]+)',", cl, flags=re.M))
concept_ids = set(re.findall(r"^        id: '([a-z0-9-]+)',", cl, flags=re.M))
bad_p = {s["pillar"] for s in SLIDES if s["pillar"]} - pillar_ids
bad_c = set()
for s in SLIDES:
    for c in (s["concepts"] or "").split():
        if c not in concept_ids:
            bad_c.add(f"{s['id']}:{c}")
check("every pillar id exists", not bad_p, f"unknown: {sorted(bad_p)}" if bad_p else
      f"{len({s['pillar'] for s in SLIDES if s['pillar']})} of {len(pillar_ids)} pillars referenced")
check("every concept id exists", not bad_c, f"unknown: {sorted(bad_c)}" if bad_c else
      f"{len(concept_ids)} concepts available")

# --- 4 · cross-tab referential integrity -----------------------------------
print("\n4 · Cross-tab referential integrity")
for tab, col in (("slide_x_typology", 0), ("slide_x_concept", 0), ("slide_x_pillar", 0),
                 ("image_library", 0)):
    rows = read_csv(tab)[1:]
    unknown = {r[col] for r in rows if r and r[col] and not r[col].startswith(("GRADE", "MISSING"))} - IDS
    check(f"{tab}: every slide_id is in the library", not unknown,
          f"unknown: {sorted(unknown)}" if unknown else f"{len(rows)} rows")
ex_rows = read_csv("example_decks")[1:]
unknown = {r[4] for r in ex_rows if len(r) > 4 and r[4]} - IDS
check("example_decks: every slide_id is in the library", not unknown, sorted(unknown) or "ok")

# --- 5 · every indexed file exists and is non-empty ------------------------
print("\n5 · Image library files exist on disk")
rows = read_csv(os.path.join("..", "..", "..", "public", "template-library", "_index")
                ) if False else None
with open(os.path.join(IMG, "_index.csv"), encoding="utf-8") as f:
    idx = list(csv.reader(f))[1:]
missing, empty = [], []
for r in idx:
    if r[2] == "photo-slot":
        continue
    p = os.path.join(IMG, r[3])
    if not os.path.exists(p):
        missing.append(r[3])
    elif os.path.getsize(p) == 0:
        empty.append(r[3])
check("no missing files", not missing, f"missing: {missing[:5]}" if missing else
      f"{len([r for r in idx if r[2] != 'photo-slot'])} asset rows")
check("no zero-byte files", not empty, f"empty: {empty[:5]}" if empty else "ok")
slots = [r for r in idx if r[2] == "photo-slot"]
check("every photo-slot row has no file (it is a spec, not an asset)",
      all(not r[3] for r in slots), f"{len(slots)} photo slots specified")

# --- 6 · the special-space guard actually holds ----------------------------
print("\n6 · Typology-gated spaces stay out of the wrong decks")
leaks = []
for sid, owners in MR.SPECIAL_SPACES.items():
    s = next(x for x in SLIDES if x["id"] == sid)
    for t in MT.TYPOLOGIES:
        lvl = MR.resolve(s, typology=t["id"], concepts=[c["id"] for c in MT.CONCEPTS])
        if t["id"] not in owners and lvl != "X":
            leaks.append(f"{sid} leaked into {t['id']} as {lvl}")
check("no special space leaks into a typology that does not own it", not leaks,
      "; ".join(leaks[:3]) if leaks else
      f"{len(MR.SPECIAL_SPACES)} gated spaces x {len(MT.TYPOLOGIES)} typologies, all 12 concepts applied")

# --- 7 · the rules re-derive the example decks -----------------------------
print("\n7 · Tab 09 is reproducible from tab 08 (rules re-derive the examples)")
written = {}
cur = None
for r in ex_rows:
    if r[0]:
        cur = r[0]
        written[cur] = []
    elif cur and len(r) > 4 and r[4]:
        written[cur].append(r[4])
for ex in MR.EXAMPLE_DECKS:
    deck = [s["id"] for s, _ in MR.build_deck(SLIDES, ex["typology"], ex["concepts"],
                                              ex["grade"], ex["scale"], ex["nature"])]
    check(f"{ex['id']} {ex['label']}", deck == written.get(ex["id"]),
          f"{len(deck)} slides" if deck == written.get(ex["id"])
          else f"rules {len(deck)} vs sheet {len(written.get(ex['id'], []))}")

# --- 8 · deck lengths actually differentiate -------------------------------
print("\n8 · Typology genuinely changes the deck")
lens = {}
SC = {v: f"SC{i+1}" for i, v in enumerate(
    [a for a in MT.AXES if a["axis_id"] == "C"][0]["values"])}
NA = {v: f"N{i+1}" for i, v in enumerate(
    [a for a in MT.AXES if a["axis_id"] == "D"][0]["values"])}
GR = {g["name"]: g["id"] for g in MT.GRADES}
for t in MT.TYPOLOGIES:
    lens[t["short"]] = len(MR.build_deck(SLIDES, t["id"], [], GR[t["default_grade"]],
                                         SC[t["default_scale"]], NA[t["default_nature"]]))
lo, hi = min(lens.values()), max(lens.values())
check("shortest and longest default decks differ by >= 25%", hi >= lo * 1.25,
      f"{lo} ({min(lens, key=lens.get)}) .. {hi} ({max(lens, key=lens.get)})")
identical = len(set(lens.values()))
check("at least 8 distinct default deck lengths", identical >= 8,
      f"{identical} distinct lengths across {len(lens)} typologies")

# ---------------------------------------------------------------------------
print(f"\n{'=' * 62}")
if fails:
    print(f"FAILED {len(fails)} of {checks} checks:")
    for f in fails:
        print(f"  - {f}")
    sys.exit(1)
print(f"All {checks} checks passed.")
