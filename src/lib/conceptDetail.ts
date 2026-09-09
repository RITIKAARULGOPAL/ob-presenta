// Presentation copy for each concept, kept separate from conceptLibrary.ts.
//
// The library holds the framework text verbatim; this holds what a slide should
// actually show. A full paragraph on a slide reads as a document, so each
// concept gets a short lead line plus a handful of scannable points, and the
// slide keeps room for project imagery beside them.
//
// Keyed by concept id. A concept with no entry here still renders — it just
// falls back to its library description as the lead.

export interface ConceptDetail {
  /** One line, the essence. Sits under the title at reading size. */
  lead: string;
  /** Short scannable items — 1–4 words each, rendered as cards. */
  points: string[];
}

export const CONCEPT_DETAIL: Record<string, ConceptDetail> = {
  // 01 · People & User Needs
  'user-profiles': {
    lead: 'Know exactly who the workplace is for.',
    points: ['Departments', 'Roles', 'Seniority', 'Work patterns', 'Accessibility needs', 'Visitor types'],
  },
  'work-styles': {
    lead: 'Support modes of work, not one fixed desk.',
    points: ['Focused', 'Collaborative', 'Social', 'Hybrid', 'Mobile', 'Meeting-heavy'],
  },
  'employee-experience': {
    lead: 'Design the whole day, arrival to departure.',
    points: ['Orientation', 'Work', 'Meetings', 'Breaks', 'Support', 'Social'],
  },
  'privacy-inclusion': {
    lead: 'Balance openness against the need to withdraw.',
    points: ['Acoustic privacy', 'Visual privacy', 'Personal space', 'Inclusive access'],
  },
  'visitor-experience': {
    lead: 'Welcome guests while controlling where they go.',
    points: ['Reception', 'Waiting', 'Meeting areas', 'Movement control'],
  },

  // 02 · Space Planning
  zoning: {
    lead: 'Group the floor into zones that behave alike.',
    points: ['Public', 'Collaborative', 'Focused', 'Social', 'Support', 'Service'],
  },
  adjacency: {
    lead: 'Put teams near the teams they actually work with.',
    points: ['Interaction frequency', 'Team proximity', 'Shared resources', 'Easy connections'],
  },
  circulation: {
    lead: 'Move people through without cutting through focus.',
    points: ['Clear paths', 'Primary routes', 'Secondary routes', 'Quiet edges'],
  },
  'capacity-density': {
    lead: 'Turn headcount into realistic area.',
    points: ['Headcount', 'Attendance patterns', 'Workstation ratios', 'Area per person'],
  },
  flexibility: {
    lead: 'Let zones change as teams do.',
    points: ['Grow', 'Shrink', 'Reorganise'],
  },
  'access-hierarchy': {
    lead: 'Layer the plan from open to restricted.',
    points: ['Public', 'Semi-private', 'Private'],
  },

  // 03 · Work Settings
  'focused-work': {
    lead: 'Places to concentrate without interruption.',
    points: ['Quiet zones', 'Individual desks', 'Library', 'Focus rooms'],
  },
  collaboration: {
    lead: 'Space for teams to work in the open.',
    points: ['Open collaboration', 'Project tables', 'Team zones', 'Informal points'],
  },
  'formal-meetings': {
    lead: 'Rooms sized to how people actually meet.',
    points: ['Small rooms', 'Medium rooms', 'Boardroom', 'Confidential'],
  },
  'informal-collaboration': {
    lead: 'Let unplanned conversation happen.',
    points: ['Casual seating', 'Huddle areas', 'Touchdown spaces'],
  },
  'phone-video-calls': {
    lead: 'Somewhere private to take a call.',
    points: ['Phone booths', 'Small rooms', 'Acoustic privacy'],
  },
  'training-multipurpose': {
    lead: 'One room, many uses.',
    points: ['Training', 'Workshops', 'Town halls', 'Group activities'],
  },
  'social-breakout': {
    lead: 'Where the workplace becomes social.',
    points: ['Café', 'Pantry', 'Lounge', 'Breakout'],
  },
  'wellness-recharge': {
    lead: 'Room to step away and reset.',
    points: ['Quiet room', 'Decompression', 'Wellness space'],
  },

  // 04 · Function & Workflow
  'movement-workflow': {
    lead: 'Trace how work actually travels.',
    points: ['People', 'Information', 'Resources', 'Handoffs'],
  },
  'department-interaction': {
    lead: 'Know who needs proximity and who needs distance.',
    points: ['Proximity', 'Separation', 'Shared workflow'],
  },
  'support-spaces': {
    lead: 'Plan back-of-house early, not last.',
    points: ['Print', 'Storage', 'Lockers', 'Utility', 'Server / IT'],
  },
  'meeting-patterns': {
    lead: 'Size the room mix to real meeting data.',
    points: ['Frequency', 'Duration', 'Group size', 'Room mix'],
  },
  storage: {
    lead: 'Balance what is personal, shared and archived.',
    points: ['Personal', 'Team', 'Archive', 'Operational'],
  },

  // 05 · Experience & Brand
  'brand-expression': {
    lead: 'Let the space say who the company is.',
    points: ['Architecture', 'Graphics', 'Colour', 'Materiality'],
  },
  arrival: {
    lead: 'The first sixty seconds set the tone.',
    points: ['Orientation', 'Security', 'First impression'],
  },
  materiality: {
    lead: 'Choose materials that survive real use.',
    points: ['Durability', 'Maintenance', 'Acoustics', 'Tactility', 'Character'],
  },
  placemaking: {
    lead: 'Give the floor destinations worth walking to.',
    points: ['Landmarks', 'Identity', 'Orientation'],
  },
  storytelling: {
    lead: 'Build culture into the environment.',
    points: ['Culture', 'History', 'Values', 'Local context'],
  },

  // 06 · Environmental Design
  'daylight-views': {
    lead: 'Get daylight deep without the glare.',
    points: ['Useful daylight', 'Access to views', 'Glare control', 'Heat gain'],
  },
  lighting: {
    lead: 'Layer light to match the activity.',
    points: ['Ambient', 'Task', 'Feature', 'Comfort'],
  },
  acoustics: {
    lead: 'Control sound by planning first, finishes second.',
    points: ['Speech privacy', 'Reverberation', 'Noise transfer', 'Enclosure'],
  },
  'thermal-comfort': {
    lead: 'Keep people comfortable, and in control.',
    points: ['Temperature', 'Air movement', 'Solar exposure', 'User control'],
  },
  'indoor-air-quality': {
    lead: 'Ventilate well and specify clean materials.',
    points: ['Ventilation', 'Fresh air', 'Low-emission materials'],
  },
  biophilia: {
    lead: 'Bring the natural world indoors.',
    points: ['Plants', 'Natural materials', 'Patterns', 'Views'],
  },

  // 07 · Technology
  'power-data': {
    lead: 'Power where work actually happens.',
    points: ['Fixed desks', 'Mobile work', 'Charging', 'Data'],
  },
  'av-hybrid-work': {
    lead: 'Make remote people equal participants.',
    points: ['Video conferencing', 'Screen visibility', 'Microphones', 'Acoustics'],
  },
  connectivity: {
    lead: 'Dependable network everywhere people work.',
    points: ['Wireless', 'Wired', 'Collaboration areas'],
  },
  'smart-workplace': {
    lead: 'Instrument the building where it pays off.',
    points: ['Room booking', 'Occupancy', 'Wayfinding', 'Analytics'],
  },
  'future-technology': {
    lead: 'Leave room for what comes next.',
    points: ['Accessible infrastructure', 'Adaptable routes', 'Low disruption'],
  },

  // 08 · Wellbeing & Ergonomics
  ergonomics: {
    lead: 'Fit the furniture to the person.',
    points: ['Furniture', 'Monitor position', 'Posture', 'Adjustability'],
  },
  movement: {
    lead: 'Design a day that is not spent seated.',
    points: ['Stairs', 'Varied settings', 'Distributed amenities'],
  },
  'mental-recharge': {
    lead: 'Somewhere to step away from the screen.',
    points: ['Away from screens', 'Away from noise', 'Low stimulation'],
  },
  'social-wellbeing': {
    lead: 'Belonging is a spatial outcome too.',
    points: ['Belonging', 'Informal connection', 'Shared moments'],
  },
  'user-control': {
    lead: 'Give people a say in their own comfort.',
    points: ['Lighting', 'Temperature', 'Posture', 'Privacy', 'Choice of setting'],
  },

  // 09 · Flexibility & Adaptability
  'modular-planning': {
    lead: 'Plan on a grid that repeats.',
    points: ['Planning grid', 'Repeatable modules', 'Structural logic', 'Services logic'],
  },
  'moveable-elements': {
    lead: 'Move things only where it genuinely helps.',
    points: ['Movable partitions', 'Movable furniture', 'Real reconfiguration'],
  },
  'multi-purpose-spaces': {
    lead: 'Avoid a single-use room for every need.',
    points: ['Multiple activities', 'Shared rooms', 'Fewer dead rooms'],
  },
  'growth-contraction': {
    lead: 'Plan for the headcount you do not have yet.',
    points: ['Headcount change', 'Team change', 'Work patterns'],
  },
  'future-change': {
    lead: 'Decide now what should stay easy to change.',
    points: ['Technology', 'Policy', 'Organisation'],
  },

  // 10 · Safety, Accessibility & Compliance
  'life-safety': {
    lead: 'Non-negotiable, and designed in from the start.',
    points: ['Fire safety', 'Egress', 'Emergency access', 'Code compliance'],
  },
  accessibility: {
    lead: 'Usable by everyone, not merely compliant.',
    points: ['Routes', 'Doors', 'Clearances', 'Toilets', 'Inclusive facilities'],
  },
  security: {
    lead: 'Define who belongs where.',
    points: ['Public', 'Staff', 'Restricted', 'Access control'],
  },
  'emergency-planning': {
    lead: 'Make the plan legible under stress.',
    points: ['Evacuation routes', 'Assembly points', 'Emergency infrastructure'],
  },

  // 11 · Sustainability
  'material-selection': {
    lead: 'Specify for impact and longevity.',
    points: ['Durable', 'Responsible sourcing', 'Lower impact', 'Fit for application'],
  },
  energy: {
    lead: 'Cut demand before adding efficiency.',
    points: ['Lighting', 'Equipment', 'Controls', 'Passive design'],
  },
  water: {
    lead: 'Use less, deliberately.',
    points: ['Efficient fixtures', 'Responsible strategies'],
  },
  'reuse-refurbishment': {
    lead: 'Keep what is worth keeping.',
    points: ['Retain', 'Adapt', 'Reuse'],
  },
  'waste-circularity': {
    lead: 'Design for the end of life, not just day one.',
    points: ['Segregation', 'Reuse', 'Disassembly', 'End of life'],
  },
  'indoor-health': {
    lead: 'Healthy air is a material decision.',
    points: ['Low-emission materials', 'Healthy interiors'],
  },

  // 12 · Economics & Operations
  budget: {
    lead: 'Match ambition to the money, from day one.',
    points: ['Capital budget', 'Design ambition', 'Early alignment'],
  },
  'cost-per-seat': {
    lead: 'Judge decisions against capacity.',
    points: ['Area per seat', 'Fit-out cost', 'Workplace capacity'],
  },
  'lifecycle-cost': {
    lead: 'Cheapest to build is rarely cheapest to own.',
    points: ['Maintenance', 'Replacement', 'Energy', 'Operations'],
  },
  durability: {
    lead: 'Specify for the wear it will actually get.',
    points: ['Expected use', 'Maintenance regime', 'Finish selection'],
  },
  'operational-efficiency': {
    lead: 'Design so the building is easy to run.',
    points: ['Support spaces', 'Cleaning routes', 'Storage', 'Services'],
  },
};
