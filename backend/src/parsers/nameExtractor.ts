import { extractPhones } from './phoneExtractor.js';

export interface NameMatch {
  name: string;
  confidence: number;
  reason?: string;
}
const nameLabel = /(?:full\s*name|contact\s*person|customer\s*name|person|name)\s*[:=-]\s*/i;
const blockedWords =
  /\b(?:address|street|road|avenue|block|sector|phase|floor|building|apartment|lahore|karachi|islamabad|rawalpindi|pakistan|invoice|order|amount|date|total|company|limited|ltd|pvt|department|contacts?|phone|mobile|telephone|tel|email|website|list|directory|report|page|office|support|customer|service|please|call|reach|details|number|note|scan|sample|example|emergency|unknown|not available)\b/i;

export function cleanName(candidate: string, explicit = false): string {
  let name = candidate
    .normalize('NFKC')
    .replace(/^\s*\d+[.)\s:-]+/, '')
    .replace(nameLabel, '')
    .replace(/\b(?:phone|mobile|contact|tel(?:ephone)?|cell|whatsapp)\s*(?:number|no\.?)?\s*[:=-]?\s*$/i, '')
    .replace(/^[\s|:;,\-–—•]+|[\s|:;,\-–—•]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!name || name.length > 100 || /[\d@/\\=<>]/.test(name) || blockedWords.test(name)) return '';
  if (!/^[\p{L}\p{M}\s.'’\-]+$/u.test(name)) return '';
  const words = name.split(' ').filter(Boolean);
  if (words.length < (explicit ? 1 : 2) || words.length > 6) return '';
  if (words.every((w) => w.replace(/[^\p{L}]/gu, '').length < 2)) return '';
  // Do not turn sentence fragments into invented names.
  if (
    /\b(?:is|are|was|the|this|that|from|with|and|for|more|information|below|above|our|your|you|us)\b/i.test(
      name,
    )
  )
    return '';
  return name;
}

function candidateFrom(fragment: string): { name: string; explicit: boolean } | null {
  const label = nameLabel.exec(fragment);
  if (label) {
    const after = fragment
      .slice(label.index + label[0].length)
      .split(/[|;\t]|\b(?:phone|mobile|address|tel|email)\s*:/i)[0];
    const name = cleanName(after, true);
    if (name) return { name, explicit: true };
  }
  for (const segment of fragment.split(/[|;\t]/).reverse()) {
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
  // Only inspect the field after the preceding phone on a multi-contact row.
  const preceding = extractPhones(current)
    .filter((p) => p.end <= start)
    .at(-1);
  const before = candidateFrom(current.slice(preceding?.end || 0, start));
  if (before) return { name: before.name, confidence: before.explicit ? 0.98 : 0.91 };
  const following = extractPhones(current).find((p) => p.start >= end);
  const after = !following ? candidateFrom(current.slice(end)) : null;
  if (after) return { name: after.name, confidence: after.explicit ? 0.96 : 0.76 };
  for (let offset = 1; offset <= 2; offset++) {
    const line = lines[lineIndex - offset];
    if (line === undefined || !line.trim() || extractPhones(line).length) break;
    const fields = line.split('|');
    // Preserve a vertical name/phone pairing in parallel contact columns.
    const context = currentPhones.length > 1 && fields.length === columnCount ? fields[column] : line;
    const candidate = candidateFrom(context);
    if (candidate)
      return {
        name: candidate.name,
        confidence: candidate.explicit ? 0.97 : offset === 1 ? 0.84 : 0.67,
        ...(offset > 1 && !candidate.explicit
          ? { reason: 'The name was found two lines away. Please confirm the association.' }
          : {}),
      };
  }
  const next = lines[lineIndex + 1];
  if (next && nameLabel.test(next) && !extractPhones(next).length) {
    const candidate = candidateFrom(next);
    if (candidate)
      return {
        name: candidate.name,
        confidence: 0.7,
        reason: 'The name follows the phone number. Please confirm the association.',
      };
  }
  return {
    name: '',
    confidence: 0.2,
    reason: 'No confident name match was found. Add the name if you know it.',
  };
}
