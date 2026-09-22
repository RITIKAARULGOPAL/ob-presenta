"""Typology and design-concept models for Presenta's template engine.

Why two structures instead of one list
--------------------------------------
The four examples this system was commissioned from — IT, GCC, Startup,
Managed Workspace — are not the same kind of thing:

    IT               an industry sector
    GCC              an occupancy model (a captive centre; its sector is
                     usually IT or BFSI, but need not be)
    Startup          a company stage
    Managed Workspace a real-estate model (the client operates the space and
                     sub-lets it; they are not the end user)

A flat list conflates them, and the conflation is not academic: "IT + Startup"
and "IT + GCC" are both real, common projects, and a flat list cannot express
either without inventing a combinatorial row for every pair. So the model is:

  * TYPOLOGIES — the 16 labels a project actually gets tagged with in a sales
    conversation. This is what a user picks in the UI.
  * AXES — 5 independent attributes. Every typology declares a default value
    per axis, but a project may override any of them. Rules read axes, not
    typology labels, wherever the rule is really about an attribute (deck
    length is about scale, not about being an IT company).

Grade is an axis, not a design concept
--------------------------------------
"Premium" was given as a design concept alongside Biophilic and Contemporary.
It behaves differently: Premium Biophilic and Premium Industrial are both
coherent, so Premium composes with the character themes rather than competing
with them. Modelling it as a 13th theme would make the concept dimension
non-orthogonal and produce rules that contradict each other. It lives on
axis E instead.
"""

# ---------------------------------------------------------------------------
# Axes — the engine's real input schema
# ---------------------------------------------------------------------------

AXES = [
    {
        "axis_id": "A",
        "axis": "Occupancy model",
        "question": "Who occupies the space, and who is paying for the fit-out?",
        "why_it_matters": (
            "Decides whose brand the deck speaks in and who the audience is. An "
            "operator is selling seats to future tenants; an enterprise is "
            "selling a workplace to its own leadership."
        ),
        "values": [
            "Enterprise HQ",
            "Captive GCC",
            "Operator coworking",
            "Managed / BTS single tenant",
            "Satellite / branch",
            "Flex within enterprise",
        ],
    },
    {
        "axis_id": "B",
        "axis": "Industry sector",
        "question": "What does the business actually do?",
        "why_it_matters": (
            "Drives compliance load, the special-space list (trading floor, lab, "
            "studio), security zoning and the imagery register."
        ),
        "values": [
            "IT & Technology Services",
            "BFSI",
            "Consulting & Professional Services",
            "Legal",
            "E-commerce & Logistics",
            "Healthcare / Pharma / Life Sciences",
            "R&D / Engineering / Hardware",
            "Manufacturing & Industrial",
            "Media / Creative / D2C",
            "Education & EdTech",
            "Government / PSU / Institutional",
            "Real Estate & Workspace Operator",
        ],
    },
    {
        "axis_id": "C",
        "axis": "Stage & scale",
        "question": "How big is the organisation and how settled is it?",
        "why_it_matters": (
            "The single strongest driver of deck LENGTH and of how much process "
            "the client will sit through. Across the rules as written, a "
            "seed-stage startup resolves to about 27 slides and a campus-scale "
            "GCC to about 59 — the same library, sized to the audience."
        ),
        "values": [
            "Seed (up to 50 seats)",
            "Scale-up (50-300 seats)",
            "Mid-market (300-800 seats)",
            "Enterprise (800-2000 seats)",
            "Campus (2000+ seats)",
        ],
    },
    {
        "axis_id": "D",
        "axis": "Project nature",
        "question": "What kind of work is this?",
        "why_it_matters": (
            "Decides whether existing-condition, phasing and "
            "live-site-working slides are mandatory or meaningless."
        ),
        "values": [
            "Greenfield fit-out",
            "Refurbishment / retrofit",
            "Expansion floor",
            "Consolidation",
            "Relocation",
            "Showcase only",
        ],
    },
    {
        "axis_id": "E",
        "axis": "Grade",
        "question": "Where does this sit on the cost/finish ladder?",
        "why_it_matters": (
            "Composes with any character theme. Governs material specification, "
            "how much of the deck is spent on detail and mock-ups, and whether "
            "cost is framed as value-per-seat or as craft."
        ),
        "values": [
            "Value / functional",
            "Standard corporate",
            "Premium",
            "Luxury flagship",
        ],
    },
]


# ---------------------------------------------------------------------------
# The 16 primary typologies
# ---------------------------------------------------------------------------
# Deck length is deliberately NOT stored here. It is computed from the rules
# at build time (see build_sheet.py), because a hand-written "typical length"
# drifts away from what the engine actually produces the first time a rule
# changes, and then quietly misleads whoever trusts it.
# ---------------------------------------------------------------------------
# default_* are DEFAULTS the engine pre-fills, not constraints. A GCC can be
# Seed-stage (a first 40-seat bridgehead site) and the user may say so.

TYPOLOGIES = [
    {
        "id": "T01",
        "name": "IT / Technology Services Office",
        "short": "IT",
        "definition": (
            "A product or services technology company occupying space for its own "
            "staff — engineering, product, support and the business functions "
            "around them."
        ),
        "default_occupancy": "Enterprise HQ",
        "default_sector": "IT & Technology Services",
        "default_scale": "Mid-market (300-800 seats)",
        "default_nature": "Greenfield fit-out",
        "default_grade": "Standard corporate",
        "signature_spaces": (
            "Dense open workhall; high meeting-room-to-seat ratio; phone booths at "
            "scale; war rooms; large cafeteria doubling as town hall"
        ),
        "drives_the_deck": (
            "Hybrid AV in every room, and a defensible desk-sharing ratio. "
            "Attendance data is the argument, not an aside."
        ),
        "audience": "Workplace/Facilities lead + IT + Finance",
        "watch_out": (
            "Engineering-heavy audiences distrust mood boards without plans; lead "
            "with capacity and adjacency, not materials."
        ),
    },
    {
        "id": "T02",
        "name": "GCC / Global Capability Centre",
        "short": "GCC",
        "definition": (
            "A captive offshore centre delivering work for a foreign parent. The "
            "occupier is a subsidiary; the standards usually are not theirs to set."
        ),
        "default_occupancy": "Captive GCC",
        "default_sector": "IT & Technology Services",
        "default_scale": "Enterprise (800-2000 seats)",
        "default_nature": "Greenfield fit-out",
        "default_grade": "Standard corporate",
        "signature_spaces": (
            "Shift-based workhall; follow-the-sun collaboration rooms aligned to "
            "parent time zones; town hall; large cafeteria; transport lobby"
        ),
        "drives_the_deck": (
            "Conformance to the parent's global workplace standard is the spine of "
            "the deck. Every deviation must be shown and justified, and the deck "
            "will be reviewed by people who are not in the country."
        ),
        "audience": "India site lead + global workplace standards team + parent RE",
        "watch_out": (
            "The deck is read asynchronously overseas, so it must stand alone "
            "without a presenter — notes and annotations matter more than usual."
        ),
    },
    {
        "id": "T03",
        "name": "Startup / High-growth Office",
        "short": "Startup",
        "definition": (
            "An early or fast-scaling company where headcount at handover is a "
            "guess and the workplace is part of the hiring pitch."
        ),
        "default_occupancy": "Enterprise HQ",
        "default_sector": "IT & Technology Services",
        "default_scale": "Scale-up (50-300 seats)",
        "default_nature": "Greenfield fit-out",
        "default_grade": "Value / functional",
        "signature_spaces": (
            "Flexible open plan; almost no cabins; one all-hands space; "
            "café-as-workspace; a founder-visible war room"
        ),
        "drives_the_deck": (
            "Growth headroom and cost per seat. The plan must visibly survive a "
            "40% headcount swing in either direction."
        ),
        "audience": "Founder / COO, deciding fast and often alone",
        "watch_out": (
            "Short attention, fast decisions. A 50-slide deck loses this client; "
            "compress process slides into one."
        ),
    },
    {
        "id": "T04",
        "name": "Managed Workspace - Operator Centre",
        "short": "Managed Workspace",
        "definition": (
            "A coworking or managed-workspace operator fitting out a centre they "
            "will sub-let. The people in the space are not the client's staff."
        ),
        "default_occupancy": "Operator coworking",
        "default_sector": "Real Estate & Workspace Operator",
        "default_scale": "Mid-market (300-800 seats)",
        "default_nature": "Greenfield fit-out",
        "default_grade": "Standard corporate",
        "signature_spaces": (
            "Sellable private cabins at several sizes; hot-desk lounge; community "
            "/ event space; premium meeting suites let by the hour; phone booths"
        ),
        "drives_the_deck": (
            "Sellable seats per sq ft and revenue mix are the argument. Design is "
            "evaluated as a yield instrument, not as taste."
        ),
        "audience": "Operator's design head + expansion/revenue lead",
        "watch_out": (
            "Brand must stay neutral enough to host any tenant. Resist "
            "client-specific storytelling that a future tenant cannot inherit."
        ),
    },
    {
        "id": "T05",
        "name": "Managed Office / Build-to-Suit",
        "short": "Managed Office",
        "definition": (
            "An operator builds and runs the space, but a single named client "
            "occupies all of it and expects it to feel like theirs."
        ),
        "default_occupancy": "Managed / BTS single tenant",
        "default_sector": "Real Estate & Workspace Operator",
        "default_scale": "Mid-market (300-800 seats)",
        "default_nature": "Greenfield fit-out",
        "default_grade": "Standard corporate",
        "signature_spaces": (
            "Client-branded reception; standard workhall; operator back-of-house; "
            "housekeeping and pantry ops zones"
        ),
        "drives_the_deck": (
            "Two audiences at once: the operator (who must run it) and the tenant "
            "(who must love it). Operations, SLA and BOH earn real slide time here "
            "and almost nowhere else."
        ),
        "audience": "Operator delivery team + the end client's workplace lead",
        "watch_out": (
            "Ownership of change requests after handover is the most common "
            "dispute — cover it explicitly."
        ),
    },
    {
        "id": "T06",
        "name": "BFSI Office",
        "short": "BFSI",
        "definition": (
            "Banking, financial services or insurance — regulated, audited, and "
            "usually client-facing on at least one floor."
        ),
        "default_occupancy": "Enterprise HQ",
        "default_sector": "BFSI",
        "default_scale": "Enterprise (800-2000 seats)",
        "default_nature": "Greenfield fit-out",
        "default_grade": "Premium",
        "signature_spaces": (
            "Dealing / trading floor; client meeting suite segregated from staff "
            "areas; secure records; compliance-restricted zones; formal boardroom"
        ),
        "drives_the_deck": (
            "Security zoning and regulatory segregation are design drivers, not "
            "an annexe. Access hierarchy gets its own slide."
        ),
        "audience": "Facilities + Compliance + Security + Brand",
        "watch_out": (
            "Compliance sign-off can veto a plan late. Show the restricted-zone "
            "logic before the pretty renders."
        ),
    },
    {
        "id": "T07",
        "name": "Consulting & Professional Services",
        "short": "Consulting",
        "definition": (
            "Consulting, audit, accountancy or advisory — high-salary staff who "
            "are mostly at a client site, and a client suite that must impress."
        ),
        "default_occupancy": "Enterprise HQ",
        "default_sector": "Consulting & Professional Services",
        "default_scale": "Mid-market (300-800 seats)",
        "default_nature": "Greenfield fit-out",
        "default_grade": "Premium",
        "signature_spaces": (
            "Hotelling desks with booking; client-facing meeting suite; partner "
            "cabins; quiet rooms; project/war rooms"
        ),
        "drives_the_deck": (
            "Low real attendance against high headcount. Desk-sharing ratio is the "
            "commercial argument, and the client suite is the brand argument."
        ),
        "audience": "Partner group + Operations",
        "watch_out": (
            "Partners will negotiate cabin entitlement individually. Make the "
            "hierarchy rule explicit and visual early."
        ),
    },
    {
        "id": "T08",
        "name": "Legal / Chambers",
        "short": "Legal",
        "definition": (
            "Law firms and chambers — cellular by nature, confidentiality-bound, "
            "and materially conservative."
        ),
        "default_occupancy": "Enterprise HQ",
        "default_sector": "Legal",
        "default_scale": "Scale-up (50-300 seats)",
        "default_nature": "Greenfield fit-out",
        "default_grade": "Premium",
        "signature_spaces": (
            "Cellular offices; library / archive; secure file storage; formal "
            "reception and client waiting; deposition / conference rooms"
        ),
        "drives_the_deck": (
            "Acoustic privacy is a legal requirement, not a comfort preference. "
            "Open-plan proposals need a defence."
        ),
        "audience": "Managing partner + office manager",
        "watch_out": (
            "Do not lead with open-plan or ABW. Show the acoustic strategy before "
            "proposing any shared setting."
        ),
    },
    {
        "id": "T09",
        "name": "E-commerce & Logistics Corporate",
        "short": "E-commerce",
        "definition": (
            "The corporate office of an e-commerce, quick-commerce or logistics "
            "business — operations-led, often running around the clock."
        ),
        "default_occupancy": "Enterprise HQ",
        "default_sector": "E-commerce & Logistics",
        "default_scale": "Enterprise (800-2000 seats)",
        "default_nature": "Greenfield fit-out",
        "default_grade": "Standard corporate",
        "signature_spaces": (
            "Control tower / ops floor with screen wall; large war rooms; 24x7 "
            "zones with their own pantry and rest area; high-turnover cafeteria"
        ),
        "drives_the_deck": (
            "Peak-season surge capacity and genuine 24x7 operation. The plan has "
            "to work at 3am on the busiest night of the year."
        ),
        "audience": "Operations head + Workplace + HR",
        "watch_out": (
            "Shift overlap doubles occupancy at handover times — size circulation "
            "and amenities for the overlap, not the average."
        ),
    },
    {
        "id": "T10",
        "name": "Healthcare / Pharma / Life Sciences",
        "short": "Healthcare",
        "definition": (
            "Corporate and R&D-adjacent offices for healthcare, pharma or life "
            "sciences organisations, under regulated conditions."
        ),
        "default_occupancy": "Enterprise HQ",
        "default_sector": "Healthcare / Pharma / Life Sciences",
        "default_scale": "Mid-market (300-800 seats)",
        "default_nature": "Greenfield fit-out",
        "default_grade": "Standard corporate",
        "signature_spaces": (
            "Controlled-access document and sample storage; clean-adjacent "
            "corridors; wellness rooms; training auditorium; visitor segregation"
        ),
        "drives_the_deck": (
            "Regulated adjacency and material hygiene. Finishes are selected for "
            "cleanability and certification before appearance."
        ),
        "audience": "Facilities + Quality/Regulatory + EHS",
        "watch_out": (
            "Quality/Regulatory can reject a specified finish outright. Get the "
            "material schedule in front of them early."
        ),
    },
    {
        "id": "T11",
        "name": "R&D / Engineering Centre",
        "short": "R&D",
        "definition": (
            "An engineering, semiconductor or hardware R&D centre where labs and "
            "office space share a floor plate and an IP boundary."
        ),
        "default_occupancy": "Enterprise HQ",
        "default_sector": "R&D / Engineering / Hardware",
        "default_scale": "Mid-market (300-800 seats)",
        "default_nature": "Greenfield fit-out",
        "default_grade": "Standard corporate",
        "signature_spaces": (
            "Lab / office interface zone; prototype and test areas; secure IP "
            "zones; heavy-services rooms; equipment staging and goods route"
        ),
        "drives_the_deck": (
            "The lab boundary governs everything: services load, vibration, "
            "access control and the goods route all precede aesthetics."
        ),
        "audience": "Engineering leadership + EHS + IT security",
        "watch_out": (
            "Services capacity is usually the binding constraint. Confirm it "
            "before committing to any lab adjacency."
        ),
    },
    {
        "id": "T12",
        "name": "Manufacturing / Plant-attached Corporate",
        "short": "Manufacturing",
        "definition": (
            "A corporate office attached to or serving a plant — office staff and "
            "plant staff share entrances, canteens and a safety culture."
        ),
        "default_occupancy": "Enterprise HQ",
        "default_sector": "Manufacturing & Industrial",
        "default_scale": "Mid-market (300-800 seats)",
        "default_nature": "Refurbishment / retrofit",
        "default_grade": "Value / functional",
        "signature_spaces": (
            "Office-to-plant transition and PPE zone; visitor safety induction "
            "room; shared canteen; training rooms; durable circulation"
        ),
        "drives_the_deck": (
            "The office/plant interface and the safety induction sequence. "
            "Durability beats delicacy in every material call."
        ),
        "audience": "Plant head + EHS + HR",
        "watch_out": (
            "Plant staff and office staff have different expectations of the same "
            "canteen. Show both journeys, not an averaged one."
        ),
    },
    {
        "id": "T13",
        "name": "Media / Creative / D2C Studio",
        "short": "Media",
        "definition": (
            "Agencies, production houses, and direct-to-consumer brands where the "
            "office is itself a brand artefact and often a shoot location."
        ),
        "default_occupancy": "Enterprise HQ",
        "default_sector": "Media / Creative / D2C",
        "default_scale": "Scale-up (50-300 seats)",
        "default_nature": "Refurbishment / retrofit",
        "default_grade": "Standard corporate",
        "signature_spaces": (
            "Shoot / content studio; edit suites with acoustic treatment; product "
            "and sample display; informal-first collaboration; a photographable "
            "hero moment"
        ),
        "drives_the_deck": (
            "The office doubles as a set and a showroom. Lighting quality and "
            "photogenic moments are functional requirements here."
        ),
        "audience": "Founder / Creative director / Brand lead",
        "watch_out": (
            "This audience out-designs most decks in their own field. Show "
            "restraint and craft; generic corporate renders read as lazy."
        ),
    },
    {
        "id": "T14",
        "name": "Education / EdTech Campus Office",
        "short": "Education",
        "definition": (
            "Offices for education providers and EdTech companies, usually with "
            "teaching, recording or assembly space on the same floor."
        ),
        "default_occupancy": "Enterprise HQ",
        "default_sector": "Education & EdTech",
        "default_scale": "Scale-up (50-300 seats)",
        "default_nature": "Greenfield fit-out",
        "default_grade": "Value / functional",
        "signature_spaces": (
            "Classroom / lab hybrid rooms; recording studios; large assembly "
            "space; counselling and admissions rooms; student waiting"
        ),
        "drives_the_deck": (
            "Peak assembly load and acoustic separation between teaching and "
            "recording. Durability under heavy young footfall."
        ),
        "audience": "Academic head + Operations + Admissions",
        "watch_out": (
            "Timetable peaks, not headcount, size the circulation and the "
            "washrooms. Ask for the timetable."
        ),
    },
    {
        "id": "T15",
        "name": "Government / PSU / Institutional",
        "short": "Government",
        "definition": (
            "Public-sector, PSU and institutional offices — hierarchical, "
            "tender-governed and open to the public."
        ),
        "default_occupancy": "Enterprise HQ",
        "default_sector": "Government / PSU / Institutional",
        "default_scale": "Mid-market (300-800 seats)",
        "default_nature": "Refurbishment / retrofit",
        "default_grade": "Value / functional",
        "signature_spaces": (
            "Rank-allocated cabins; public interface and grievance counter; "
            "records room; committee and conference rooms; public waiting"
        ),
        "drives_the_deck": (
            "Entitlement norms and tender compliance define the plan before "
            "design begins. Deviation needs written justification."
        ),
        "audience": "Department head + Works/Engineering wing + Audit",
        "watch_out": (
            "Cabin sizes are often fixed by published norms. Confirm the "
            "applicable schedule before planning anything."
        ),
    },
    {
        "id": "T16",
        "name": "Experience Centre / Innovation Hub",
        "short": "Experience Centre",
        "definition": (
            "A briefing centre, innovation hub or showcase space whose purpose is "
            "to be visited rather than worked in."
        ),
        "default_occupancy": "Enterprise HQ",
        "default_sector": "IT & Technology Services",
        "default_scale": "Seed (up to 50 seats)",
        "default_nature": "Showcase only",
        "default_grade": "Luxury flagship",
        "signature_spaces": (
            "Narrative visitor journey; demo and immersion zones; AV-led feature "
            "walls; hospitality and VIP lounge; a briefing theatre"
        ),
        "drives_the_deck": (
            "The visitor's route IS the design. Sequence, dwell time and reveal "
            "order carry more slides than desking ever will."
        ),
        "audience": "Marketing / Brand + Sales leadership",
        "watch_out": (
            "Content and AV are usually a separate vendor on a different "
            "timeline. Fix the interface early or it derails handover."
        ),
    },
]


# ---------------------------------------------------------------------------
# Design concepts — 12 character themes
# ---------------------------------------------------------------------------

CONCEPTS = [
    {
        "id": "C01",
        "name": "Biophilic",
        "one_line": "Bring measurable nature into daily contact, not decoration.",
        "palette": "Forest and olive greens, clay, oat, raw timber, off-white",
        "materials": "Live planting, timber veneer, cork, natural stone, jute, rattan",
        "lighting": "Daylight-first, circadian tuning, dappled feature lighting",
        "imagery": "Planted interiors, daylight studies, green walls, courtyards, texture close-ups",
        "copy_tone": "Calm, evidence-led; cite wellbeing and productivity research",
        "extra_slides": "Planting plan, daylight study, maintenance and irrigation plan",
        "watch_out": "Planting without an irrigation and maintenance contract dies in 6 months — say who waters it.",
    },
    {
        "id": "C02",
        "name": "Contemporary / Minimal",
        "one_line": "Reduce to essentials; let proportion and light do the work.",
        "palette": "White, warm grey, black accents, single restrained accent hue",
        "materials": "Micro-cement, matt laminate, glass, powder-coated steel, terrazzo",
        "lighting": "Linear recessed, concealed cove, minimal fittings",
        "imagery": "Clean wide shots, strong geometry, negative space, few props",
        "copy_tone": "Spare and confident; short lines, no adjective stacking",
        "extra_slides": "Detail junctions, ceiling-and-services coordination",
        "watch_out": "Minimal shows every tolerance. Detail and site quality must be budgeted, or it reads cheap.",
    },
    {
        "id": "C03",
        "name": "Collaborative (ABW)",
        "one_line": "Give people a setting per task instead of one desk for everything.",
        "palette": "Zone-coded accents over a neutral base",
        "materials": "Acoustic felt, writable surfaces, soft seating, mobile screens",
        "lighting": "Task-layered, brighter at collaboration nodes",
        "imagery": "People in varied postures and settings, activity over architecture",
        "copy_tone": "Behavioural and practical; name the task each setting serves",
        "extra_slides": "Settings menu, protocol/etiquette, change management, booking tech",
        "watch_out": "ABW fails without an adoption programme. Budget the change management or it reverts to assigned desks in a quarter.",
    },
    {
        "id": "C04",
        "name": "Industrial / Raw",
        "one_line": "Leave the building's structure and services legible.",
        "palette": "Concrete grey, black steel, rust, natural ply",
        "materials": "Exposed soffit and services, mild steel, reclaimed timber, brick",
        "lighting": "Suspended track and industrial fittings, visible conduit",
        "imagery": "Exposed ceilings, structure close-ups, high-contrast shots",
        "copy_tone": "Direct and honest; talk about what is revealed rather than added",
        "extra_slides": "Exposed-services coordination, acoustic compensation strategy",
        "watch_out": "Exposed soffits wreck acoustics and raise HVAC load. Show the acoustic compensation in the same breath.",
    },
    {
        "id": "C05",
        "name": "Heritage & Local Context",
        "one_line": "Root the workplace in its region's craft, material and story.",
        "palette": "Regional earth tones, indigo, brass, terracotta",
        "materials": "Local stone, handmade tile, regional craft inlay, brass, khadi textile",
        "lighting": "Warm, layered, feature lighting on craft elements",
        "imagery": "Craft detail macros, artisan process, regional architecture references",
        "copy_tone": "Narrative; name the craft, the region and the maker",
        "extra_slides": "Craft sourcing and artisan partners, storytelling wall, art commissioning plan",
        "watch_out": "Craft procurement has long, unreliable lead times. Put it on the programme slide, not in a footnote.",
    },
    {
        "id": "C06",
        "name": "Brand-Immersive / Playful",
        "one_line": "Make the workplace unmistakably, legibly this company.",
        "palette": "The brand palette, used at architectural scale",
        "materials": "Colour-blocked surfaces, custom graphics, signage-as-architecture, feature joinery",
        "lighting": "Accent and colour-wash on brand moments",
        "imagery": "Bold graphic interiors, branded thresholds, feature walls",
        "copy_tone": "Energetic and brand-voiced; borrow the client's own language",
        "extra_slides": "Brand landscape, graphics and wayfinding family, feature-moment map",
        "watch_out": "Brand refreshes outpace fit-outs. Keep the boldest colour on replaceable surfaces, not on tile and stone.",
    },
    {
        "id": "C07",
        "name": "Wellness-First",
        "one_line": "Design around comfort, recovery and human health outcomes.",
        "palette": "Soft neutrals, muted blue-green, pale timber",
        "materials": "Low-VOC finishes, acoustic ceilings, ergonomic furniture, tactile textiles",
        "lighting": "Circadian tuning, glare control, individual user control",
        "imagery": "Quiet rooms, wellness spaces, ergonomic detail, natural light",
        "copy_tone": "Care-led and specific; prefer measurable claims to vague comfort",
        "extra_slides": "Wellness amenity set, acoustic comfort strategy, air-quality approach, ergonomics standard",
        "watch_out": "Wellness claims invite measurement. Only claim what you will actually commission and test.",
    },
    {
        "id": "C08",
        "name": "Sustainable / Certified Green",
        "one_line": "Design to a certifiable environmental standard and prove it.",
        "palette": "Natural, low-processed, honest finishes",
        "materials": "Recycled and rapidly-renewable content, FSC timber, low-VOC, reused elements",
        "lighting": "High-efficiency fittings, daylight harvesting, occupancy control",
        "imagery": "Material provenance, reuse before/after, certification scorecards",
        "copy_tone": "Evidence-led; cite the standard, the credit and the number",
        "extra_slides": "Certification pathway and scorecard, material provenance, reuse inventory, energy and water strategy",
        "watch_out": "Certification targets change the programme and the budget. Commit to a rating level early or not at all.",
    },
    {
        "id": "C09",
        "name": "Tech-Forward / Smart",
        "one_line": "Let the building sense, respond and report.",
        "palette": "Cool neutrals, deep charcoal, luminous accents",
        "materials": "Integrated screens, seamless surfaces, concealed services, glass",
        "lighting": "Scene-controlled, sensor-driven, integrated with booking",
        "imagery": "Interfaces in situ, sensors, dashboards, AV-integrated rooms",
        "copy_tone": "Systems-led; name the platform and the integration",
        "extra_slides": "Smart-workplace stack, sensor and data plan, AV standard by room type, booking integration",
        "watch_out": "Occupancy sensing is a privacy conversation. Get HR and Legal in the room before it is specified.",
    },
    {
        "id": "C10",
        "name": "Warm Minimal (Japandi)",
        "one_line": "Minimal discipline, warmed by timber, texture and softness.",
        "palette": "Oat, warm white, pale timber, soft charcoal, muted sage",
        "materials": "Pale oak, linen, paper-effect surfaces, matt ceramic, rattan",
        "lighting": "Warm, low-glare, generous indirect light",
        "imagery": "Soft daylight, quiet compositions, texture and grain close-ups",
        "copy_tone": "Quiet and considered; restraint in the writing as well",
        "extra_slides": "Texture and material close-ups, furniture curation",
        "watch_out": "Pale timber and linen mark and stain fast. Check the maintenance regime honestly before specifying.",
    },
    {
        "id": "C11",
        "name": "Monochrome / Editorial",
        "one_line": "A gallery-like envelope that puts people and work in the frame.",
        "palette": "Black, white, greyscale, one disciplined accent",
        "materials": "Matt black metal, plaster, polished concrete, glass, neutral textile",
        "lighting": "Gallery-grade track and accent lighting, high contrast",
        "imagery": "High-contrast architectural photography, strong typography",
        "copy_tone": "Editorial and typographic; let layout carry the emphasis",
        "extra_slides": "Art and graphics programme, typography and signage system",
        "watch_out": "High contrast is hard on screen work and on accessibility. Check luminance ratios at desks.",
    },
    {
        "id": "C12",
        "name": "Resimercial / Homely",
        "one_line": "Use domestic comfort to make an office worth commuting to.",
        "palette": "Warm neutrals, terracotta, muted blue, timber",
        "materials": "Upholstered seating, rugs, curtains, domestic-scale lighting, open shelving",
        "lighting": "Layered lamps and pendants at domestic scale, warm temperature",
        "imagery": "Lounge settings, soft seating vignettes, people at ease",
        "copy_tone": "Warm and human; talk about belonging and choice",
        "extra_slides": "Settings vignettes, soft-furnishing specification and cleaning regime",
        "watch_out": "Domestic fabrics fail commercial abrasion and fire ratings. Specify contract-grade equivalents.",
    },
]


# ---------------------------------------------------------------------------
# Grade modifiers — axis E. Composes with any concept above.
# ---------------------------------------------------------------------------

GRADES = [
    {
        "id": "G1",
        "name": "Value / functional",
        "cost_framing": "Cost per seat, and what was deliberately left out",
        "material_shift": "Laminate, vinyl, modular ceilings, standard catalogue furniture",
        "deck_effect": "Shortest deck. Merge space-by-space slides into grouped ones; cut detail and mock-up slides.",
    },
    {
        "id": "G2",
        "name": "Standard corporate",
        "cost_framing": "Budget summary against a benchmark",
        "material_shift": "Veneer accents, engineered stone at key points, good contract furniture",
        "deck_effect": "The baseline the library is written to. No adjustment.",
    },
    {
        "id": "G3",
        "name": "Premium",
        "cost_framing": "Value and lifecycle, not unit rate",
        "material_shift": "Natural stone, real veneer, designer furniture, bespoke joinery",
        "deck_effect": "Adds detail, material-sample and lighting slides; space-by-space slides split rather than merge.",
    },
    {
        "id": "G4",
        "name": "Luxury flagship",
        "cost_framing": "Craft, provenance and commissioned pieces",
        "material_shift": "Marble, bespoke metalwork, commissioned art, bespoke lighting",
        "deck_effect": "Longest deck. Adds art programme, mock-up, bespoke-joinery and provenance slides.",
    },
]
