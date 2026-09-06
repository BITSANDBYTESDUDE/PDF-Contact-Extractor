import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max';

export interface PhoneValidation {
  valid: boolean;
  normalized: string | null;
  display: string;
  country?: string;
}
export function validatePhone(raw: string, country: CountryCode = 'PK'): PhoneValidation {
  let input = raw.normalize('NFKC').trim();
  if (!/^[+\d\s().-]+$/.test(input)) return { valid: false, normalized: null, display: input };
  const digits = input.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15 || /^\d{5}-\d{7}-\d$/.test(input)) {
    return { valid: false, normalized: null, display: input };
  }
  input = input.replace(/[\s().-]/g, '');
  if (input.startsWith('00')) input = '+' + input.slice(2);
  else if (country === 'PK' && /^92\d{10}$/.test(input)) input = '+' + input;
  const parsed = parsePhoneNumberFromString(input, country);
  if (!parsed?.isValid()) return { valid: false, normalized: null, display: raw.trim() };
  return {
    valid: true,
    normalized: parsed.number,
    display: parsed.country === 'PK' ? `0${parsed.nationalNumber}` : parsed.number,
    country: parsed.country,
  };
}

export interface PhoneMatch extends PhoneValidation {
  raw: string;
  start: number;
  end: number;
}
const blockedLabel =
  /(?:invoice|order|cnic|nic|passport|account|reference|ref|amount|price|total|date|dob|id|zip|postal)\s*(?:number|no\.?|id|#)?\s*[:#=-]?\s*$/i;
const phoneLabel = /(?:phone|mobile|contact|tel(?:ephone)?|cell|whatsapp)\s*(?:number|no\.?)?\s*[:#=-]?\s*$/i;
// Require an explicit international prefix, or a Pakistani national/country prefix.
// Restrict candidates to one line, and do not match inside IDs or date fragments.
const candidatePattern = /(?<![\p{L}\p{N}./-])(?:\+\d|00\d|0\d|92[ .-]?\d)[\d ().-]{5,}\d(?![\p{L}\p{N}])/gu;

export function extractPhones(line: string): PhoneMatch[] {
  const results: PhoneMatch[] = [];
  const candidates = [...line.matchAll(candidatePattern)];
  // Retain explicitly labelled, invalid numbers for human review instead of hiding them.
  const labelled =
    /(?:phone|mobile|tel(?:ephone)?|cell|whatsapp|contact)\s*(?:number|no\.?)?\s*[:#=-]\s*([+\d][\d ().-]{3,}\d)/gi;
  for (const match of line.matchAll(labelled)) {
    const start = match.index! + match[0].indexOf(match[1]);
    if (!candidates.some((c) => start >= c.index! && start < c.index! + c[0].length)) {
      const synthetic = [match[1]] as unknown as RegExpExecArray;
      synthetic.index = start;
      candidates.push(synthetic);
    }
  }
  for (const match of candidates) {
    const raw = match[0].trim();
    const start = match.index!;
    const before = line.slice(0, start);
    const nearestField = before.split(/[|;\t]/).at(-1) || '';
    if (blockedLabel.test(nearestField) || /^\d{5}-\d{7}-\d$/.test(raw)) continue;
    const validation = validatePhone(raw);
    const digits = raw.replace(/\D/g, '');
    if (!validation.valid && !phoneLabel.test(nearestField)) continue;
    if (digits.length > 15 || digits.length < 5) continue;
    results.push({ ...validation, raw, start, end: start + raw.length });
  }
  return results.sort((a, b) => a.start - b.start);
}
