import * as XLSX from 'xlsx';
import { cleanText } from '../utils/sanitize.js';
import type { ExportContact } from './csvExporter.js';
export function generateExcel(contacts: ExportContact[]): Buffer {
  const data = [
    ['Name', 'Phone Number', 'Source File'],
    ...contacts.map((contact) => [contact.name, contact.phone, contact.sourceFile].map(cleanText)),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  // Explicit string cells and text number format, including + prefixes and leading zeroes.
  for (let row = 0; row < data.length; row++)
    for (let col = 0; col < 3; col++) {
      const address = XLSX.utils.encode_cell({ r: row, c: col });
      sheet[address] = { t: 's', v: data[row][col], z: '@' };
    }
  sheet['!cols'] = [{ wch: 30 }, { wch: 24 }, { wch: 40 }];
  sheet['!autofilter'] = { ref: sheet['!ref']! };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Contacts');
  workbook.Props = { Title: 'Extracted contacts', Author: 'PDF Contact Extractor' };
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', compression: true });
}
