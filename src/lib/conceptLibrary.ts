// The generic office-design framework, as slide templates.
//
// Kept as typed data in the repo rather than a Postgres table on purpose: this
// is reference material that changes once in a blue moon, and a table would
// cost a migration, seeding and RLS for no gain. If non-developers ever need to
// edit the library without a deploy, that's when it earns a table.
//
// Source: "Generic Office Design Concepts — A consolidated framework for
// analysing and designing workplace environments" (Officebanao).

export interface DesignConcept {
  /** Stable slug — safe to persist in a slide, unlike an array index. */
  id: string;
  title: string;
  description: string;
}

export interface DesignPillar {
  id: string;
  /** Two-digit, matching the guide's own numbering. */
  numeral: string;
  title: string;
  /** The question this pillar answers — reads well as a section subtitle. */
  question: string;
  concepts: DesignConcept[];
}

export const DESIGN_PILLARS: DesignPillar[] = [
  {
    id: 'people',
    numeral: '01',
    title: 'People & User Needs',
    question: 'Who are we designing for?',
    concepts: [
      {
        id: 'user-profiles',
        title: 'User Profiles',
        description:
          'Understand departments, roles, seniority, work patterns, accessibility needs and visitor types.',
      },
      {
        id: 'work-styles',
        title: 'Work Styles',
        description:
          'Identify focused, collaborative, social, hybrid, mobile and meeting-heavy work. Support different modes rather than one fixed workstation model.',
      },
      {
        id: 'employee-experience',
        title: 'Employee Experience',
        description:
          'Consider the complete journey from arrival to departure: orientation, work, meetings, breaks, support and social interaction.',
      },
      {
        id: 'privacy-inclusion',
        title: 'Privacy & Inclusion',
        description:
          'Balance openness with acoustic, visual and personal privacy. Provide inclusive, accessible spaces for different abilities.',
      },
      {
        id: 'visitor-experience',
        title: 'Visitor Experience',
        description:
          'Control visitor movement where required while making reception, waiting and meeting areas welcoming.',
      },
    ],
  },
  {
    id: 'space-planning',
    numeral: '02',
    title: 'Space Planning',
    question: 'How should the workplace be organised?',
    concepts: [
      {
        id: 'zoning',
        title: 'Zoning',
        description:
          'Organise the workplace into logical public, collaborative, focused, social, support and service zones.',
      },
      {
        id: 'adjacency',
        title: 'Adjacency',
        description:
          'Place teams and functions according to how frequently they interact. High interaction should mean easier connections.',
      },
      {
        id: 'circulation',
        title: 'Circulation',
        description:
          'Create clear movement paths without disturbing focused work. Separate high-traffic routes from quiet areas where possible.',
      },
      {
        id: 'capacity-density',
        title: 'Capacity & Density',
        description:
          'Translate headcount, attendance patterns and workstation ratios into realistic area requirements.',
      },
      {
        id: 'flexibility',
        title: 'Flexibility',
        description: 'Allow spaces to change as teams grow, shrink or reorganise.',
      },
      {
        id: 'access-hierarchy',
        title: 'Access Hierarchy',
        description: 'Create a hierarchy of public, semi-private and private areas.',
      },
    ],
  },
  {
    id: 'work-settings',
    numeral: '03',
    title: 'Work Settings',
    question: 'What kinds of work must the space support?',
    concepts: [
      {
        id: 'focused-work',
        title: 'Focused Work',
        description: 'Quiet zones, individual workstations, libraries or focus rooms for concentration.',
      },
      {
        id: 'collaboration',
        title: 'Collaboration',
        description: 'Open collaboration areas, project tables, team zones and informal meeting points.',
      },
      {
        id: 'formal-meetings',
        title: 'Formal Meetings',
        description:
          'Meeting rooms sized and equipped for different group sizes and confidentiality levels.',
      },
      {
        id: 'informal-collaboration',
        title: 'Informal Collaboration',
        description:
          'Casual seating, huddle areas and touchdown spaces that encourage spontaneous interaction.',
      },
      {
        id: 'phone-video-calls',
        title: 'Phone & Video Calls',
        description: 'Phone booths and small rooms providing acoustic privacy.',
      },
      {
        id: 'training-multipurpose',
        title: 'Training & Multipurpose',
        description:
          'Rooms that can switch between training, workshops, town halls and other group activities.',
      },
      {
        id: 'social-breakout',
        title: 'Social & Breakout',
        description: 'Cafés, pantry areas, lounges and breakout spaces that support social connection.',
      },
      {
        id: 'wellness-recharge',
        title: 'Wellness / Recharge',
        description:
          'Quiet rooms, decompression areas or wellness spaces where the brief supports them.',
      },
    ],
  },
  {
    id: 'function-workflow',
    numeral: '04',
    title: 'Function & Workflow',
    question: 'How do people, teams and resources interact?',
    concepts: [
      {
        id: 'movement-workflow',
        title: 'Movement & Workflow',
        description:
          'Map how people, information and physical resources move through the workplace.',
      },
      {
        id: 'department-interaction',
        title: 'Department Interaction',
        description: 'Understand which teams need proximity and which need separation.',
      },
      {
        id: 'support-spaces',
        title: 'Support Spaces',
        description:
          'Plan print, storage, lockers, utility, server/IT and other back-of-house functions early.',
      },
      {
        id: 'meeting-patterns',
        title: 'Meeting Patterns',
        description:
          'Analyse meeting frequency, duration and group size before deciding the meeting-room mix.',
      },
      {
        id: 'storage',
        title: 'Storage',
        description: 'Provide the right balance of personal, team, archive and operational storage.',
      },
    ],
  },
  {
    id: 'experience-brand',
    numeral: '05',
    title: 'Experience & Brand',
    question: 'What should the workplace communicate and feel like?',
    concepts: [
      {
        id: 'brand-expression',
        title: 'Brand Expression',
        description:
          'Use architecture, graphics, colour and materiality to express organisational identity.',
      },
      {
        id: 'arrival',
        title: 'Arrival',
        description: 'Reception should establish orientation, security and the first impression.',
      },
      {
        id: 'materiality',
        title: 'Materiality',
        description:
          'Choose materials for durability, maintenance, acoustics, tactility and visual character.',
      },
      {
        id: 'placemaking',
        title: 'Placemaking',
        description:
          'Create memorable destinations that give the workplace identity and help people orient themselves.',
      },
      {
        id: 'storytelling',
        title: 'Storytelling',
        description:
          'Use graphics, artefacts and environmental cues to communicate culture, history, values or local context.',
      },
    ],
  },
  {
    id: 'environmental',
    numeral: '06',
    title: 'Environmental Design',
    question: 'How should the physical environment support comfort?',
    concepts: [
      {
        id: 'daylight-views',
        title: 'Daylight & Views',
        description:
          'Maximise useful daylight and access to views while controlling glare and heat gain.',
      },
      {
        id: 'lighting',
        title: 'Lighting',
        description: 'Layer ambient, task and feature lighting according to activity and comfort.',
      },
      {
        id: 'acoustics',
        title: 'Acoustics',
        description:
          'Control speech, reverberation and noise transfer through planning, finishes, ceilings and enclosed spaces.',
      },
      {
        id: 'thermal-comfort',
        title: 'Thermal Comfort',
        description: 'Consider temperature, air movement, solar exposure and user control.',
      },
      {
        id: 'indoor-air-quality',
        title: 'Indoor Air Quality',
        description:
          'Support ventilation and healthy indoor conditions through building systems and material choices.',
      },
      {
        id: 'biophilia',
        title: 'Biophilia',
        description:
          'Introduce plants, natural materials, patterns, views and other connections to nature.',
      },
    ],
  },
  {
    id: 'technology',
    numeral: '07',
    title: 'Technology',
    question: 'How does technology enable work?',
    concepts: [
      {
        id: 'power-data',
        title: 'Power & Data',
        description: 'Plan power, charging and data infrastructure around fixed and mobile work.',
      },
      {
        id: 'av-hybrid-work',
        title: 'AV & Hybrid Work',
        description:
          'Design rooms for reliable video conferencing, screen visibility, microphones and acoustics.',
      },
      {
        id: 'connectivity',
        title: 'Connectivity',
        description:
          'Support dependable wireless and wired connectivity across work and collaboration areas.',
      },
      {
        id: 'smart-workplace',
        title: 'Smart Workplace',
        description:
          'Room booking, occupancy information, digital wayfinding and analytics can improve operations when justified.',
      },
      {
        id: 'future-technology',
        title: 'Future Technology',
        description:
          'Keep infrastructure accessible and adaptable so technology can change without major disruption.',
      },
    ],
  },
  {
    id: 'wellbeing',
    numeral: '08',
    title: 'Wellbeing & Ergonomics',
    question: 'How do we support physical and mental wellbeing?',
    concepts: [
      {
        id: 'ergonomics',
        title: 'Ergonomics',
        description:
          'Provide appropriate furniture, monitor positioning, posture support and user adjustability.',
      },
      {
        id: 'movement',
        title: 'Movement',
        description:
          'Encourage movement through planning, stairs, varied settings and distributed amenities.',
      },
      {
        id: 'mental-recharge',
        title: 'Mental Recharge',
        description:
          'Provide opportunities to step away from screens, noise and constant interaction.',
      },
      {
        id: 'social-wellbeing',
        title: 'Social Wellbeing',
        description: 'Create spaces that enable belonging and informal connection.',
      },
      {
        id: 'user-control',
        title: 'User Control',
        description:
          'Where possible, give users control over lighting, temperature, posture, privacy and choice of setting.',
      },
    ],
  },
  {
    id: 'flexibility-adaptability',
    numeral: '09',
    title: 'Flexibility & Adaptability',
    question: 'How can the workplace change over time?',
    concepts: [
      {
        id: 'modular-planning',
        title: 'Modular Planning',
        description: 'Use planning grids, repeatable modules and sensible structural/service logic.',
      },
      {
        id: 'moveable-elements',
        title: 'Moveable Elements',
        description: 'Use movable partitions and furniture where they genuinely add value.',
      },
      {
        id: 'multi-purpose-spaces',
        title: 'Multi-purpose Spaces',
        description:
          'Allow larger rooms to support multiple activities instead of creating single-use rooms everywhere.',
      },
      {
        id: 'growth-contraction',
        title: 'Growth & Contraction',
        description: 'Plan for changes in headcount, teams and work patterns.',
      },
      {
        id: 'future-change',
        title: 'Future Change',
        description:
          'Consider future technology, workplace policies and organisational changes during initial design.',
      },
    ],
  },
  {
    id: 'safety-compliance',
    numeral: '10',
    title: 'Safety, Accessibility & Compliance',
    question: 'How do we make it safe and inclusive?',
    concepts: [
      {
        id: 'life-safety',
        title: 'Life Safety',
        description:
          'Address fire safety, egress, emergency access and applicable building requirements.',
      },
      {
        id: 'accessibility',
        title: 'Accessibility',
        description:
          'Provide accessible routes, doors, furniture clearances, toilets and inclusive facilities.',
      },
      {
        id: 'security',
        title: 'Security',
        description: 'Define public, staff and restricted areas and control access accordingly.',
      },
      {
        id: 'emergency-planning',
        title: 'Emergency Planning',
        description:
          'Make evacuation routes, assembly procedures and emergency infrastructure understandable and usable.',
      },
    ],
  },
  {
    id: 'sustainability',
    numeral: '11',
    title: 'Sustainability',
    question: 'How do we reduce environmental impact?',
    concepts: [
      {
        id: 'material-selection',
        title: 'Material Selection',
        description:
          'Prioritise durable, responsible and lower-impact materials appropriate to the application.',
      },
      {
        id: 'energy',
        title: 'Energy',
        description:
          'Reduce energy demand through efficient lighting, equipment, controls and passive design opportunities.',
      },
      {
        id: 'water',
        title: 'Water',
        description: 'Use efficient fixtures and responsible water strategies where applicable.',
      },
      {
        id: 'reuse-refurbishment',
        title: 'Reuse & Refurbishment',
        description:
          'Retain, adapt and reuse existing elements when environmentally and economically sensible.',
      },
      {
        id: 'waste-circularity',
        title: 'Waste & Circularity',
        description: 'Plan segregation, reuse, disassembly and end-of-life considerations.',
      },
      {
        id: 'indoor-health',
        title: 'Indoor Health',
        description: 'Consider low-emission materials and healthy indoor environments.',
      },
    ],
  },
  {
    id: 'economics-operations',
    numeral: '12',
    title: 'Economics & Operations',
    question: 'How do we make it financially and operationally viable?',
    concepts: [
      {
        id: 'budget',
        title: 'Budget',
        description: "Align design ambition with the project's capital budget from the beginning.",
      },
      {
        id: 'cost-per-seat',
        title: 'Cost per Seat',
        description: 'Evaluate area and fit-out decisions in relation to workplace capacity.',
      },
      {
        id: 'lifecycle-cost',
        title: 'Lifecycle Cost',
        description:
          'Consider maintenance, replacement, energy and operational costs — not only initial construction cost.',
      },
      {
        id: 'durability',
        title: 'Durability',
        description: 'Select finishes and furniture based on expected use and maintenance requirements.',
      },
      {
        id: 'operational-efficiency',
        title: 'Operational Efficiency',
        description:
          'Design support spaces, cleaning routes, storage and services so the workplace remains easy to operate.',
      },
    ],
  },
];

/** The guide's six-step design sequence — fits the merge-diagram layout. */
export const DESIGN_SEQUENCE = [
  { numeral: '01', title: 'Understand', detail: 'Brief, users, headcount, work styles, culture, attendance, constraints and goals.' },
  { numeral: '02', title: 'Analyse', detail: 'Site, existing conditions, building services, daylight, access, noise, structure and code.' },
  { numeral: '03', title: 'Strategise', detail: 'Zoning, adjacencies, workplace ratios, work settings and circulation.' },
  { numeral: '04', title: 'Design', detail: 'Planning, experience, materials, furniture, lighting, acoustics and technology.' },
  { numeral: '05', title: 'Test', detail: 'Capacity, workflows, accessibility, comfort, flexibility, cost and operational practicality.' },
  { numeral: '06', title: 'Resolve', detail: 'Coordinate architecture, interiors, MEP/technology, furniture and documentation.' },
];

export const KEY_IDEA =
  'A good office is not simply a collection of rooms. It is a system in which people, space, experience and performance work together.';

/** Flat lookup, for resolving a concept a slide was generated from. */
export function findConcept(pillarId: string, conceptId: string): DesignConcept | undefined {
  return DESIGN_PILLARS.find((p) => p.id === pillarId)?.concepts.find((c) => c.id === conceptId);
}

export const TOTAL_CONCEPTS = DESIGN_PILLARS.reduce((n, p) => n + p.concepts.length, 0);
