import { cleanText, csvSafeText } from '../utils/sanitize.js';
export interface ExportContact {
  name: string;
  phone: string;
  sourceFile: string;
}
function quote(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
/** RFC 4180 + UTF-8 BOM. Phone prefix keeps zeros when Excel opens CSV directly.
 * For machine-readable CSV, preserveForExcel=false keeps raw phone strings.
 */
export function generateCsv(contacts: ExportContact[], preserveForExcel = true): string {
  const rows = contacts.map((contact) =>
    [
      csvSafeText(contact.name),
      preserveForExcel
        ? `'${cleanText(contact.phone).replace(/[\r\n\t]/g, '')}`
        : /^\+?[\d ().-]+$/.test(cleanText(contact.phone))
          ? cleanText(contact.phone)
          : csvSafeText(contact.phone),
      csvSafeText(contact.sourceFile),
    ]
      .map(quote)
      .join(','),
  );
  return '\uFEFF' + ['Name,Phone Number,Source File', ...rows].join('\r\n') + '\r\n';
}
