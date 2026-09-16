// One-off import: turns the batch_*.json slide specs (transcribed from the
// QC/Qualcomm PDF) into a real Presenta project row in Supabase. Not part of
// the app — run manually with `node scripts/import-qc-deck.mjs` and delete
// afterward.
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.resolve(process.cwd(), '.env.local');
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

const SCRATCH = String.raw`C:\Users\Ritika\AppData\Local\Temp\claude\D--Claude-presenta-app\867a667f-d871-4b6b-a93e-9bbba7463d73\scratchpad\pdf_inspect`;
const BATCH_FILES = [
  'batch_a.json', 'batch_b.json', 'batch_c.json',
  'batch_d1.json', 'batch_d2.json',
  'batch_e.json',
  'batch_f1.json', 'batch_f2.json', 'batch_f3.json', 'batch_f4.json',
  'batch_g.json',
];

function makeId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

const VALID_LAYOUTS = new Set([
  'blank', 'title-only', 'title-content', 'title-stats', 'two-content',
  'title-slide', 'merge-diagram', 'stat-hero', 'concept', 'linked-views',
]);
const VALID_STYLES = new Set(['standard', 'section-starter', 'company', 'design']);

function hydrateFields(fields) {
  const out = { ...fields };
  if (Array.isArray(out.stats)) {
    out.stats = out.stats.map((s) => ({ id: makeId('stat'), value: String(s.value ?? ''), label: String(s.label ?? '') }));
  }
  if (Array.isArray(out.items)) {
    out.items = out.items.map((it) => ({ id: makeId('item'), label: String(it.label ?? '') }));
  }
  return out;
}

function toSlide(spec, batchName, index) {
  if (!spec || typeof spec !== 'object') throw new Error(`${batchName}[${index}]: not an object`);
  const { layout, style, fields } = spec;
  if (!VALID_LAYOUTS.has(layout)) throw new Error(`${batchName}[${index}]: invalid layout "${layout}"`);
  if (!VALID_STYLES.has(style)) throw new Error(`${batchName}[${index}]: invalid style "${style}"`);
  if (!fields || typeof fields !== 'object') throw new Error(`${batchName}[${index}]: missing fields`);
  return {
    id: makeId('slide'),
    layout,
    style,
    fields: hydrateFields(fields),
    animation: { entry: 'none', duration: 600, delay: 0 },
  };
}

let allSlides = [];
const report = [];
for (const file of BATCH_FILES) {
  const full = path.join(SCRATCH, file);
  if (!fs.existsSync(full)) {
    report.push(`${file}: MISSING`);
    continue;
  }
  const raw = fs.readFileSync(full, 'utf8');
  let arr;
  try {
    arr = JSON.parse(raw);
  } catch (err) {
    report.push(`${file}: JSON PARSE ERROR — ${err.message}`);
    continue;
  }
  if (!Array.isArray(arr)) {
    report.push(`${file}: not a JSON array`);
    continue;
  }
  const slides = arr.map((spec, i) => toSlide(spec, file, i));
  allSlides = allSlides.concat(slides);
  report.push(`${file}: ${slides.length} slides`);
}

console.log(report.join('\n'));
console.log(`TOTAL: ${allSlides.length} slides`);

if (process.argv.includes('--dry-run')) {
  console.log('Dry run only — not inserting. Pass no flag (or --insert) to actually write to Supabase.');
  process.exit(0);
}

if (allSlides.length === 0) {
  console.error('No slides collected — aborting insert.');
  process.exit(1);
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const now = Date.now();
const project = {
  id: makeId('proj'),
  name: 'Qualcomm · Project Damascus II — QC Technical Bid',
  client: 'Qualcomm',
  prepared_by: 'Studiokon Ventures',
  date: new Date(now).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
  brand: 'skv',
  slides: allSlides,
  created_at: now,
  updated_at: now,
};

const { error } = await supabase.from('projects').insert(project);
if (error) {
  console.error('INSERT FAILED:', error.message);
  process.exit(1);
}
console.log(`Inserted project ${project.id} with ${allSlides.length} slides.`);
console.log(`Open it at: http://localhost:3000/p/${project.id}/edit`);
