import { describe, it, expect } from 'vitest';
import { extractContacts } from '../src/services/contactNormalizer.js';
import { markDuplicates, calculateStats } from '../src/services/duplicateDetector.js';
import { generateCsv } from '../src/services/csvExporter.js';
import { generateExcel } from '../src/services/excelExporter.js';
import * as XLSX from 'xlsx';

describe('large contact lists', () => {
  it('extracts, deduplicates and exports 2,000 real parsed rows', () => {
    const text = Array.from(
      { length: 2000 },
      (_, i) => `Muhammad Ali | 0300${String(i).padStart(7, '0')}`,
    ).join('\n');
    const rows = markDuplicates(extractContacts(text, 'large-list.pdf'));
    expect(rows).toHaveLength(2000);
    expect(calculateStats(rows, 1).duplicates).toBe(0);
    expect(generateCsv(rows).split('\r\n')).toHaveLength(2002);
    expect(
      XLSX.utils.sheet_to_json(XLSX.read(generateExcel(rows), { type: 'buffer' }).Sheets.Contacts),
    ).toHaveLength(2000);
  });
});
