import { describe, expect, it } from 'vitest';
import { extractContacts } from '../src/services/contactNormalizer.js';
import {
  calculateStats,
  isConfidentDuplicateGroup,
  markDuplicates,
} from '../src/services/duplicateDetector.js';

describe('conservative duplicate detection', () => {
  it('marks normalized duplicates without deleting any contacts', () => {
    const contacts = extractContacts(
      'Muhammad Ali | 03001234567\nMuhammad Ali | +92 300 1234567\nAhmed Khan | 03211234567',
      'test.pdf',
    );
    const result = markDuplicates(contacts);
    expect(result).toHaveLength(3);
    expect(result[0].duplicateGroup).toBe(result[1].duplicateGroup);
    expect(result[2].duplicateGroup).toBeUndefined();
    expect(calculateStats(result, 1)).toMatchObject({
      total: 3,
      valid: 3,
      duplicates: 1,
      duplicateGroups: 1,
      filesProcessed: 1,
    });
  });
  it('never confidently merges different named people sharing a number', () =>
    expect(isConfidentDuplicateGroup([{ name: 'Muhammad Ali' }, { name: 'Ahmed Khan' }])).toBe(false));
  it('recognizes equivalent names and missing names for optional merge', () =>
    expect(
      isConfidentDuplicateGroup([{ name: 'Muhammad Ali' }, { name: ' muhammad   ali ' }, { name: '' }]),
    ).toBe(true));
  it('does not group invalid phone numbers', () =>
    expect(
      markDuplicates(
        extractContacts('Name: Bilal Ahmed\nPhone: 0300123\nName: Bilal Ahmed\nPhone: 0300123', 'test.pdf'),
      ).every((c) => !c.duplicateGroup),
    ).toBe(true));
  it('clears stale duplicate marks after editing', () => {
    const contacts = markDuplicates(
      extractContacts('Muhammad Ali | 03001234567\nMuhammad Ali | 03001234567', 'test.pdf'),
    );
    contacts[1].phone = '03211234567';
    expect(markDuplicates(contacts).every((c) => !c.duplicateGroup)).toBe(true);
  });
});
