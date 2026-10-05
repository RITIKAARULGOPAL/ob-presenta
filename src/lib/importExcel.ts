// Seating-table Excel import — parses a workbook fully client-side (no
// server round-trip), matching imageFile.ts's philosophy: everything the user
// uploads is processed in the browser, nothing is sent anywhere.

import * as XLSX from 'xlsx';

export interface SeatingImportRow {
  /** Which zone group this row belongs to — rows sharing a zone (case-
   *  insensitively) are grouped together, in the order zones first appear. */
  zone: string;
  label: string;
  required?: string;
  achieved: string;
}

const ZONE_HEADERS = ['zone', 'group', 'area group'];
const LABEL_HEADERS = ['area', 'room', 'name', 'label'];
const REQUIRED_HEADERS = ['required', 'req'];
const ACHIEVED_HEADERS = ['achieved', 'actual', 'count', 'value'];

function findColumn(header: string[], candidates: string[], exclude: number[] = []): number {
  const lc = header.map((h) => h.toLowerCase());
  // 1. Exact whole-header match
  const exact = lc.findIndex((h, i) => !exclude.includes(i) && candidates.includes(h));
  if (exact >= 0) return exact;
  // 2. Whole-word match (e.g. "Zone Name" contains word "zone" but not "area")
  const word = lc.findIndex((h, i) => !exclude.includes(i) && candidates.some((c) => new RegExp(`\\b${c}\\b`).test(h)));
  if (word >= 0) return word;
  // 3. Substring (legacy fallback)
  return lc.findIndex((h, i) => !exclude.includes(i) && candidates.some((c) => h.includes(c)));
}

/** Reads the first sheet of a workbook and extracts seating rows. Header-
 *  detects "zone/group", "area/room/name", "required", "achieved/actual/
 *  count" columns by name; falls back to column order (A = zone, B = area,
 *  C = required, D = achieved) if the header row isn't recognizable. Skips
 *  rows with no parseable area label. */
export async function parseSeatingWorkbook(file: File): Promise<SeatingImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
  if (rows.length === 0) return [];

  const headerRow = rows[0].map((c) => String(c ?? '').trim());
  let zoneCol = findColumn(headerRow, ZONE_HEADERS);
  let labelCol = findColumn(headerRow, LABEL_HEADERS, [zoneCol]);
  let requiredCol = findColumn(headerRow, REQUIRED_HEADERS, [zoneCol, labelCol]);
  let achievedCol = findColumn(headerRow, ACHIEVED_HEADERS, [zoneCol, labelCol, requiredCol]);
  const hasHeader = zoneCol >= 0 || labelCol >= 0 || requiredCol >= 0 || achievedCol >= 0;

  let dataRows = rows;
  if (hasHeader) {
    dataRows = rows.slice(1);
    if (zoneCol < 0) zoneCol = 0;
    if (labelCol < 0) labelCol = 1;
    if (requiredCol < 0) requiredCol = 2;
    if (achievedCol < 0) achievedCol = 3;
  } else {
    zoneCol = 0;
    labelCol = 1;
    requiredCol = 2;
    achievedCol = 3;
  }

  const out: SeatingImportRow[] = [];
  for (const row of dataRows) {
    const label = String(row[labelCol] ?? '').trim();
    if (!label) continue;
    const zone = String(row[zoneCol] ?? '').trim() || 'General';
    const requiredRaw = row[requiredCol];
    const required = requiredRaw != null && requiredRaw !== '' ? String(requiredRaw).trim() : undefined;
    const achieved = String(row[achievedCol] ?? '').trim() || '0';
    out.push({ zone, label, required, achieved });
  }
  return out;
}
