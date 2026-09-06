import { randomUUID } from 'node:crypto';
import { extractName } from '../parsers/nameExtractor.js';
import { extractPhones } from '../parsers/phoneExtractor.js';
import type { Contact } from '../types.js';
import { cleanText } from '../utils/sanitize.js';

export function extractContacts(text: string, sourceFile: string, sourcePage = 1): Contact[] {
  const lines = text
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => cleanText(line).replace(/[^\S\n]+/g, ' '));
  const contacts: Contact[] = [];
  for (let index = 0; index < lines.length; index++) {
    for (const phone of extractPhones(lines[index])) {
      const name = extractName(lines, index, phone.start, phone.end);
      const status = !phone.valid
        ? 'invalid'
        : !name.name || name.confidence < 0.75
          ? 'needs-review'
          : 'valid';
      contacts.push({
        id: randomUUID(),
        name: name.name,
        phone: phone.display,
        normalizedPhone: phone.normalized,
        sourceFile,
        sourcePage,
        status,
        confidence: phone.valid ? name.confidence : Math.min(0.4, name.confidence),
        ...(!phone.valid
          ? {
              reviewReason: 'This number does not match a recognized phone format. Check it against the PDF.',
            }
          : name.reason
            ? { reviewReason: name.reason }
            : {}),
      });
    }
  }
  return contacts;
}
