import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { generateCsv } from '../src/services/csvExporter.js';
import { generateExcel } from '../src/services/excelExporter.js';
import { safeFilename } from '../src/utils/sanitize.js';

const contacts = [
  { name: 'Muhammad Ali', phone: '03001234567', sourceFile: 'contacts.pdf' },
  { name: 'Sara "Fatima", Khan', phone: '+14155552671', sourceFile: 'scan.pdf' },
];
describe('safe spreadsheet exports', () => {
  it('creates RFC 4180 CSV with a BOM, escaping, and spreadsheet-safe phones', () => {
    const csv = generateCsv(contacts);
    expect(csv.startsWith('\uFEFFName,Phone Number,Source File\r\n')).toBe(true);
    expect(csv).toContain('"Muhammad Ali","\'03001234567","contacts.pdf"');
    expect(csv).toContain('"Sara ""Fatima"", Khan"');
    expect(csv.endsWith('\r\n')).toBe(true);
  });
  it('supports raw phone values without removing zeroes', () =>
    expect(generateCsv(contacts, false)).toContain('"03001234567"'));
  it.each(['=HYPERLINK("evil")', '+cmd', '-cmd', '@SUM(A1:A9)', '\t=1+1', '\r=1+1'])(
    'protects CSV from formula injection: %s',
    (name) => expect(generateCsv([{ name, phone: '03001234567', sourceFile: '=EVIL()' }])).toContain(`"'`),
  );
  it('creates an XLSX workbook with real text phone cells', () => {
    const bytes = generateExcel(contacts);
    expect(Buffer.isBuffer(bytes)).toBe(true);
    const workbook = XLSX.read(bytes, { type: 'buffer', cellNF: true });
    expect(workbook.SheetNames).toEqual(['Contacts']);
    const sheet = workbook.Sheets.Contacts;
    expect(sheet.B2).toMatchObject({ t: 's', v: '03001234567', z: '@' });
    expect(sheet.B3).toMatchObject({ t: 's', v: '+14155552671', z: '@' });
    expect(sheet.A1.v).toBe('Name');
    expect(sheet.C1.v).toBe('Source File');
  });
  it('does not create executable spreadsheet formulas from uploaded names', () => {
    const sheet = XLSX.read(generateExcel([{ name: '=1+1', phone: '03001234567', sourceFile: '=cmd.pdf' }]), {
      type: 'buffer',
    }).Sheets.Contacts;
    expect(sheet.A2).toMatchObject({ t: 's', v: '=1+1' });
    expect(sheet.A2.f).toBeUndefined();
    expect(sheet.C2.f).toBeUndefined();
  });
  it('sanitizes path traversal and control characters from source names', () =>
    expect(safeFilename('../../folder\\..\\file\u0000.pdf')).toBe('file.pdf'));
});
