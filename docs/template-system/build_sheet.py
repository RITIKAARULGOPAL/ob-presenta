#!/usr/bin/env python3
"""Build the Presenta template-system workbook (and a CSV mirror of every tab).

    python3 docs/template-system/build_sheet.py

Outputs
    docs/template-system/presenta-slide-template-system.xlsx   13 tabs
    docs/template-system/data/*.csv                            one per tab

The CSV mirror exists so the rules engine can read the tabs straight from git
without a Drive round-trip, and so a diff of this data is reviewable in a pull
request. The xlsx is what gets uploaded to Drive, where it converts to a
native multi-tab Google Sheet.

Kept in the repo for the same reason as scripts/gen_ecom_elements.py: the
output is generated, so the generator is the thing worth reviewing.
"""

import csv
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import model_slides as MS
import model_typology as MT
import model_rules as MR

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
DATA = os.path.join(HERE, "data")
XLSX = os.path.join(HERE, "presenta-slide-template-system.xlsx")
IMAGE_INDEX = os.path.join(REPO, "public", "template-library", "_index.csv")

SLIDES = [dict(zip(MS.FIELDS, r)) for r in MS.SLIDE_ROWS]
BY_ID = {s["id"]: s for s in SLIDES}
SECTION_NAME = {code: name for code, name, _ in MS.SECTIONS}

# Axis-value -> rule-key lookups, so a typology's declared defaults can drive
# the engine without a second hand-maintained mapping.
SCALE_KEY = {v: f"SC{i+1}" for i, v in enumerate(
    [a for a in MT.AXES if a["axis_id"] == "C"][0]["values"])}
NATURE_KEY = {v: f"N{i+1}" for i, v in enumerate(
    [a for a in MT.AXES if a["axis_id"] == "D"][0]["values"])}
GRADE_KEY = {g["name"]: g["id"] for g in MT.GRADES}

# --- styling ---------------------------------------------------------------

INK = "1A1A1A"
HEAD_FILL = PatternFill("solid", fgColor=INK)
HEAD_FONT = Font(color="FFFFFF", bold=True, size=10)
TITLE_FONT = Font(bold=True, size=14, color=INK)
WRAP = Alignment(vertical="top", wrap_text=True)
TOP = Alignment(vertical="top")
CENTER = Alignment(horizontal="center", vertical="center")
THIN = Side(style="thin", color="D9D9D9")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

LEVEL_FILL = {
    "M": PatternFill("solid", fgColor="C6E0B4"),   # green  - always in
    "R": PatternFill("solid", fgColor="FFE699"),   # amber  - in by default
    "O": PatternFill("solid", fgColor="F2F2F2"),   # grey   - offered
    "X": PatternFill("solid", fgColor="F8CBAD"),   # orange - excluded
}


def sheet(wb, name, headers, rows, widths=None, freeze="A3", note=None):
    """One tab: a title row, a header row, then data."""
    ws = wb.create_sheet(name[:31])
    ws["A1"] = note or name
    ws["A1"].font = TITLE_FONT
    ws.append([])
    for i, h in enumerate(headers, 1):
        c = ws.cell(row=2, column=i, value=h)
        c.fill, c.font, c.alignment, c.border = HEAD_FILL, HEAD_FONT, CENTER, BOX
    for r in rows:
        ws.append(["" if v is None else v for v in r])
    for row in ws.iter_rows(min_row=3, max_row=ws.max_row, max_col=len(headers)):
        for c in row:
            c.alignment = WRAP
            c.border = BOX
    for i, w in enumerate(widths or [24] * len(headers), 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = freeze
    ws.row_dimensions[2].height = 30
    return ws


def dump_csv(name, headers, rows):
    os.makedirs(DATA, exist_ok=True)
    path = os.path.join(DATA, f"{name}.csv")
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(headers)
        w.writerows(rows)
    return path


def profile_for(t):
    """A typology's own declared defaults, as rule keys."""
    return dict(
        typology=t["id"],
        grade=GRADE_KEY[t["default_grade"]],
        scale=SCALE_KEY[t["default_scale"]],
        nature=NATURE_KEY[t["default_nature"]],
    )


def deck_len(t, concepts=(), include_optional=False):
    p = profile_for(t)
    return len(MR.build_deck(SLIDES, p["typology"], concepts, p["grade"],
                             p["scale"], p["nature"], include_optional))


# ===========================================================================

def main():
    wb = Workbook()
    wb.remove(wb.active)
    tabs = []

    def add(name, headers, rows, widths=None, note=None, csv_name=None):
        sheet(wb, name, headers, rows, widths, note=note)
        dump_csv(csv_name or name.split(" ", 1)[-1].lower().replace(" ", "_")
                 .replace("x_", "x_"), headers, rows)
        tabs.append(name)

    # --- 01 Typologies -----------------------------------------------------
    h = ["ID", "Typology", "Short", "Definition", "Occupancy (axis A)",
         "Sector (axis B)", "Scale (axis C)", "Nature (axis D)", "Grade (axis E)",
         "Signature spaces", "What it drives in the deck", "Audience",
         "Watch out for", "Default deck", "Max available"]
    rows = [[t["id"], t["name"], t["short"], t["definition"], t["default_occupancy"],
             t["default_sector"], t["default_scale"], t["default_nature"],
             t["default_grade"], t["signature_spaces"], t["drives_the_deck"],
             t["audience"], t["watch_out"], deck_len(t), deck_len(t, include_optional=True)]
            for t in MT.TYPOLOGIES]
    add("01 Typologies", h, rows, [6, 30, 16, 52, 18, 20, 18, 18, 16, 44, 44, 26, 44, 10, 10],
        note="01 · Typologies — the 16 labels a project is tagged with. "
             "Deck sizes are computed from the rules, not estimated.",
        csv_name="typologies")

    # --- 02 Typology Axes --------------------------------------------------
    h = ["Axis", "Name", "Question it answers", "Why it matters", "Permitted values"]
    rows = [[a["axis_id"], a["axis"], a["question"], a["why_it_matters"],
             "\n".join(a["values"])] for a in MT.AXES]
    add("02 Typology Axes", h, rows, [6, 22, 40, 60, 38],
        note="02 · Typology axes — the engine's real input schema. A project "
             "carries one value per axis; the typology only pre-fills them.",
        csv_name="typology_axes")

    # --- 03 Design Concepts ------------------------------------------------
    h = ["ID", "Concept", "In one line", "Palette", "Materials", "Lighting",
         "Imagery direction", "Copy tone", "Slides it adds or escalates", "Watch out for"]
    rows = [[c["id"], c["name"], c["one_line"], c["palette"], c["materials"],
             c["lighting"], c["imagery"], c["copy_tone"], c["extra_slides"],
             c["watch_out"]] for c in MT.CONCEPTS]
    rows.append([""] * len(h))
    rows.append(["GRADE MODIFIERS (axis E) — these compose WITH any concept above, "
                 "which is why 'Premium' is not in the list of 12.", "", "", "", "",
                 "", "", "", "", ""])
    for g in MT.GRADES:
        rows.append([g["id"], g["name"], g["cost_framing"], "", g["material_shift"],
                     "", "", "", g["deck_effect"], ""])
    add("03 Design Concepts", h, rows, [6, 24, 44, 34, 40, 32, 38, 34, 44, 44],
        note="03 · Design concepts — 12 character themes, plus the 4 grade "
             "modifiers they compose with.",
        csv_name="design_concepts")

    # --- 04 Slide Library --------------------------------------------------
    h = ["Slide ID", "Section", "Section name", "Slide", "Purpose",
         "Suggested title", "What goes on it", "Presenta layout", "Slide style",
         "Required inputs / assets", "Optional inputs", "Baseline", "Order", "Notes"]
    rows = [[s["id"], s["section"], SECTION_NAME[s["section"]], s["name"],
             s["purpose"], s["title"], s["content"], s["layout"], s["style"],
             s["required_inputs"], s["optional_inputs"], s["baseline"], i + 1,
             s["notes"]] for i, s in enumerate(SLIDES)]
    ws = sheet(wb, "04 Slide Library", h, rows,
               [9, 8, 22, 28, 56, 26, 56, 16, 14, 34, 32, 9, 7, 56],
               note="04 · Slide library — the master catalogue. Every 'Presenta "
                    "layout' is a real SlideLayout from src/types/slide.ts.")
    for r in range(3, ws.max_row + 1):
        ws.cell(row=r, column=12).fill = LEVEL_FILL.get(ws.cell(row=r, column=12).value)
        ws.cell(row=r, column=12).alignment = CENTER
    dump_csv("slide_library", h, rows)
    tabs.append("04 Slide Library")

    # --- 05 Slide x Typology ----------------------------------------------
    h = ["Slide ID", "Slide", "Section", "Baseline"] + [t["short"] for t in MT.TYPOLOGIES] + ["Universal?"]
    rows = []
    for s in SLIDES:
        cells = [MR.resolve(s, typology=t["id"]) for t in MT.TYPOLOGIES]
        universal = "Yes - common to all" if all(c == "M" for c in cells) else (
            "Typology-specific" if "X" in cells else "Varies by level")
        rows.append([s["id"], s["name"], SECTION_NAME[s["section"]], s["baseline"]]
                    + cells + [universal])
    ws = sheet(wb, "05 Slide x Typology", h, rows,
               [9, 28, 20, 9] + [7] * len(MT.TYPOLOGIES) + [18],
               note="05 · Slide × typology. M=mandatory R=recommended O=optional "
                    "X=excluded. Typology only — concept, grade, scale and nature "
                    "are applied on top (see 08 Rules).")
    for r in range(3, ws.max_row + 1):
        for c in range(5, 5 + len(MT.TYPOLOGIES)):
            cell = ws.cell(row=r, column=c)
            cell.fill = LEVEL_FILL.get(cell.value, LEVEL_FILL["O"])
            cell.alignment = CENTER
    dump_csv("slide_x_typology", h, rows)
    tabs.append("05 Slide x Typology")

    # --- 06 Slide x Concept -----------------------------------------------
    h = ["Slide ID", "Slide", "Baseline"] + [c["name"] for c in MT.CONCEPTS] + ["How the content shifts"]
    rows = []
    for s in SLIDES:
        cells, notes = [], []
        for c in MT.CONCEPTS:
            cells.append(MR.resolve(s, concepts=[c["id"]]))
            n = MR.CONCEPT_RULES.get(c["id"], {}).get("notes", {}).get(s["id"])
            if n:
                notes.append(f"{c['name']}: {n}")
        rows.append([s["id"], s["name"], s["baseline"]] + cells + ["\n".join(notes)])
    ws = sheet(wb, "06 Slide x Concept", h, rows,
               [9, 28, 9] + [13] * len(MT.CONCEPTS) + [70],
               note="06 · Slide × design concept. A concept can only ESCALATE a "
                    "slide — it never excludes one, because relevance belongs to "
                    "the project, not to the design language.")
    for r in range(3, ws.max_row + 1):
        for c in range(4, 4 + len(MT.CONCEPTS)):
            cell = ws.cell(row=r, column=c)
            cell.fill = LEVEL_FILL.get(cell.value, LEVEL_FILL["O"])
            cell.alignment = CENTER
    dump_csv("slide_x_concept", h, rows)
    tabs.append("06 Slide x Concept")

    # --- 07 Slide x Pillar -------------------------------------------------
    h = ["Slide ID", "Slide", "Pillar ID (conceptLibrary.ts)", "Concept IDs within pillar",
         "How to use it"]
    def how_to_use(s):
        # A divider is identified by what it IS, not by having no concept ids —
        # several real content slides (e.g. S033 Existing Condition Survey) sit
        # under a pillar without mapping to any single concept in it.
        if s["name"].startswith("Section Divider"):
            return "Section divider — use pillarSectionSlide() for this pillar."
        if s["concepts"]:
            return ("Prefill this slide's lead and points from CONCEPT_DETAIL "
                    "for these concept ids.")
        if s["pillar"]:
            return ("Sits under this pillar but maps to no single concept — "
                    "use the pillar for grouping only.")
        return "No framework mapping — project content only."

    rows = [[s["id"], s["name"], s["pillar"], s["concepts"], how_to_use(s)]
            for s in SLIDES]
    add("07 Slide x Pillar", h, rows, [9, 30, 26, 40, 56],
        note="07 · Slide × the shipped 12-pillar framework in "
             "src/lib/conceptLibrary.ts, so the existing concept library plugs "
             "into these templates unchanged.",
        csv_name="slide_x_pillar")

    # --- 08 Rules ----------------------------------------------------------
    h = ["Rule ID", "Priority", "When (condition)", "Operation", "Slides", "Why"]
    rows = []
    rows.append(["R000", 0, "always", "baseline",
                 "see 04 Slide Library, column 'Baseline'",
                 "Start from each slide's own default level."])
    for sid, owners in sorted(MR.SPECIAL_SPACES.items()):
        rows.append([f"R0{sid[1:]}", 1, f"slide = {sid}", "X unless owned",
                     "; ".join(f"{t}={lvl}" for t, lvl in owners.items()),
                     f"{BY_ID[sid]['name']} exists only in these typologies; excluded everywhere else."])
    for tid, rule in MR.TYPOLOGY_RULES.items():
        for op in ("X", "down", "M", "R", "O"):
            if rule.get(op):
                rows.append([f"R1-{tid}-{op}", 2, f"typology = {tid}", op,
                             " ".join(rule[op]), rule["why"]])
    for nid, rule in MR.NATURE_RULES.items():
        for op in ("X", "down", "M", "R", "O"):
            if rule.get(op):
                rows.append([f"R2-{nid}-{op}", 3, f"nature = {nid}", op,
                             " ".join(rule[op]), rule["why"]])
    for cid, rule in MR.CONCEPT_RULES.items():
        for op in ("M", "R", "O"):
            if rule.get(op):
                rows.append([f"R3-{cid}-{op}", 4, f"concept includes {cid}", op,
                             " ".join(rule[op]),
                             f"{[c['name'] for c in MT.CONCEPTS if c['id']==cid][0]} needs these slides to carry its evidence."])
    for gid, rule in MR.GRADE_RULES.items():
        for op in ("X", "down", "M", "R", "O"):
            if rule.get(op):
                rows.append([f"R4-{gid}-{op}", 5, f"grade = {gid}", op,
                             " ".join(rule[op]), rule["why"]])
    for scid, rule in MR.SCALE_RULES.items():
        for op in ("X", "down", "M", "R", "O"):
            if rule.get(op):
                rows.append([f"R5-{scid}-{op}", 6, f"scale = {scid}", op,
                             " ".join(rule[op]), rule["why"]])
    rows.append(["R900", 99, "after all rules", "resolve",
                 "MAX(level) wins; X from typology or nature is final",
                 "Exclusion is sticky so a design concept can never pull an "
                 "irrelevant space into a deck. Escalation beats demotion so a "
                 "concept can re-earn a slide the typology trimmed."])
    add("08 Rules", h, rows, [16, 9, 30, 14, 62, 62],
        note="08 · The rules, machine-readable. Tabs 05, 06 and 09 are RENDERED "
             "from these — edit here, not there.",
        csv_name="rules")

    # --- 09 Example Decks --------------------------------------------------
    h = ["Example", "Combination", "Profile", "#", "Slide ID", "Slide", "Section",
         "Level", "Presenta layout", "Why it is in this deck"]
    rows = []
    for ex in MR.EXAMPLE_DECKS:
        deck = MR.build_deck(SLIDES, ex["typology"], ex["concepts"], ex["grade"],
                             ex["scale"], ex["nature"])
        prof = (f"{ex['typology']} + {'/'.join(ex['concepts'])} + {ex['grade']} "
                f"+ {ex['scale']} + {ex['nature']}")
        rows.append([ex["id"], ex["label"], prof, len(deck), "", "", "", "", "", ex["story"]])
        for i, (s, lvl) in enumerate(deck, 1):
            reasons = []
            if s["id"] in MR.SPECIAL_SPACES:
                reasons.append(f"space owned by {ex['typology']}")
            for op in ("M", "R"):
                if s["id"] in MR.TYPOLOGY_RULES.get(ex["typology"], {}).get(op, ()):
                    reasons.append(f"{ex['typology']} raises to {op}")
                for cid in ex["concepts"]:
                    if s["id"] in MR.CONCEPT_RULES.get(cid, {}).get(op, ()):
                        reasons.append(f"{cid} raises to {op}")
                if s["id"] in MR.GRADE_RULES.get(ex["grade"], {}).get(op, ()):
                    reasons.append(f"{ex['grade']} raises to {op}")
            if not reasons:
                reasons.append(f"baseline {s['baseline']}")
            rows.append(["", "", "", i, s["id"], s["name"], SECTION_NAME[s["section"]],
                         lvl, s["layout"], "; ".join(reasons)])
        rows.append([""] * len(h))
    add("09 Example Decks", h, rows, [9, 30, 34, 5, 9, 28, 20, 7, 16, 44],
        note="09 · The four worked combinations, expanded slide by slide. "
             "Generated by running the rules in tab 08 — not written by hand.",
        csv_name="example_decks")

    # --- 10 Inputs & Assets ------------------------------------------------
    inputs = {}
    for s in SLIDES:
        for field, need in (("required_inputs", "Required"), ("optional_inputs", "Optional")):
            for item in (s[field] or "").split(";"):
                item = item.strip()
                if not item:
                    continue
                rec = inputs.setdefault(item, {"need": need, "slides": []})
                if need == "Required":
                    rec["need"] = "Required"
                rec["slides"].append(s["id"])
    h = ["Input / asset", "Required or optional", "Used by # slides", "Slides", "Supplied by"]

    def supplier(name):
        n = name.lower()
        if any(k in n for k in ("render", "photo", "image", "swatch", "logo", "video")):
            return "Design team / client"
        if any(k in n for k in ("plan", "drawing", "layout", "survey", "programme")):
            return "Design team"
        if any(k in n for k in ("headcount", "attendance", "brief", "brand", "budget",
                                "cost", "data", "guidelines", "figures")):
            return "Client"
        return "Design team"
    rows = [[k, v["need"], len(v["slides"]), " ".join(sorted(v["slides"])), supplier(k)]
            for k, v in sorted(inputs.items(), key=lambda kv: (-len(kv[1]["slides"]), kv[0]))]
    add("10 Inputs & Assets", h, rows, [44, 18, 14, 40, 22],
        note="10 · Every input the engine needs from a project, rolled up across "
             "all 106 slides. This is the collection checklist.",
        csv_name="inputs_and_assets")

    # --- 11 Image Library Index -------------------------------------------
    h = ["Slide ID", "Asset slot", "Kind", "File", "Required", "Ratio", "Min px", "Source"]
    rows = []
    if os.path.exists(IMAGE_INDEX):
        with open(IMAGE_INDEX, encoding="utf-8") as f:
            rows = [r for r in list(csv.reader(f))[1:]]
    add("11 Image Library", h, rows, [9, 28, 16, 46, 10, 10, 10, 34],
        note="11 · The shared image folder at public/template-library/. "
             "kind=photo-slot means no file ships — the project supplies it.",
        csv_name="image_library")

    # --- 12 Layout Coverage ------------------------------------------------
    usage, gaps = {}, {}
    for s in SLIDES:
        usage.setdefault(s["layout"], []).append(s["id"])
        if s["notes"].startswith("GAP:"):
            gaps.setdefault(s["layout"], []).append((s["id"], s["name"], s["notes"]))
    h = ["Presenta layout", "Exists today", "# slides using it", "Slides", "Gap?"]
    rows = []
    for layout in sorted(usage):
        g = gaps.get(layout, [])
        rows.append([layout, "Yes", len(usage[layout]), " ".join(usage[layout]),
                     "" if not g else
                     f"{len(g)} slide(s) forced onto this layout: "
                     + "; ".join(f"{i} {n}" for i, n, _ in g)])
    rows.append([""] * len(h))
    rows.append(["MISSING LAYOUTS — these slides have no adequate layout today", "", "", "", ""])
    for layout, g in sorted(gaps.items()):
        for sid, name, note in g:
            rows.append([f"(currently {layout})", "No", 1, sid, f"{name} — {note[4:].strip()}"])
    add("12 Layout Coverage", h, rows, [22, 14, 16, 52, 74],
        note="12 · Which Presenta layouts the library needs, and the seven "
             "slides with no adequate layout today.",
        csv_name="layout_coverage")

    # --- 00 README (built last, listed first) ------------------------------
    readme = [
        ["Presenta — Typology + Concept-Driven Template Population System", ""],
        ["", ""],
        ["What this is",
         "The content layer for Presenta's template engine: a library of slide "
         "types, a typology model, a design-concept model, and the rules that "
         "turn a project's attributes into one deck."],
        ["How to read it",
         "Start at 01 Typologies and 03 Design Concepts (the two things a user "
         "picks), then 04 Slide Library (what can be generated), then 08 Rules "
         "(how the picks become a deck)."],
        ["", ""],
        ["The one structural decision",
         "'IT', 'GCC', 'Startup' and 'Managed Workspace' are four different KINDS "
         "of thing — a sector, an occupancy model, a company stage and a "
         "real-estate model. So there are 16 typology labels sitting on 5 "
         "independent axes (tab 02). Rules read the axes."],
        ["Why 'Premium' is not a concept",
         "It composes with every character theme — Premium Biophilic and Premium "
         "Industrial are both coherent. It is a grade on axis E (tab 03, lower "
         "block), not a 13th theme."],
        ["", ""],
        ["Level scale", "M = Mandatory, always in the deck"],
        ["", "R = Recommended, in by default, author may remove"],
        ["", "O = Optional, out by default, offered in the picker"],
        ["", "X = Excluded, not offered at all — irrelevant or misleading here"],
        ["", ""],
        ["Resolution order",
         "baseline -> typology -> project nature -> concept -> grade -> scale. "
         "Highest level wins. An X from typology or nature is final; a concept "
         "can re-earn a slide the typology only demoted."],
        ["", ""],
        ["Generated, not hand-filled",
         "Tabs 05, 06, 09 and 12 are rendered from tab 08. Edit the rules, "
         "re-run docs/template-system/build_sheet.py, re-upload. Editing a "
         "matrix cell by hand will be overwritten."],
        ["Source of truth",
         "docs/template-system/*.py in the ob-presenta repo. CSV mirrors of every "
         "tab are in docs/template-system/data/."],
        ["Images", "public/template-library/ — indexed in tab 11."],
        ["", ""],
        ["Counts", f"{len(SLIDES)} slide types · {len(MT.TYPOLOGIES)} typologies · "
                   f"{len(MT.CONCEPTS)} concepts · {len(MT.GRADES)} grades · "
                   f"{len(MT.AXES)} axes · {len(rows)} layout rows"],
    ]
    ws = sheet(wb, "00 README", ["Topic", "Detail"], readme, [34, 104],
               note="00 · README — read this first.")
    wb.move_sheet("00 README", offset=-len(wb.sheetnames) + 1)

    wb.save(XLSX)
    print(f"wrote {XLSX}")
    print(f"tabs ({len(wb.sheetnames)}): {', '.join(wb.sheetnames)}")
    print(f"csv mirror: {DATA}")


if __name__ == "__main__":
    main()
