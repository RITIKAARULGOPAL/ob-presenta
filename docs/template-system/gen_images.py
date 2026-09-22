#!/usr/bin/env python3
"""Generate public/template-library/ — the shared image folder for the
template system.

    python3 docs/template-system/gen_images.py

What lands there
    diagrams/        18 original diagrams that go ON slides (SVG + PNG)
    concept-boards/  12 palette/material boards, one per design concept
    thumbnails/      one wireframe per slide type, for the template picker
    reference/       the real E-Com Express deck imagery, re-indexed by slide
    brand/           the OB / SKV marks
    _index.csv       every asset, plus a spec row for every photo slot
    README.md

Why it lives under public/ and not docs/: Presenta already serves library
imagery from there (`/concept-library/ecom-express/slide-1.png` in
conceptLibrary.ts), so these paths are usable as `imageUrl` values verbatim.

No photography is fetched. This session's egress policy blocks the stock
image CDNs, and project renders belong to the project anyway — so slides
needing photography get a SPEC row in _index.csv (ratio, minimum pixels,
required or not) rather than a placeholder file pretending to be content.

Chart colours come from the validated categorical palette in the dataviz
skill. Every coloured region is directly labelled, which is what the
palette's contrast warning obligates.
"""

import csv
import os
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import model_slides as MS
import model_typology as MT

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(REPO, "public", "template-library")
CHROME = "/opt/pw-browsers/chromium"

SLIDES = [dict(zip(MS.FIELDS, r)) for r in MS.SLIDE_ROWS]

# Validated categorical palette (light surface). Slots 1-3 are all-pairs safe;
# 4-6 are used only where marks are adjacent AND directly labelled.
P = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"]
INK, MUTED, LINE, SURF = "#1a1a1a", "#6b6b6b", "#d9d9d9", "#fcfcfb"
FONT = "Inter, 'Helvetica Neue', Arial, sans-serif"

W, H = 1600, 900
index_rows = []


# --- svg helpers -----------------------------------------------------------

def svg(body, w=W, h=H):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
            f'viewBox="0 0 {w} {h}"><rect width="{w}" height="{h}" fill="{SURF}"/>'
            f'<g font-family="{FONT}">{body}</g></svg>')


def txt(x, y, s, size=20, fill=INK, weight="400", anchor="start"):
    s = (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
    return (f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" '
            f'font-weight="{weight}" text-anchor="{anchor}">{s}</text>')


def rect(x, y, w, h, fill="none", stroke=LINE, sw=2, rx=6, op=1):
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}" '
            f'stroke="{stroke}" stroke-width="{sw}" rx="{rx}" opacity="{op}"/>')


def title(t, sub=""):
    out = txt(80, 96, t, 44, INK, "600")
    if sub:
        out += txt(80, 136, sub, 21, MUTED)
    return out


def legend(items, x, y, gap=34):
    """Legend plus, always, the label beside the swatch — identity is never
    carried by colour alone."""
    out = ""
    for i, (label, colour) in enumerate(items):
        yy = y + i * gap
        out += rect(x, yy - 14, 18, 18, fill=colour, stroke="none", rx=4)
        out += txt(x + 28, yy + 1, label, 18, INK)
    return out


def write(folder, name, body, w=W, h=H):
    d = os.path.join(OUT, folder)
    os.makedirs(d, exist_ok=True)
    p = os.path.join(d, f"{name}.svg")
    with open(p, "w", encoding="utf-8") as f:
        f.write(svg(body, w, h))
    return p


# --- 18 diagrams -----------------------------------------------------------

def d_zoning():
    zones = [("Public", P[0], 80, 190, 420, 250), ("Collaborative", P[1], 520, 190, 500, 250),
             ("Focused work", P[2], 1040, 190, 480, 520), ("Social", P[3], 80, 460, 420, 250),
             ("Support", P[4], 520, 460, 240, 250), ("Service", P[5], 780, 460, 240, 250)]
    b = title("Zoning strategy", "The floor resolved into zones that behave alike, before any furniture")
    for name, c, x, y, w, h in zones:
        b += rect(x, y, w, h, fill=c, stroke="none", rx=10, op=0.16)
        b += rect(x, y, w, h, fill="none", stroke=c, sw=3, rx=10)
        b += txt(x + 20, y + 40, name, 24, INK, "600")
        b += txt(x + 20, y + 68, "zone", 16, MUTED)
    b += rect(80, 190, 1440, 520, fill="none", stroke=INK, sw=3, rx=12)
    b += txt(80, 760, "Outline is the floor plate; zone areas come straight from the area statement", 17, MUTED)
    return b


def d_adjacency():
    import math
    nodes = [("Reception", 0), ("Sales", 1), ("Engineering", 2), ("Finance", 3),
             ("HR", 4), ("Leadership", 5), ("Support", 6)]
    cx, cy, r = 800, 470, 240
    pos = {}
    b = title("Adjacency", "Who sits near whom, weighted by how often they actually interact")
    for name, i in nodes:
        a = -math.pi / 2 + i * 2 * math.pi / len(nodes)
        pos[name] = (cx + r * math.cos(a), cy + r * math.sin(a))
    links = [("Reception", "Sales", 3), ("Sales", "Leadership", 3), ("Engineering", "Leadership", 2),
             ("Finance", "HR", 2), ("HR", "Leadership", 3), ("Engineering", "Support", 1),
             ("Sales", "Finance", 1), ("Reception", "HR", 1)]
    for a, bb, wgt in links:
        x1, y1 = pos[a]; x2, y2 = pos[bb]
        b += (f'<line x1="{x1:.0f}" y1="{y1:.0f}" x2="{x2:.0f}" y2="{y2:.0f}" '
              f'stroke="{INK}" stroke-width="{wgt*2}" opacity="{0.15+wgt*0.18:.2f}"/>')
    for name, _ in nodes:
        x, y = pos[name]
        b += f'<circle cx="{x:.0f}" cy="{y:.0f}" r="56" fill="{SURF}" stroke="{P[0]}" stroke-width="3"/>'
        b += txt(x, y + 6, name, 16, INK, "600", "middle")
    b += legend([("High interaction — adjacent", INK), ("Medium — same zone", MUTED),
                 ("Low — no constraint", LINE)], 1240, 300)
    return b


def d_circulation():
    b = title("Circulation", "Primary and secondary routes, kept clear of focused work")
    b += rect(80, 190, 1440, 520, fill="none", stroke=INK, sw=3, rx=12)
    b += (f'<path d="M 140 450 L 1460 450" stroke="{P[0]}" stroke-width="18" '
          f'opacity="0.35" stroke-linecap="round"/>')
    b += txt(150, 430, "Primary route", 19, P[0], "600")
    for x in (420, 760, 1100):
        b += (f'<path d="M {x} 220 L {x} 680" stroke="{P[1]}" stroke-width="10" '
              f'opacity="0.35" stroke-linecap="round"/>')
    b += txt(430, 250, "Secondary", 17, P[1], "600")
    b += rect(1180, 520, 300, 160, fill=P[2], stroke="none", rx=10, op=0.15)
    b += txt(1200, 570, "Quiet edge", 20, INK, "600")
    b += txt(1200, 598, "no through route", 15, MUTED)
    b += txt(80, 760, "Egress distances overlaid here shorten the fire-safety slide considerably", 17, MUTED)
    return b


def d_journey():
    stages = ["Arrive", "Orient", "Settle", "Work", "Meet", "Break", "Depart"]
    b = title("Employee journey", "A day in the workplace, arrival to departure")
    x, w, gap = 80, 180, 26
    for i, s in enumerate(stages):
        xx = x + i * (w + gap)
        b += rect(xx, 380, w, 150, fill=P[0], stroke="none", rx=10, op=0.12)
        b += rect(xx, 380, w, 150, fill="none", stroke=P[0], sw=2, rx=10)
        b += txt(xx + w / 2, 440, s, 24, INK, "600", "middle")
        b += txt(xx + w / 2, 470, f"0{i+1}", 16, MUTED, "400", "middle")
        if i < len(stages) - 1:
            b += (f'<path d="M {xx+w+4} 455 L {xx+w+gap-4} 455" stroke="{MUTED}" '
                  f'stroke-width="2" marker-end="url(#a)"/>')
    b = ('<defs><marker id="a" markerWidth="8" markerHeight="8" refX="7" refY="4" '
         f'orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="{MUTED}"/></marker></defs>') + b
    b += txt(80, 620, "Contrast each stage against the pain point it replaces in the current office", 18, MUTED)
    return b


def d_sequence():
    steps = [("01", "Understand"), ("02", "Analyse"), ("03", "Strategise"),
             ("04", "Design"), ("05", "Test"), ("06", "Resolve")]
    b = title("A practical design sequence", "The method behind every slide that follows")
    x, w, gap = 80, 210, 26
    for i, (n, s) in enumerate(steps):
        xx = x + i * (w + gap)
        b += rect(xx, 340, w, 170, fill="none", stroke=INK, sw=2, rx=10)
        b += txt(xx + 22, 390, n, 18, P[0], "700")
        b += txt(xx + 22, 432, s, 26, INK, "600")
    b += rect(80, 580, 1410, 90, fill=P[0], stroke="none", rx=10, op=0.12)
    b += txt(800, 635, "A resolved workplace", 30, INK, "600", "middle")
    return b


def d_compass():
    import math
    b = title("Orientation and sun path", "Where daylight lands, and what that means for the plan")
    cx, cy, r = 800, 470, 210
    b += f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{LINE}" stroke-width="2"/>'
    b += f'<circle cx="{cx}" cy="{cy}" r="{r*0.62:.0f}" fill="none" stroke="{LINE}" stroke-width="2"/>'
    for label, ang in (("N", -90), ("E", 0), ("S", 90), ("W", 180)):
        a = math.radians(ang)
        x, y = cx + (r + 38) * math.cos(a), cy + (r + 38) * math.sin(a)
        b += txt(x, y + 8, label, 24, INK, "700", "middle")
    b += (f'<path d="M {cx-r} {cy} A {r} {r} 0 0 1 {cx+r} {cy}" fill="none" '
          f'stroke="{P[3]}" stroke-width="6" stroke-dasharray="10 8"/>')
    b += f'<circle cx="{cx+r*0.72:.0f}" cy="{cy-r*0.68:.0f}" r="20" fill="{P[3]}"/>'
    b += txt(cx + r * 0.72, cy - r * 0.68 - 34, "Peak gain", 16, INK, "600", "middle")
    b += txt(cx, cy + 8, "Site", 22, INK, "600", "middle")
    b += legend([("Sun path", P[3]), ("Glare risk — west face", P[1]),
                 ("Best daylight — north face", P[0])], 1180, 380)
    return b


def d_stacking():
    floors = [("Level 12", "Leadership + Boardroom", 120), ("Level 11", "Engineering", 260),
              ("Level 10", "Engineering + Product", 260), ("Level 09", "Sales + Marketing", 210),
              ("Level 08", "Shared amenities + Cafeteria", 0)]
    b = title("Stacking", "Which department sits on which floor, and at what headcount")
    y = 220
    for i, (lvl, use, hc) in enumerate(floors):
        b += rect(300, y, 1000, 84, fill=P[0], stroke="none", rx=8, op=0.14)
        b += rect(300, y, 1000, 84, fill="none", stroke=P[0], sw=2, rx=8)
        b += txt(120, y + 52, lvl, 24, INK, "600")
        b += txt(330, y + 52, use, 22, INK)
        b += txt(1270, y + 52, f"{hc} pax" if hc else "shared", 20, MUTED, "400", "end")
        y += 96
    return b


def _bars(b, data, x0, y0, bw, maxw, colour_idx=0, unit=""):
    """Horizontal bars: 4px rounded data-end, 2px gap, value labelled on every
    bar (the palette's contrast warning obliges visible labels)."""
    mx = max(v for _, v in data)
    for i, (label, v) in enumerate(data):
        yy = y0 + i * (bw + 14)
        w = maxw * v / mx
        b += (f'<rect x="{x0}" y="{yy}" width="{w:.0f}" height="{bw}" rx="4" '
              f'fill="{P[colour_idx]}" opacity="0.85"/>')
        b += txt(x0 - 16, yy + bw * 0.68, label, 19, INK, "400", "end")
        b += txt(x0 + w + 14, yy + bw * 0.68, f"{v}{unit}", 19, INK, "600")
    return b


def d_workstation_mix():
    b = title("Workstation mix", "Desk types and counts behind the sharing ratio")
    b = _bars(b, [("Open workstation", 268), ("Shared / hot desk", 96),
                  ("Focus pod", 34), ("Cabin", 28), ("Touchdown", 22)], 420, 250, 56, 820)
    b += txt(420, 680, "Ratio 1 : 1.3  ·  92 sq ft per person  ·  derived from measured attendance", 19, MUTED)
    return b


def d_meeting_mix():
    b = title("Meeting room mix", "Rooms by capacity band, sized from booking data")
    b = _bars(b, [("2-3 person", 14), ("4-6 person", 11), ("8-10 person", 6),
                  ("12-16 person", 3), ("20+ / town hall", 1)], 420, 250, 56, 820, 2)
    b += txt(420, 680, "Booking data almost always shows too many large rooms and too few small ones", 19, MUTED)
    return b


def d_abw_settings():
    settings = [("Focus desk", "Heads-down, 2h+"), ("Shared desk", "Mobile, part-week"),
                ("Phone booth", "1 person, calls"), ("Huddle", "3-4, ad hoc"),
                ("Project room", "Team, multi-day"), ("Lounge", "Informal, social"),
                ("Library", "Silent, solo"), ("Town hall", "All-hands")]
    b = title("Settings menu", "A setting per task, instead of one desk for everything")
    for i, (name, use) in enumerate(settings):
        x = 80 + (i % 4) * 370
        y = 230 + (i // 4) * 220
        b += rect(x, y, 340, 190, fill="none", stroke=LINE, sw=2, rx=10)
        b += rect(x, y, 340, 6, fill=P[i % 3], stroke="none", rx=3)
        b += txt(x + 24, y + 70, name, 24, INK, "600")
        b += txt(x + 24, y + 104, use, 18, MUTED)
    b += txt(80, 720, "Adoption is a change-management programme, not a furniture order", 19, MUTED)
    return b


def d_access_hierarchy():
    b = title("Access hierarchy", "Public, staff and restricted — and where the boundaries sit")
    bands = [("Public", P[0], 0), ("Staff", P[2], 1), ("Restricted", P[1], 2)]
    for name, c, i in bands:
        w = 1160 - i * 300
        x = 220 + i * 150
        b += rect(x, 230 + i * 60, w, 420 - i * 120, fill=c, stroke="none", rx=12, op=0.14)
        b += rect(x, 230 + i * 60, w, 420 - i * 120, fill="none", stroke=c, sw=3, rx=12)
        b += txt(x + 24, 268 + i * 60, name, 24, INK, "600")
    b += txt(220, 720, "Each boundary is an access-control point — name the credential at each one", 19, MUTED)
    return b


def _donut(b, data, cx, cy, r, inner=0.58):
    import math
    total = sum(v for _, v in data)
    a0 = -math.pi / 2
    for i, (label, v) in enumerate(data):
        a1 = a0 + 2 * math.pi * v / total
        large = 1 if (a1 - a0) > math.pi else 0
        x0, y0 = cx + r * math.cos(a0), cy + r * math.sin(a0)
        x1, y1 = cx + r * math.cos(a1), cy + r * math.sin(a1)
        xi0, yi0 = cx + r * inner * math.cos(a0), cy + r * inner * math.sin(a0)
        xi1, yi1 = cx + r * inner * math.cos(a1), cy + r * inner * math.sin(a1)
        b += (f'<path d="M {x0:.1f} {y0:.1f} A {r} {r} 0 {large} 1 {x1:.1f} {y1:.1f} '
              f'L {xi1:.1f} {yi1:.1f} A {r*inner:.0f} {r*inner:.0f} 0 {large} 0 {xi0:.1f} {yi0:.1f} Z" '
              f'fill="{P[i]}" stroke="{SURF}" stroke-width="2"/>')
        am = (a0 + a1) / 2
        lx, ly = cx + (r + 52) * math.cos(am), cy + (r + 52) * math.sin(am)
        anchor = "start" if math.cos(am) > 0 else "end"
        b += txt(lx, ly, label, 18, INK, "600", anchor)
        b += txt(lx, ly + 24, f"{round(100*v/total)}%", 17, MUTED, "400", anchor)
        a0 = a1
    return b


def d_work_styles():
    b = title("How work actually happens here", "The split the settings mix is sized against")
    b = _donut(b, [("Focused", 42), ("Collaborative", 28), ("Meeting-heavy", 18)], 760, 480, 190)
    b += txt(1240, 420, "Measured, not assumed", 22, INK, "600")
    b += txt(1240, 454, "Say plainly which one it is —", 18, MUTED)
    b += txt(1240, 480, "clients challenge assumed splits.", 18, MUTED)
    return b


def d_area_split():
    b = title("Area allocation", "Where the square footage actually goes")
    b = _donut(b, [("Workspace", 54), ("Meeting", 22), ("Amenity + support", 24)], 760, 480, 190)
    b += txt(1240, 420, "Against the area statement", 22, INK, "600")
    b += txt(1240, 454, "Every square foot accounted for,", 18, MUTED)
    b += txt(1240, 480, "including circulation and core.", 18, MUTED)
    return b


def d_attendance():
    days = [("Mon", 62), ("Tue", 88), ("Wed", 91), ("Thu", 79), ("Fri", 44)]
    b = title("Attendance pattern", "Peak versus average — the basis of any sharing ratio")
    x0, bw, gap, maxh = 280, 150, 60, 380
    for i, (d, v) in enumerate(days):
        x = x0 + i * (bw + gap)
        h = maxh * v / 100
        b += f'<rect x="{x}" y="{640-h:.0f}" width="{bw}" height="{h:.0f}" rx="4" fill="{P[0]}" opacity="0.85"/>'
        b += txt(x + bw / 2, 672, d, 20, INK, "400", "middle")
        b += txt(x + bw / 2, 630 - h, f"{v}%", 20, INK, "600", "middle")
    b += f'<line x1="260" y1="{640-maxh*0.73:.0f}" x2="1340" y2="{640-maxh*0.73:.0f}" stroke="{P[1]}" stroke-width="2" stroke-dasharray="8 6"/>'
    b += txt(1350, 640 - maxh * 0.73 + 6, "Average 73%", 19, P[1], "600")
    b += txt(280, 730, "Size the plan for the peak, not the average", 19, MUTED)
    return b


def d_acoustic():
    b = title("Acoustic zoning", "Loud to silent, planned rather than patched")
    zones = [("Social / café", "Loud", P[1]), ("Collaboration", "Active", P[3]),
             ("Open workspace", "Moderate", P[0]), ("Focus / library", "Silent", P[2])]
    for i, (name, lvl, c) in enumerate(zones):
        x = 80 + i * 370
        b += rect(x, 250, 340, 300, fill=c, stroke="none", rx=10, op=0.16)
        b += rect(x, 250, 340, 300, fill="none", stroke=c, sw=3, rx=10)
        b += txt(x + 24, 310, name, 24, INK, "600")
        b += txt(x + 24, 346, lvl, 19, MUTED)
        b += txt(x + 24, 500, f"NRC target 0.{9-i}0", 18, INK)
    b += txt(80, 620, "Exposed soffits remove the usual absorption — compensate or the open plan fails", 19, MUTED)
    return b


def d_daylight():
    b = title("Daylight penetration", "Perimeter for people, core for rooms — or a reasoned exception")
    b += rect(80, 220, 1440, 460, fill="none", stroke=INK, sw=3, rx=12)
    for i in range(6):
        op = 0.30 - i * 0.05
        b += rect(90 + i * 118, 230, 118, 440, fill=P[3], stroke="none", rx=0, op=op)
    b += rect(800, 300, 320, 300, fill=MUTED, stroke="none", rx=8, op=0.25)
    b += txt(960, 460, "Core", 22, INK, "600", "middle")
    b += txt(110, 280, "Best daylight", 20, INK, "600")
    b += txt(110, 308, "open workspace", 17, MUTED)
    b += txt(1180, 280, "Low daylight", 20, INK, "600")
    b += txt(1180, 308, "enclosed rooms, support", 17, MUTED)
    b += txt(80, 730, "Glare control on the west face is a separate problem from daylight access", 19, MUTED)
    return b


def d_delivery_team():
    b = title("Delivery model", "Who does what, and who you call when something goes wrong")
    b += rect(620, 200, 360, 100, fill=P[0], stroke="none", rx=10, op=0.16)
    b += rect(620, 200, 360, 100, fill="none", stroke=P[0], sw=3, rx=10)
    b += txt(800, 245, "Project Director", 24, INK, "600", "middle")
    b += txt(800, 274, "single point of contact", 17, MUTED, "400", "middle")
    roles = ["Design lead", "Project manager", "Site manager", "QA / QS"]
    for i, r in enumerate(roles):
        x = 130 + i * 350
        b += f'<line x1="800" y1="300" x2="{x+150}" y2="400" stroke="{LINE}" stroke-width="2"/>'
        b += rect(x, 400, 300, 90, fill="none", stroke=LINE, sw=2, rx=10)
        b += txt(x + 150, 452, r, 21, INK, "600", "middle")
    b += rect(130, 570, 1340, 90, fill=MUTED, stroke="none", rx=10, op=0.10)
    b += txt(800, 622, "Weekly governance · fortnightly steering · 24h escalation", 20, INK, "400", "middle")
    return b


def d_timeline():
    phases = [("Design development", 0, 6), ("Approvals & tender", 4, 4),
              ("Procurement", 7, 6), ("Site works", 10, 14), ("Snag & handover", 23, 3)]
    b = title("Programme", "Phases, overlap and the critical path")
    x0, unit, y = 380, 42, 250
    for i in range(0, 27, 4):
        b += f'<line x1="{x0+i*unit}" y1="230" x2="{x0+i*unit}" y2="640" stroke="{LINE}" stroke-width="1"/>'
        b += txt(x0 + i * unit, 700, f"W{i}", 16, MUTED, "400", "middle")
    for i, (name, start, dur) in enumerate(phases):
        yy = y + i * 76
        b += (f'<rect x="{x0+start*unit}" y="{yy}" width="{dur*unit}" height="46" rx="4" '
              f'fill="{P[0]}" opacity="0.85"/>')
        b += txt(x0 - 20, yy + 32, name, 19, INK, "400", "end")
        b += txt(x0 + start * unit + dur * unit + 12, yy + 32, f"{dur}w", 18, INK, "600")
    b += txt(380, 740, "Furniture lead time is usually the critical path — confirm it before committing", 19, MUTED)
    return b


DIAGRAMS = [
    ("zoning-strategy", d_zoning, ["S062"]),
    ("adjacency-diagram", d_adjacency, ["S063"]),
    ("circulation-strategy", d_circulation, ["S064"]),
    ("employee-journey", d_journey, ["S019"]),
    ("design-sequence", d_sequence, ["S041"]),
    ("orientation-sun-path", d_compass, ["S031", "S035"]),
    ("stacking-plan", d_stacking, ["S070"]),
    ("workstation-mix", d_workstation_mix, ["S068"]),
    ("meeting-room-mix", d_meeting_mix, ["S069"]),
    ("abw-settings-menu", d_abw_settings, ["S048", "S088"]),
    ("access-hierarchy", d_access_hierarchy, ["S137"]),
    ("work-styles-split", d_work_styles, ["S016"]),
    ("area-allocation", d_area_split, ["S061"]),
    ("attendance-pattern", d_attendance, ["S018"]),
    ("acoustic-zoning", d_acoustic, ["S115"]),
    ("daylight-penetration", d_daylight, ["S035"]),
    ("delivery-model", d_delivery_team, ["S156"]),
    ("programme-timeline", d_timeline, ["S155"]),
]


# --- 12 concept boards -----------------------------------------------------
# Not charts: these are material/colour boards, so they carry each concept's
# own palette rather than the categorical one.

BOARD_PALETTES = {
    "C01": ["#2F4F3E", "#6B8F71", "#A8B99C", "#C9B79C", "#8B5E3C", "#F2EFE6"],
    "C02": ["#FFFFFF", "#F2F2F0", "#D8D8D5", "#9A9A97", "#3A3A38", "#111111"],
    "C03": ["#2a78d6", "#5B9BE0", "#E8A33D", "#C7D3DE", "#4A4A48", "#F5F5F3"],
    "C04": ["#4A4A47", "#6E6A63", "#8C7B6B", "#A85B3C", "#2B2B29", "#D6CFC4"],
    "C05": ["#8C3B2E", "#C0762E", "#1F3A63", "#C9A227", "#E2D3B8", "#4A3728"],
    "C06": ["#E63946", "#F4A261", "#2A9D8F", "#264653", "#E9C46A", "#FFFFFF"],
    "C07": ["#E8EDE9", "#B8CBC4", "#7FA095", "#D9C7B4", "#4F5F58", "#FAFAF8"],
    "C08": ["#5A6B4A", "#8A9A6B", "#C2B49A", "#7A6A55", "#D9D2C2", "#3D4636"],
    "C09": ["#12161B", "#1F2A35", "#3E5266", "#7B8C9E", "#00C2CB", "#E8EDF2"],
    "C10": ["#E8DFD2", "#D6C7B0", "#B9A68C", "#8A8379", "#5A564E", "#FAF7F1"],
    "C11": ["#000000", "#2B2B2B", "#5C5C5C", "#9E9E9E", "#D6D6D6", "#FFFFFF"],
    "C12": ["#C97B5A", "#E3C2A8", "#7A8B99", "#4A4139", "#D9CFC1", "#F5EFE7"],
}


def concept_board(c):
    cols = BOARD_PALETTES[c["id"]]
    b = title(c["name"], c["one_line"])
    for i, col in enumerate(cols):
        x = 80 + i * 245
        b += rect(x, 200, 225, 260, fill=col, stroke=LINE, sw=1, rx=8)
        b += txt(x, 486, col.upper(), 15, MUTED)
    fields = [("Materials", c["materials"]), ("Lighting", c["lighting"]),
              ("Imagery", c["imagery"]), ("Watch out for", c["watch_out"])]
    y = 560
    for label, val in fields:
        b += txt(80, y, label, 17, MUTED, "600")
        words, line, lines = val.split(), "", []
        for w in words:
            if len(line) + len(w) > 92:
                lines.append(line); line = w
            else:
                line = (line + " " + w).strip()
        lines.append(line)
        for j, ln in enumerate(lines[:2]):
            b += txt(230, y + j * 26, ln, 18, INK)
        y += 26 * max(len(lines[:2]), 1) + 22
    return b


# --- thumbnails ------------------------------------------------------------
# One wireframe per slide, drawn from its LAYOUT, so the picker shows the
# shape of the slide rather than a generic card.

TW, TH = 800, 450


def wire(layout, name, section):
    b = rect(0, 0, TW, TH, fill="#FFFFFF", stroke=LINE, sw=2, rx=0)
    a = P[0]

    def box(x, y, w, h, op=0.10, c=None):
        return rect(x, y, w, h, fill=c or a, stroke="none", rx=4, op=op)

    def bar(x, y, w, h=12, op=0.22, c=None):
        return rect(x, y, w, h, fill=c or INK, stroke="none", rx=3, op=op)

    if layout == "title-slide":
        b += rect(0, 0, TW, TH, fill=INK, stroke="none", rx=0, op=1)
        b += bar(60, 190, 420, 26, 0.9, "#FFFFFF")
        b += bar(60, 234, 300, 14, 0.5, "#FFFFFF")
        b += bar(60, 360, 90, 10, 0.35, "#FFFFFF")
    elif layout == "title-only":
        b += bar(60, 60, 120, 10, 0.3)
        b += bar(60, 170, 620, 24, 0.75)
        b += bar(60, 210, 480, 24, 0.75)
    elif layout == "title-content":
        b += bar(60, 60, 120, 10, 0.3); b += bar(60, 100, 420, 20, 0.75)
        for i in range(6):
            b += bar(60, 170 + i * 30, 640 - (i % 3) * 90, 10, 0.18)
    elif layout == "title-stats":
        b += bar(60, 60, 120, 10, 0.3); b += bar(60, 100, 380, 20, 0.75)
        for i in range(3):
            b += box(60 + i * 230, 180, 210, 180, 0.10)
            b += bar(80 + i * 230, 230, 110, 26, 0.7)
            b += bar(80 + i * 230, 280, 150, 10, 0.25)
    elif layout == "two-content":
        b += bar(60, 60, 120, 10, 0.3); b += bar(60, 100, 380, 20, 0.75)
        for c in (60, 420):
            b += box(c, 170, 320, 210, 0.07)
            for i in range(4):
                b += bar(c + 20, 200 + i * 30, 260 - (i % 2) * 60, 10, 0.2)
    elif layout == "concept":
        b += bar(60, 60, 120, 10, 0.3); b += bar(60, 100, 300, 20, 0.75)
        b += bar(60, 150, 340, 12, 0.4)
        for i in range(3):
            b += box(60, 195 + i * 56, 330, 44, 0.10)
        b += box(430, 100, 310, 280, 0.16)
    elif layout == "linked-views":
        b += bar(60, 50, 120, 10, 0.3); b += bar(60, 86, 300, 18, 0.75)
        for i, w in enumerate((70, 70, 96, 60)):
            b += box(60 + i * 84, 124, w, 24, 0.18 if i else 0.34)
        b += box(60, 166, 470, 224, 0.10)
        b += rect(150, 210, 120, 80, fill=a, stroke=a, sw=2, rx=4, op=0.28)
        b += rect(330, 280, 110, 70, fill=a, stroke=a, sw=2, rx=4, op=0.28)
        b += box(548, 166, 192, 224, 0.06)
        for i in range(6):
            b += bar(564, 186 + i * 34, 160, 10, 0.2)
    elif layout == "merge-diagram":
        b += bar(60, 60, 120, 10, 0.3); b += bar(60, 100, 340, 20, 0.75)
        for i in range(4):
            b += box(60 + i * 178, 180, 158, 90, 0.12)
        b += box(60, 310, 692, 70, 0.20)
    elif layout == "stat-hero":
        b += bar(60, 60, 120, 10, 0.3)
        b += bar(60, 150, 460, 66, 0.8)
        b += bar(60, 250, 300, 14, 0.35)
        b += bar(60, 300, 520, 10, 0.18)
    elif layout == "site-locus":
        b += bar(60, 50, 120, 10, 0.3); b += bar(60, 86, 300, 18, 0.75)
        b += box(60, 130, 400, 260, 0.12)
        b += box(490, 130, 250, 150, 0.20)
        b += f'<circle cx="615" cy="330" r="46" fill="none" stroke="{a}" stroke-width="3" opacity="0.5"/>'
    elif layout == "material-compare":
        b += bar(60, 50, 120, 10, 0.3); b += bar(60, 86, 300, 18, 0.75)
        b += box(60, 130, 340, 260, 0.16)
        b += box(400, 130, 340, 260, 0.07)
        b += rect(398, 130, 4, 260, fill=INK, stroke="none", rx=2, op=0.6)
        b += f'<circle cx="400" cy="260" r="18" fill="{INK}" opacity="0.6"/>'
    elif layout == "orbit":
        import math
        b += bar(60, 50, 120, 10, 0.3); b += bar(60, 86, 300, 18, 0.75)
        cx, cy = 400, 270
        b += f'<circle cx="{cx}" cy="{cy}" r="72" fill="{a}" opacity="0.14"/>'
        b += f'<circle cx="{cx}" cy="{cy}" r="130" fill="none" stroke="{LINE}" stroke-width="2"/>'
        for i in range(5):
            ang = -math.pi / 2 + i * 2 * math.pi / 5
            b += (f'<circle cx="{cx+130*math.cos(ang):.0f}" cy="{cy+130*math.sin(ang):.0f}" '
                  f'r="30" fill="{a}" opacity="0.26"/>')
    elif layout == "freeform":
        b += box(60, 50, 300, 130, 0.14); b += box(380, 50, 170, 130, 0.10)
        b += box(570, 50, 170, 200, 0.18); b += box(60, 200, 190, 190, 0.10)
        b += box(270, 200, 280, 100, 0.06)
        b += bar(285, 230, 220, 12, 0.3); b += bar(285, 256, 170, 10, 0.2)
        b += box(570, 270, 170, 120, 0.12)
    elif layout == "blank":
        b += box(0, 0, TW, TH, 0.10)
    else:
        b += bar(60, 60, 120, 10, 0.3); b += bar(60, 100, 380, 20, 0.75)

    b += bar(TW - 150, TH - 40, 90, 8, 0.15)
    return b


# --- build -----------------------------------------------------------------

def rasterise(svg_path, w, h):
    png = svg_path[:-4] + ".png"
    r = subprocess.run(
        [CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
         f"--screenshot={png}", f"--window-size={w},{h}", f"file://{svg_path}"],
        capture_output=True, timeout=90)
    if not os.path.exists(png) or os.path.getsize(png) == 0:
        raise RuntimeError(f"rasterise failed for {svg_path}: {r.stderr.decode()[:300]}")
    return png


def rel(p):
    return os.path.relpath(p, OUT).replace(os.sep, "/")


def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT, exist_ok=True)

    # 1 · diagrams
    for name, fn, slides in DIAGRAMS:
        p = write("diagrams", name, fn())
        png = rasterise(p, W, H)
        for sid in slides:
            index_rows.append([sid, name.replace("-", " "), "diagram", rel(png),
                               "no", "16:9", f"{W}x{H}", "Generated — original artwork"])

    # 2 · concept boards
    for c in MT.CONCEPTS:
        p = write("concept-boards", f"{c['id'].lower()}-{c['name'].split(' /')[0].split(' (')[0].lower().replace(' ', '-')}",
                  concept_board(c))
        png = rasterise(p, W, H)
        for sid in ("S044", "S111"):
            index_rows.append([sid, f"{c['name']} board", "concept-board", rel(png),
                               "no", "16:9", f"{W}x{H}", f"Generated — concept {c['id']}"])

    # 3 · thumbnails
    for s in SLIDES:
        write("thumbnails", s["id"].lower(), wire(s["layout"], s["name"], s["section"]), TW, TH)
        index_rows.append([s["id"], "template thumbnail", "thumbnail",
                           f"thumbnails/{s['id'].lower()}.svg", "no", "16:9",
                           f"{TW}x{TH}", "Generated — layout wireframe"])

    # 4 · harvested reference imagery
    src = os.path.join(REPO, "public", "concept-library", "ecom-express")
    mapping = {"s1": ("S014", "Workplace Aspirations"), "s2": ("S013", "Brand Landscape"),
               "s3": ("S045", "Design Cues")}
    dst = os.path.join(OUT, "reference", "ecom-express")
    os.makedirs(dst, exist_ok=True)
    for f in sorted(os.listdir(os.path.join(src, "elements"))):
        if not f.lower().endswith((".png", ".jpg", ".jpeg")):
            continue
        shutil.copy2(os.path.join(src, "elements", f), os.path.join(dst, f))
        sid, label = mapping.get(f[:2], ("S008", "Reference"))
        index_rows.append([sid, f"{label} element", "reference-photo",
                           f"reference/ecom-express/{f}", "no", "varies", "varies",
                           "E-Com Express client deck (already in repo)"])
    for n in (1, 2, 3):
        f = f"slide-{n}.png"
        if os.path.exists(os.path.join(src, f)):
            shutil.copy2(os.path.join(src, f), os.path.join(dst, f))
            index_rows.append([list(mapping.values())[n - 1][0], "full reference slide",
                               "reference-slide", f"reference/ecom-express/{f}", "no",
                               "16:9", "1920x1080", "E-Com Express client deck"])

    # 5 · brand marks
    bdst = os.path.join(OUT, "brand")
    os.makedirs(bdst, exist_ok=True)
    for f in sorted(os.listdir(os.path.join(REPO, "public", "logos"))):
        shutil.copy2(os.path.join(REPO, "public", "logos", f), os.path.join(bdst, f))
        for sid in ("S001", "S003", "S162"):
            index_rows.append([sid, f"brand mark ({f})", "brand", f"brand/{f}",
                               "yes", "free", "native", "Officebanao / SKV"])

    # 6 · photo slots — specified, not shipped
    PHOTO_HINTS = (("render", "16:9", "1920x1080"), ("photo", "16:9", "1920x1080"),
                   ("image", "16:9", "1600x900"), ("swatch", "1:1", "800x800"),
                   ("logo", "free", "400px wide"), ("video", "16:9", "1080p"),
                   ("plan", "16:9", "2400x1350"), ("drawing", "16:9", "2400x1350"),
                   ("photos", "16:9", "1920x1080"))
    for s in SLIDES:
        for field, req in (("required_inputs", "yes"), ("optional_inputs", "no")):
            for item in (s[field] or "").split(";"):
                item = item.strip()
                if not item:
                    continue
                low = item.lower()
                hit = next(((r, px) for k, r, px in PHOTO_HINTS if k in low), None)
                if hit:
                    index_rows.append([s["id"], item, "photo-slot", "", req, hit[0],
                                       hit[1], "Supplied per project — not shippable"])

    # 7 · index + readme
    with open(os.path.join(OUT, "_index.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["slide_id", "asset_slot", "kind", "file", "required", "ratio",
                    "min_px", "source"])
        w.writerows(sorted(index_rows, key=lambda r: (r[0], r[2], r[1])))

    with open(os.path.join(OUT, "README.md"), "w", encoding="utf-8") as f:
        f.write(README)

    kinds = {}
    for r in index_rows:
        kinds[r[2]] = kinds.get(r[2], 0) + 1
    files = sum(len(fs) for _, _, fs in os.walk(OUT))
    print(f"wrote {OUT}")
    print(f"index rows: {len(index_rows)}  files on disk: {files}")
    for k, v in sorted(kinds.items()):
        print(f"  {k:16s} {v}")


README = """# Template library images

Shared image assets for Presenta's typology + concept template system.
Indexed in `_index.csv`, and mirrored as tab 11 of the template-system
workbook (`docs/template-system/`).

Generated by `docs/template-system/gen_images.py` — **do not hand-edit**;
re-run the generator instead.

## Why it lives under `public/`

Presenta already serves library imagery from here — `conceptLibrary.ts`
references `/concept-library/ecom-express/slide-1.png` the same way — so every
path in `_index.csv` is usable as an `imageUrl` value verbatim, with no copying
step at template-population time.

## Folders

| Folder | What it holds |
|---|---|
| `diagrams/` | 18 original diagrams that go **on** slides — zoning, adjacency, circulation, journey, sun path, stacking, workstation and meeting mix, ABW settings, access hierarchy, work-style and area splits, attendance, acoustic zoning, daylight, delivery model, programme. SVG + PNG. |
| `concept-boards/` | One palette/material board per design concept (C01–C12). SVG + PNG. |
| `thumbnails/` | One wireframe per slide type, drawn from its layout — for the template picker. SVG. |
| `reference/` | The real E-Com Express client-deck imagery already in this repo, re-indexed by which slide type each image exemplifies. |
| `brand/` | Officebanao and SKV marks. |

## What is NOT here, and why

**No stock photography.** Two separate reasons, and both matter:

1. This session's network policy blocks the stock image CDNs outright
   (`images.unsplash.com` and `images.pexels.com` both return 403 at the egress
   proxy), so none could be fetched even if wanted.
2. More importantly, the images these slides actually need — the reception
   render, the floor plan, the material swatches — *belong to the project*.
   A generic stock interior in a client pitch is worse than an empty frame.

So every slide that needs photography has a **spec row** in `_index.csv` with
`kind=photo-slot`: the asset slot, whether it is required, the aspect ratio and
the minimum pixel size, and no file. That is the collection checklist for a
real project, and it is what the template engine should render as an empty
frame with a prompt.

## `_index.csv` columns

| Column | Meaning |
|---|---|
| `slide_id` | The slide type this asset belongs to (see tab 04 of the workbook) |
| `asset_slot` | What the asset is used for on that slide |
| `kind` | `diagram`, `concept-board`, `thumbnail`, `reference-photo`, `reference-slide`, `brand`, or `photo-slot` |
| `file` | Path relative to this folder. **Empty for `photo-slot`** — that is the point |
| `required` | Whether the slide can be built without it |
| `ratio` / `min_px` | The spec the supplied image must meet |
| `source` | Where it came from, or who supplies it |

## Colour

Diagram colours come from the validated categorical palette in the `dataviz`
skill (slots 1–6, light surface), checked with its own validator: all six
checks pass on the adjacent pairlist, and the three donut/all-pairs forms use
only the first three slots. The palette's contrast warning is discharged the
way that skill requires — every coloured region carries a visible direct
label, so identity is never encoded by colour alone.

Concept boards deliberately do **not** use that palette: they are material and
colour boards carrying each concept's own scheme, not data encodings.
"""

if __name__ == "__main__":
    main()
