import { extractContacts } from '../services/contactNormalizer.js';
import type { Contact } from '../types.js';

/** Add a provider behind this interface. External processing must require explicit consent.
 * Validate every AI-proposed value against the original text; never fabricate missing data.
 */
export interface ContactParser {
  parse(text: string, sourceFile: string, sourcePage: number): Promise<Contact[]>;
}
export class LocalContactParser implements ContactParser {
  async parse(text: string, sourceFile: string, sourcePage: number) {
    return extractContacts(text, sourceFile, sourcePage);
  }
}
export function getContactParser(): ContactParser {
  return new LocalContactParser();
}
