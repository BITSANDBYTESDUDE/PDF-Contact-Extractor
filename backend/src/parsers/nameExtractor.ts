import { extractPhones } from './phoneExtractor.js';

export interface NameMatch {
  name: string;
  confidence: number;
  reason?: string;
}

const customerLabelPhrases = [
  // Customer & Client variations
  'customer\\s*name',
  'customer\\s*details?',
  'customer\\s*info(?:rmation)?',
  "customer(?:'s)?",
  'client\\s*name',
  'client\\s*details?',
  'client\\s*info(?:rmation)?',
  "client(?:'s)?",
  'buyer\\s*name',
  'buyer\\s*details?',
  'buyer\\s*info(?:rmation)?',
  "buyer(?:'s)?",
  'purchaser\\s*name',
  'purchaser\\s*details?',
  'purchaser',
  'consignee\\s*name',
  'consignee\\s*details?',
  'consignee',
  // Billing & Invoicing targets
  'bill(?:ing)?\\s*to\\s*name',
  'bill(?:ing)?\\s*name',
  'bill(?:ed)?\\s*to',
  'billing\\s*to',
  'bill-to',
  'invoice\\s*to',
  'invoiced\\s*to',
  'sold\\s*to',
  // Shipping & Delivery
  'ship(?:ping)?\\s*to\\s*name',
  'ship(?:ping)?\\s*name',
  'ship(?:ped)?\\s*to',
  'shipping\\s*to',
  'deliver(?:y|ed)?\\s*to',
  'dispatch(?:ed)?\\s*to',
  // Party & Account
  'party\\s*name',
  'party\\s*details?',
  "party(?:'s)?",
  'account\\s*(?:holder\\s*)?name',
  'account\\s*holder',
  // Contact & Person
  'contact\\s*person(?:\\s*name)?',
  'contact\\s*name',
  'full\\s*name',
  'person\\s*name',
  'person',
  'patient\\s*name',
  'patient',
  'recipient\\s*name',
  'recipient',
  'receiver\\s*name',
  'receiver',
  'attention',
  'attn',
  'care\\s*of',
  'c/o',
  'user\\s*name',
  'member\\s*name',
  // Honorific / Business title prefixes
  'messrs\\.?',
  'm/s\\.?',
  // Base name label
  'name',
];

const labelPatternString = customerLabelPhrases.join('|');

// Matches label followed by punctuation separator (: = - – —) anywhere in a string
const nameLabelAnywhere = new RegExp(`(?:${labelPatternString})\\s*[:=\\-–—]\\s*`, 'i');

// Matches label at the start of candidate with optional separator
const nameLabelAtStart = new RegExp(`^(?:${labelPatternString})\\s*[:=\\-–—]?\\s*`, 'i');

// Standalone customer section header
const sectionHeaderRegex = new RegExp(`^(?:${labelPatternString})\\s*[:=\\-–—]?$`, 'i');

const honorificPattern =
  /^(?:mr|mrs|ms|miss|dr|prof|engr|adv|shaik?h|syed|mian|chaudhry|chaudhary|malik|haji|raja|sardar)\.?\s+/i;

const businessPrefixPattern = /^(?:m\/s|m\/s\.|messrs|messrs\.)\s+/i;

const blockedWords =
  /\b(?:address|street|st|road|rd|avenue|ave|boulevard|blvd|lane|ln|drive|dr|block|sector|phase|floor|building|bldg|apartment|apt|suite|ste|house|flat|plot|plaza|tower|towers|po\s*box|p\.o\.\s*box|postal|zip|postcode|lahore|karachi|islamabad|rawalpindi|faisalabad|peshawar|quetta|multan|sialkot|gujranwala|hyderabad|pakistan|punjab|sindh|kpk|balochistan|invoice|order|amount|price|subtotal|total|grand\s*total|balance|due|date|receipt|bill|payment|qty|quantity|rate|tax|gst|vat|ntn|strn|trn|terms|description|item|items|charges|fee|fees|discount|company|corporation|corp|limited|ltd|pvt|inc|llc|llp|gmbh|department|dept|office|support|service|services|helpdesk|administration|management|center|centre|bank|branch|store|shop|solutions|technologies|enterprises|industries|holdings|contacts?|phone|mobile|mob|telephone|tel|cell|whatsapp|fax|email|mail|website|web|url|http|https|www|list|directory|report|page|scan|sample|example|preview|test|statement|details|note|notes|summary|status|information|info|please|call|reach|thank|thanks|welcome|dear|hello|regards|signature|authorized|sign|customer|client|buyer|consignee|receiver|recipient|unknown|not\s*available|n\/a|null|undefined|none)\b/i;

export function isCustomerSectionHeader(text: string): boolean {
  const clean = text.replace(/^[\s|:;,\-–—•#]+|[\s|:;,\-–—•#]+$/g, '').trim();
  if (!clean) return false;
  return sectionHeaderRegex.test(clean);
}

export function cleanName(candidate: string, explicit = false): string {
  let name = candidate
    .normalize('NFKC')
    // Remove list numbering e.g. "1. "
    .replace(/^\s*\d+[.)\s:-]+/, '')
    // Remove email addresses or URLs
    .replace(/<[^>]+>|\b\S+@\S+\b|\bhttps?:\/\/\S+\b|\bwww\.\S+\b/gi, '')
    // Remove business/honorific prefix
    .replace(businessPrefixPattern, '')
    // Remove label from start if present
    .replace(nameLabelAtStart, '')
    // Remove honorific title prefix e.g. "Mr. "
    .replace(honorificPattern, '')
    // Remove parenthetical annotations e.g. "(Customer)", "[Client]"
    .replace(/\s*\([^)]*\)|\s*\[[^\]]*\]/g, '')
    // Remove trailing phone/contact label
    .replace(
      /\b(?:phone|mobile|mob|contact|tel(?:ephone)?|cell(?:ular)?|whatsapp)\s*(?:number|no\.?)?\s*[:=\-–—]?\s*$/i,
      '',
    )
    // Remove leading/trailing punctuation and whitespace
    .replace(/^[\s|:;,\-–—•/\\#]+|[\s|:;,\-–—•/\\#]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!name || name.length > 100 || /[\d@/\\=<>]/.test(name) || blockedWords.test(name)) return '';
  if (!/^[\p{L}\p{M}\s.'’\-]+$/u.test(name)) return '';

  const words = name.split(' ').filter(Boolean);
  if (words.length < (explicit ? 1 : 2) || words.length > 6) return '';
  if (words.every((w) => w.replace(/[^\p{L}]/gu, '').length < 2)) return '';

  // Do not turn sentence fragments into invented names.
  if (
    /\b(?:is|are|was|were|the|this|that|from|with|and|for|more|information|below|above|our|your|you|us|they|them|their|here|there|have|has|had|been)\b/i.test(
      name,
    )
  )
    return '';

  return name;
}

export function candidateFrom(fragment: string): { name: string; explicit: boolean } | null {
  if (!fragment || !fragment.trim()) return null;
  const trimmed = fragment.trim();

  // 1. Check for explicit name/customer label anywhere in fragment
  const labelMatch = nameLabelAnywhere.exec(trimmed);
  if (labelMatch) {
    const after = trimmed
      .slice(labelMatch.index + labelMatch[0].length)
      .split(/[|;\t]|\b(?:phone|mobile|mob|ph|address|tel|email|web|website|fax)\s*[:=\-–—]/i)[0];
    const name = cleanName(after, true);
    if (name) return { name, explicit: true };
  }

  // 2. Check for label at start of fragment
  const startLabelMatch = nameLabelAtStart.exec(trimmed);
  if (startLabelMatch && startLabelMatch[0].trim()) {
    const after = trimmed
      .slice(startLabelMatch[0].length)
      .split(/[|;\t]|\b(?:phone|mobile|mob|ph|address|tel|email|web|website|fax)\s*[:=\-–—]/i)[0];
    const name = cleanName(after, true);
    if (name) return { name, explicit: true };
  }

  // 3. Check segments split by table / column separators
  for (const segment of trimmed.split(/[|;\t]/).reverse()) {
    const name = cleanName(segment);
    if (name) return { name, explicit: false };
  }

  return null;
}

export function extractName(lines: string[], lineIndex: number, start: number, end: number): NameMatch {
  const current = lines[lineIndex];
  const currentPhones = extractPhones(current);
  const column = current.slice(0, start).split('|').length - 1;
  const columnCount = current.split('|').length;

  // 1. Same line before the phone
  const preceding = currentPhones.filter((p) => p.end <= start).at(-1);
  const before = candidateFrom(current.slice(preceding?.end || 0, start));
  if (before) return { name: before.name, confidence: before.explicit ? 0.98 : 0.91 };

  // 2. Same line after the phone (only if no following phone on the same line)
  const following = currentPhones.find((p) => p.start >= end);
  const after = !following ? candidateFrom(current.slice(end)) : null;
  if (after) return { name: after.name, confidence: after.explicit ? 0.96 : 0.76 };

  // 3. Search preceding lines (up to 8 lines back for multi-line invoice address blocks)
  const maxLookback = 8;
  let emptyLineCount = 0;

  for (let offset = 1; offset <= maxLookback; offset++) {
    const prevIndex = lineIndex - offset;
    if (prevIndex < 0) break;
    const line = lines[prevIndex];
    if (line === undefined) break;

    const trimmed = line.trim();
    if (!trimmed) {
      emptyLineCount++;
      // Stop unlabelled search across multiple empty lines
      if (emptyLineCount > 1) break;
      continue;
    }

    // Stop if we hit another line with a phone number (contact boundary)
    const linePhones = extractPhones(line);
    if (linePhones.length > 0) break;

    const fields = line.split('|');
    // Multi-column context alignment
    const context =
      currentPhones.length > 1 && fields.length === columnCount
        ? fields[column]
        : fields.length > column && columnCount > 1
          ? fields[column]
          : line;

    // Check if the current line or context is a standalone section header
    const isSectionHeader = isCustomerSectionHeader(context);

    const candidate = candidateFrom(context);
    if (candidate) {
      // Respect unlabelled record boundaries when empty lines intervene
      if (emptyLineCount > 0 && !candidate.explicit) {
        break;
      }

      // Check if this candidate immediately follows a customer section header
      let hasPrecedingSectionHeader = false;
      for (let hOffset = 1; hOffset <= 2; hOffset++) {
        const headerIndex = prevIndex - hOffset;
        if (headerIndex < 0) break;
        const headerLine = lines[headerIndex];
        if (!headerLine.trim()) continue;
        const hFields = headerLine.split('|');
        const hContext =
          currentPhones.length > 1 && hFields.length === columnCount
            ? hFields[column]
            : hFields.length > column && columnCount > 1
              ? hFields[column]
              : headerLine;
        if (isCustomerSectionHeader(hContext)) {
          hasPrecedingSectionHeader = true;
        }
        break;
      }

      const isExplicit = candidate.explicit || hasPrecedingSectionHeader;

      let confidence: number;
      if (isExplicit) {
        confidence = 0.97;
      } else if (offset === 1) {
        confidence = 0.84;
      } else if (offset === 2) {
        confidence = 0.67;
      } else {
        confidence = 0.55;
      }

      return {
        name: candidate.name,
        confidence,
        ...(!isExplicit && offset > 1
          ? {
              reason:
                offset === 2
                  ? 'The name was found two lines away. Please confirm the association.'
                  : `The name was found ${offset} lines away. Please confirm the association.`,
            }
          : {}),
      };
    }

    if (isSectionHeader) {
      // Section header reached without finding a name between it and phone
      break;
    }
  }

  // 4. Search following lines (up to 3 lines ahead)
  for (let offset = 1; offset <= 3; offset++) {
    const nextIndex = lineIndex + offset;
    if (nextIndex >= lines.length) break;
    const nextLine = lines[nextIndex];
    if (nextLine === undefined || !nextLine.trim()) break;

    // Stop if line contains a phone number
    if (extractPhones(nextLine).length > 0) break;

    const fields = nextLine.split('|');
    const context =
      currentPhones.length > 1 && fields.length === columnCount
        ? fields[column]
        : fields.length > column && columnCount > 1
          ? fields[column]
          : nextLine;

    const candidate = candidateFrom(context);
    if (candidate) {
      if (candidate.explicit) {
        return {
          name: candidate.name,
          confidence: 0.95,
          reason: 'The name follows the phone number. Please confirm the association.',
        };
      } else if (offset === 1) {
        return {
          name: candidate.name,
          confidence: 0.7,
          reason: 'The name follows the phone number. Please confirm the association.',
        };
      }
    }
  }

  return {
    name: '',
    confidence: 0.2,
    reason: 'No confident name match was found. Add the name if you know it.',
  };
}
