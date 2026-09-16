// Occupancy-chart Excel import — parses a workbook fully client-side (no
// server round-trip), matching imageFile.ts's philosophy: everything the user
// uploads is processed in the browser, nothing is sent anywhere.

import * as XLSX from 'xlsx';

export interface OccupancyRow {
  label: string;
  value: number;
  capacity?: number;
}

const LABEL_HEADERS = ['zone', 'name', 'region', 'area'];
const CAPACITY_HEADERS = ['capacity', 'cap'];
const VALUE_HEADERS = ['occupied', 'value', 'count', 'occupancy'];

function findColumn(header: string[], candidates: string[]): number {
  return header.findIndex((h) => candidates.some((c) => h.toLowerCase().includes(c)));
}

/** Reads the first sheet of a workbook and extracts zone rows. Header-detects
 *  "zone/name", "capacity", "occupied/value/count" columns by name; falls
 *  back to column order (A = zone, B = capacity, C = occupied) if the header
 *  row isn't recognizable. Skips rows with no parseable zone label. */
export async function parseOccupancyWorkbook(file: File): Promise<OccupancyRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
  if (rows.length === 0) return [];

  const headerRow = rows[0].map((c) => String(c ?? '').trim());
  let labelCol = findColumn(headerRow, LABEL_HEADERS);
  let capacityCol = findColumn(headerRow, CAPACITY_HEADERS);
  let valueCol = findColumn(headerRow, VALUE_HEADERS);
  const hasHeader = labelCol >= 0 || capacityCol >= 0 || valueCol >= 0;

  let dataRows = rows;
  if (hasHeader) {
    dataRows = rows.slice(1);
    if (labelCol < 0) labelCol = 0;
    if (capacityCol < 0) capacityCol = 1;
    if (valueCol < 0) valueCol = 2;
  } else {
    // No recognizable header — assume the whole sheet is data, column order
    // Zone / Capacity / Occupied.
    labelCol = 0;
    capacityCol = 1;
    valueCol = 2;
  }

  const out: OccupancyRow[] = [];
  for (const row of dataRows) {
    const label = String(row[labelCol] ?? '').trim();
    if (!label) continue;
    const value = Number(row[valueCol]);
    const capacityRaw = row[capacityCol];
    const capacity = capacityRaw != null && capacityRaw !== '' ? Number(capacityRaw) : undefined;
    out.push({
      label,
      value: Number.isFinite(value) ? value : 0,
      capacity: capacity != null && Number.isFinite(capacity) ? capacity : undefined,
    });
  }
  return out;
}
