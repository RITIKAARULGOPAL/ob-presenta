"""Selection rules: how a project's typology, concept, grade, scale and nature
turn the 106-slide library into one deck.

The matrices in the sheet are DERIVED from these rules, not hand-filled. That
is deliberate: a hand-filled 106x16 grid and a rules engine drift apart the
first time someone edits one and not the other. Here the grid is a rendering
of the rules, so it cannot disagree with them.

Levels
------
    M   Mandatory    always in the deck
    R   Recommended  in by default; the author may remove it
    O   Optional     out by default; offered in the picker
    X   Excluded     not offered at all — irrelevant or misleading here

Operations a rule block can perform
-----------------------------------
    "M"/"R"/"O"  escalate the slide to AT LEAST this level
    "down"       lower the slide to Optional — still offered, no longer default
    "X"          exclude it entirely

`down` is not the same as listing a slide under "O". Escalations resolve by
MAX, so listing an already-Recommended slide under "O" does nothing at all.
Without a separate demote operation a startup deck comes out the same length
as a GCC deck, which is the one thing this system exists to prevent.

Resolution order (implemented in resolve())
-------------------------------------------
    1. Start from the slide's own baseline.
    2. Apply the typology rule, then the project-nature rule.
    3. Apply the concept, grade and scale rules.
    4. Within each block: `down` first, then escalations by MAX.
    5. EXCLUSION IS STICKY: an X from typology or nature can never be undone
       by a later rule.

Step 5 is the important one. Without it, picking the Tech-Forward concept
would escalate the AV slide into an Experience Centre deck that had already
excluded desking slides — and, worse, a concept could pull a BFSI dealing
floor into a startup deck. Relevance is a property of the project, not of
the design language, so typology exclusions win.

A concept CAN, deliberately, pull back a slide the typology demoted: that is
the Startup + Collaborative case, where ABW re-earns four slides the startup
rules had trimmed. Demotion says "not by default here"; escalation says "this
project needs it". The second is a stronger claim, so it wins.
"""

LEVELS = {"X": -1, "O": 0, "R": 1, "M": 2}
LEVEL_NAMES = {-1: "X", 0: "O", 1: "R", 2: "M"}

# ---------------------------------------------------------------------------
# Typology-gated special spaces
# ---------------------------------------------------------------------------
# These seven slides describe spaces that simply do not exist in most
# projects. They default to X for every typology and are switched on only by
# the owners listed here. This is what stops a startup deck offering a
# dealing floor.

SPECIAL_SPACES = {
    "S094": {"T06": "M"},                           # Trading / dealing floor
    "S095": {"T11": "M", "T10": "R"},               # Lab / workshop interface
    "S096": {"T13": "M", "T14": "R"},               # Studio / content space
    "S097": {"T04": "M", "T05": "O"},               # Community & event space
    "S098": {"T16": "M", "T01": "O", "T02": "O"},   # Experience / demo zone
    "S099": {"T09": "M"},                           # Operations control tower
    "S100": {"T15": "M", "T06": "O"},               # Public interface counter
}

# ---------------------------------------------------------------------------
# Typology rules — only DIFFERENCES from baseline are listed
# ---------------------------------------------------------------------------

TYPOLOGY_RULES = {
    "T01": {  # IT / Technology Services
        "M": ["S018", "S087", "S132"],
        "R": ["S048", "S068", "S069", "S133"],
        "why": "Desk-sharing has to be argued from attendance data, and every room needs hybrid AV.",
    },
    "T02": {  # GCC
        "M": ["S002", "S018", "S049", "S090", "S132", "S133", "S137"],
        "R": ["S020", "S121", "S139", "S158", "S160"],
        "why": "The parent's global workplace standard is the spine, and the deck is read asynchronously overseas without a presenter.",
    },
    "T03": {  # Startup
        "M": ["S017", "S152"],
        "R": ["S088"],
        "down": ["S002", "S010", "S013", "S031", "S032", "S034", "S040", "S041",
                 "S063", "S064", "S068", "S080", "S084", "S114", "S135", "S136",
                 "S150", "S156"],
        "X": ["S005", "S006", "S033", "S035", "S036", "S047", "S049", "S050", "S070",
              "S110", "S117", "S119", "S120", "S121", "S130", "S134", "S137", "S139"],
        "why": "Decided fast, often by one person. Everything that is not the plan, the money or the growth story is trimmed to optional.",
    },
    "T04": {  # Managed Workspace - Operator Centre
        "M": ["S061", "S068", "S084", "S087", "S158"],
        "R": ["S049", "S069", "S159"],
        "down": ["S013", "S014", "S015"],
        "why": "Sellable seats per sq ft is the argument. The brand stays neutral because a future tenant cannot inherit this client's story.",
    },
    "T05": {  # Managed Office / BTS
        "M": ["S093", "S156", "S158", "S159"],
        "R": ["S013", "S049", "S157"],
        "why": "Two audiences at once - the operator who runs it and the tenant who occupies it. Operations earn real slide time.",
    },
    "T06": {  # BFSI
        "M": ["S082", "S086", "S135", "S137"],
        "R": ["S111", "S121", "S133", "S160"],
        "why": "Security zoning and regulatory segregation are design drivers, and compliance can veto the plan late.",
    },
    "T07": {  # Consulting & Professional Services
        "M": ["S018", "S048", "S082", "S084", "S086"],
        "R": ["S068", "S111", "S121"],
        "why": "High headcount, low real attendance. The sharing ratio is the commercial argument; the client suite is the brand one.",
    },
    "T08": {  # Legal / Chambers
        "M": ["S082", "S084", "S115"],
        "R": ["S093", "S121"],
        "down": ["S044", "S063", "S068", "S088"],
        "X": ["S018"],
        "why": "Cellular by nature and bound by confidentiality. Acoustic privacy is a legal requirement, not a preference.",
    },
    "T09": {  # E-commerce & Logistics
        "M": ["S089", "S090"],
        "R": ["S018", "S091", "S133", "S157"],
        "why": "Genuine 24x7 operation. Shift overlap, not headcount, sizes circulation and amenities.",
    },
    "T10": {  # Healthcare / Pharma / Life Sciences
        "M": ["S091", "S111", "S136"],
        "R": ["S137", "S138", "S157"],
        "why": "Regulated adjacency and material hygiene. Finishes are chosen for cleanability and certification first.",
    },
    "T11": {  # R&D / Engineering Centre
        "M": ["S036", "S131", "S137"],
        "R": ["S133", "S157", "S160"],
        "why": "The lab boundary governs services load, access control and the goods route before anything aesthetic.",
    },
    "T12": {  # Manufacturing / Plant-attached
        "M": ["S089", "S136", "S157"],
        "R": ["S033", "S092", "S120"],
        "down": ["S013", "S044"],
        "X": ["S119"],
        "why": "Office and plant staff share entrances and canteens. Durability beats delicacy in every material call.",
    },
    "T13": {  # Media / Creative / D2C
        "M": ["S013", "S044", "S114"],
        "R": ["S045", "S117", "S119"],
        "down": ["S002", "S063", "S068", "S135", "S136", "S156"],
        "why": "The office is a brand artefact and often a shoot location. This audience out-designs generic corporate renders.",
    },
    "T14": {  # Education / EdTech
        "M": ["S090", "S092"],
        "R": ["S115", "S136", "S157"],
        "down": ["S013", "S044", "S063", "S068"],
        "why": "Timetable peaks, not headcount, size circulation and washrooms. Heavy footfall demands durability.",
    },
    "T15": {  # Government / PSU / Institutional
        "M": ["S049", "S135", "S136"],
        "R": ["S092", "S153", "S160"],
        "down": ["S013", "S044"],
        "X": ["S119"],
        "why": "Entitlement norms and tender compliance define the plan before design begins.",
    },
    "T16": {  # Experience Centre / Innovation Hub
        "M": ["S111", "S114", "S117", "S119", "S132"],
        "R": ["S116", "S121", "S134"],
        "down": ["S002", "S010", "S017", "S063", "S064", "S067", "S083"],
        "X": ["S018", "S068", "S070", "S084"],
        "why": "The visitor's route IS the design. Desking slides are noise; sequence and reveal order carry the deck.",
    },
}


# ---------------------------------------------------------------------------
# Concept rules — a concept escalates the slides that carry its evidence
# ---------------------------------------------------------------------------
# `notes` records HOW the content shifts, not just that the slide is in. That
# column is the useful half for whoever authors the slide.

CONCEPT_RULES = {
    "C01": {  # Biophilic
        "M": ["S118", "S035"],
        "R": ["S031", "S138", "S120"],
        "notes": {
            "S118": "Becomes a full planting plan: species by light condition, planter design, irrigation and who maintains it.",
            "S035": "Daylight study drives the planting strategy, not just the desk layout.",
            "S111": "Lead with natural, tactile materials — timber, cork, stone, natural textile.",
            "S081": "Reception carries the biggest planted gesture; it sets the expectation for the rest.",
        },
    },
    "C02": {  # Contemporary / Minimal
        "M": ["S121"],
        "R": ["S120", "S114"],
        "notes": {
            "S121": "Minimal shows every tolerance, so junction details become a proof of buildability.",
            "S111": "Fewer materials, used more precisely. Show finish and edge, not variety.",
            "S114": "Concealed and linear fittings; the lighting design is mostly what you cannot see.",
        },
    },
    "C03": {  # Collaborative (ABW)
        "M": ["S088", "S048", "S016", "S087"],
        "R": ["S018", "S134", "S069"],
        "notes": {
            "S048": "Name the model explicitly and commit to a change-management programme on the same slide.",
            "S088": "The main evidence for the concept — show the full settings menu, not one lounge render.",
            "S016": "Work-style split is the entire justification for the settings mix. Survey data, not assumption.",
            "S087": "Booth ratio per 100 seats becomes a headline number, not a footnote.",
        },
    },
    "C04": {  # Industrial / Raw
        "M": ["S115", "S120"],
        "R": ["S131"],
        "notes": {
            "S115": "Exposed soffits remove the usual absorption — the acoustic compensation must be shown in the same breath.",
            "S120": "Ceiling strategy is the concept. Show the services coordination as a designed element.",
            "S131": "Exposed services must be coordinated to be seen, which is a higher bar than concealed.",
        },
    },
    "C05": {  # Heritage & Local Context
        "M": ["S117", "S119"],
        "R": ["S111", "S155", "S112"],
        "notes": {
            "S117": "Storytelling is the concept's payload — name the region, the craft and the maker.",
            "S119": "Commissioned craft pieces, with artisan partners named.",
            "S155": "Craft procurement lead times go on the programme, not in a footnote.",
        },
    },
    "C06": {  # Brand-Immersive / Playful
        "M": ["S013", "S112", "S116", "S117"],
        "R": ["S045", "S081"],
        "notes": {
            "S013": "The brand landscape slide stops being context and becomes the design's source material.",
            "S112": "Colour is applied at architectural scale; show where and at what extent.",
            "S117": "Graphics are architecture here, not applied decoration.",
            "S111": "Keep the boldest colour on replaceable surfaces — brand refreshes outpace fit-outs.",
        },
    },
    "C07": {  # Wellness-First
        "M": ["S091", "S115"],
        "R": ["S113", "S138", "S134", "S035"],
        "notes": {
            "S091": "The wellness amenity set is the concept's evidence — quiet, prayer, mother's and recharge rooms.",
            "S115": "Acoustic comfort is a health claim here, so give it ratings rather than adjectives.",
            "S113": "Ergonomic standard and adjustability become a specified requirement.",
        },
    },
    "C08": {  # Sustainable / Certified Green
        "M": ["S138", "S139", "S111"],
        "R": ["S155", "S151", "S120"],
        "notes": {
            "S139": "Commit to a rating level and show the credit scorecard, or do not claim certification at all.",
            "S111": "Material provenance and recycled content per line, not just appearance.",
            "S151": "Certification changes both programme and budget — show the delta honestly.",
        },
    },
    "C09": {  # Tech-Forward / Smart
        "M": ["S134", "S132", "S133"],
        "R": ["S069", "S131"],
        "notes": {
            "S134": "Occupancy sensing is a privacy conversation — state the data position and name HR/Legal involvement.",
            "S132": "AV standard per room type becomes a headline deliverable.",
            "S069": "Room mix is derived from booking data, which the smart layer will keep measuring.",
        },
    },
    "C10": {  # Warm Minimal (Japandi)
        "M": ["S111"],
        "R": ["S113", "S121", "S120", "S114"],
        "notes": {
            "S111": "Texture and grain carry the concept — show close-ups, not flat swatches.",
            "S113": "Furniture curation matters more than quantity; fewer, better pieces.",
            "S121": "Pale timber and linen mark fast — show the maintenance regime alongside the detail.",
        },
    },
    "C11": {  # Monochrome / Editorial
        "M": ["S114", "S116"],
        "R": ["S119", "S121", "S112"],
        "notes": {
            "S114": "Gallery-grade accent lighting is the concept; lux and contrast ratios matter.",
            "S116": "Typography and signage are the main decorative system.",
            "S111": "Check luminance ratios at desks — high contrast is hard on screen work and on accessibility.",
        },
    },
    "C12": {  # Resimercial / Homely
        "M": ["S088", "S113"],
        "R": ["S089", "S112", "S114"],
        "notes": {
            "S088": "Domestic-scale settings are the evidence — lounge, rug, lamp, not another meeting table.",
            "S113": "Specify contract-grade equivalents; domestic fabrics fail commercial abrasion and fire ratings.",
            "S114": "Layered lamps and pendants at domestic scale, warm colour temperature.",
        },
    },
}

# ---------------------------------------------------------------------------
# Grade rules (axis E)
# ---------------------------------------------------------------------------

GRADE_RULES = {
    "G1": {  # Value / functional
        "down": ["S044", "S084", "S114"],
        "X": ["S119", "S121"],
        "why": "Shortest deck. Detail, art and mock-up slides are cut; space-by-space slides get grouped.",
    },
    "G2": {"why": "The baseline the library is written to. No adjustment."},
    "G3": {  # Premium
        "M": ["S111", "S121", "S086"],
        "R": ["S113", "S114", "S119", "S120"],
        "why": "Junction quality is most of what is being paid for, so detail and material slides escalate.",
    },
    "G4": {  # Luxury flagship
        "M": ["S111", "S113", "S114", "S119", "S121"],
        "R": ["S112", "S116", "S120", "S082"],
        "why": "Longest deck. Art programme, provenance and bespoke joinery all earn their own slides.",
    },
}

# ---------------------------------------------------------------------------
# Scale rules (axis C) — the strongest driver of deck LENGTH
# ---------------------------------------------------------------------------

SCALE_RULES = {
    "SC1": {  # Seed (up to 50 seats)
        "down": ["S002", "S008", "S010", "S032", "S040", "S041", "S063", "S064",
                 "S068", "S080", "S114", "S150", "S156"],
        "X": ["S005", "S006", "S036", "S049", "S070", "S110", "S130", "S139", "S153", "S157", "S158"],
        "why": "Under 50 seats, process slides cost more attention than they buy.",
    },
    "SC2": {  # Scale-up (50-300)
        "down": ["S002", "S063"],
        "why": "Trim the institutional slides; keep the full planning section.",
    },
    "SC3": {"why": "Mid-market. The library's default assumption — no adjustment."},
    "SC4": {  # Enterprise (800-2000)
        "R": ["S049", "S070", "S137", "S156", "S160"],
        "why": "Governance and standards slides start to matter at this size.",
    },
    "SC5": {  # Campus (2000+)
        "M": ["S049", "S070", "S156"],
        "R": ["S063", "S137", "S139", "S158", "S160"],
        "why": "Stacking and space standards become mandatory; multi-floor coordination is the hard part.",
    },
}

# ---------------------------------------------------------------------------
# Project-nature rules (axis D)
# ---------------------------------------------------------------------------

NATURE_RULES = {
    "N1": {  # Greenfield fit-out
        "X": ["S033"],
        "why": "There are no existing conditions to survey.",
    },
    "N2": {  # Refurbishment / retrofit
        "M": ["S033"],
        "R": ["S046", "S157", "S036"],
        "why": "The existing condition is the baseline, and before/after is the most persuasive slide available.",
    },
    "N3": {  # Expansion floor
        "M": ["S049"],
        "O": ["S013", "S014", "S042", "S044"],
        "X": ["S033"],
        "why": "Matching the existing standard matters more than establishing a new concept.",
    },
    "N4": {  # Consolidation
        "M": ["S017", "S063"],
        "R": ["S070", "S160"],
        "why": "Merging sites is an adjacency and change problem before it is a design one.",
    },
    "N5": {  # Relocation
        "R": ["S031", "S019", "S160"],
        "why": "Commute and change impact are live concerns — location and journey earn more time.",
    },
    "N6": {  # Showcase only
        "X": ["S017", "S018", "S067", "S068", "S083"],
        "O": ["S061", "S066"],
        "why": "Nobody is assigned a desk here, so capacity slides are misleading.",
    },
}


# ---------------------------------------------------------------------------
# Resolution
# ---------------------------------------------------------------------------

def _apply(rules, slide_id, current, excluded):
    """Fold one rule block into the running level.

    Demote first, then escalate — so a block that both trims a section and
    pulls one slide back out of it behaves the way it reads.
    """
    if not rules:
        return current
    if slide_id in rules.get("X", ()):
        excluded.add(slide_id)
        return -1
    if slide_id in rules.get("down", ()):
        current = min(current, LEVELS["O"])
    for lvl in ("O", "R", "M"):
        if slide_id in rules.get(lvl, ()):
            current = max(current, LEVELS[lvl])
    return current


def resolve(slide, typology=None, concepts=(), grade=None, scale=None, nature=None):
    """Return the level (M/R/O/X) for one slide under one project profile.

    `slide` is a dict with at least `id` and `baseline`.
    """
    sid = slide["id"]
    excluded = set()

    # A special space is X everywhere except for the typologies that own it.
    if sid in SPECIAL_SPACES:
        owners = SPECIAL_SPACES[sid]
        if typology not in owners:
            return "X"
        current = LEVELS[owners[typology]]
    else:
        current = LEVELS[slide["baseline"]]

    # Typology first, and its exclusions are final.
    if typology:
        current = _apply(TYPOLOGY_RULES.get(typology), sid, current, excluded)
        if sid in excluded:
            return "X"

    # Nature exclusions are also final — a surveyed existing condition cannot
    # be escalated into a building that does not exist yet.
    if nature:
        current = _apply(NATURE_RULES.get(nature), sid, current, excluded)
        if sid in excluded:
            return "X"

    for concept in concepts:
        current = _apply(CONCEPT_RULES.get(concept), sid, current, excluded)
    current = _apply(GRADE_RULES.get(grade), sid, current, excluded)
    current = _apply(SCALE_RULES.get(scale), sid, current, excluded)

    if sid in excluded:
        return "X"
    return LEVEL_NAMES[current]


def build_deck(slides, typology=None, concepts=(), grade=None, scale=None,
               nature=None, include_optional=False):
    """The engine in miniature: resolve every slide, keep what survives, and
    return it in library order (which is deck order)."""
    out = []
    for s in slides:
        lvl = resolve(s, typology, concepts, grade, scale, nature)
        if lvl == "M" or lvl == "R" or (include_optional and lvl == "O"):
            out.append((s, lvl))
    return out


# ---------------------------------------------------------------------------
# The four worked examples the system was commissioned against
# ---------------------------------------------------------------------------

EXAMPLE_DECKS = [
    {
        "id": "EX1",
        "label": "IT + Biophilic",
        "typology": "T01",
        "concepts": ["C01"],
        "grade": "G2",
        "scale": "SC3",
        "nature": "N1",
        "story": (
            "A mid-size IT services company taking a new floor. The deck argues "
            "desk-sharing from real attendance data, then spends its design budget "
            "on daylight and planting. Planting plan and daylight study become "
            "mandatory; the acoustic slide stays standard because the ceiling is not exposed."
        ),
    },
    {
        "id": "EX2",
        "label": "Managed Workspace + Premium",
        "typology": "T04",
        "concepts": ["C02"],
        "grade": "G3",
        "scale": "SC3",
        "nature": "N1",
        "story": (
            "An operator building a premium centre. Everything is framed as yield — "
            "area statement, workstation mix and sellable cabins are mandatory, and "
            "community space is a revenue line rather than an amenity. Premium grade "
            "pulls in detail junctions and the boardroom. The brand slides drop to "
            "optional because a future tenant cannot inherit the client's story."
        ),
    },
    {
        "id": "EX3",
        "label": "GCC + Contemporary",
        "typology": "T02",
        "concepts": ["C02"],
        "grade": "G2",
        "scale": "SC4",
        "nature": "N1",
        "story": (
            "A captive centre conforming to a parent's global workplace standard. "
            "Kit of parts, AV standard, IT infrastructure and security zoning are all "
            "mandatory, and the agenda slide is too because the deck will be read "
            "asynchronously overseas without a presenter."
        ),
    },
    {
        "id": "EX4",
        "label": "Startup + Collaborative",
        "typology": "T03",
        "concepts": ["C03"],
        "grade": "G1",
        "scale": "SC2",
        "nature": "N1",
        "story": (
            "A Series-B company that wants activity-based working. The startup "
            "typology strips the deck to its shortest form, but the Collaborative "
            "concept pushes back on four slides it would otherwise have cut — "
            "settings, workplace model, work styles and booths. That collision is "
            "the clearest demonstration of why levels resolve by MAX rather than by "
            "last-rule-wins."
        ),
    },
]
