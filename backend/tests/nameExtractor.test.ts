import { describe, expect, it } from 'vitest';
import { extractContacts } from '../src/services/contactNormalizer.js';
import { cleanName } from '../src/parsers/nameExtractor.js';

describe('layout-aware name matching', () => {
  it.each([
    ['Muhammad Ali\n03001234567', 'Muhammad Ali'],
    ['Name: Muhammad Ali\nPhone: 03001234567', 'Muhammad Ali'],
    ['Muhammad Ali - 03001234567', 'Muhammad Ali'],
    ['Muhammad Ali\nContact: +923001234567', 'Muhammad Ali'],
    ['1. Muhammad Ali | 03001234567', 'Muhammad Ali'],
    ['Muhammad Ali\nMobile: 03001234567\nAddress: Lahore', 'Muhammad Ali'],
    ['Contact Person: Ahmed Khan\nTel: +92 321 1234567', 'Ahmed Khan'],
    ['Name: Anne-Marie O’Neill | Phone: +44 20 7946 0958', 'Anne-Marie O’Neill'],
    ['محمد علی\n03001234567', 'محمد علی'],
    ['03001234567 | Muhammad Ali', 'Muhammad Ali'],
  ])('pairs names in %s', (text, name) => {
    const contacts = extractContacts(text, 'test.pdf');
    expect(contacts).toHaveLength(1);
    expect(contacts[0].name).toBe(name);
    expect(contacts[0].status).toBe('valid');
  });
  it.each([
    'Phone: 03001234567',
    'Customer Support\n03001234567',
    'Address: 12 Main Road\nContact: 03001234567',
    'Please call us\n03001234567',
    'Contact List\n03001234567',
  ])('does not invent a name in %s', (text) => {
    const [contact] = extractContacts(text, 'test.pdf');
    expect(contact.name).toBe('');
    expect(contact.status).toBe('needs-review');
  });
  it('does not borrow the previous contact’s name', () => {
    const contacts = extractContacts('Muhammad Ali\n03001234567\nPhone: 03211234567', 'test.pdf');
    expect(contacts[0].name).toBe('Muhammad Ali');
    expect(contacts[1].name).toBe('');
  });
  it('respects record boundaries', () =>
    expect(extractContacts('Muhammad Ali\n\nPhone: 03211234567', 'test.pdf')[0].name).toBe(''));
  it('matches independent contact columns', () =>
    expect(
      extractContacts('Muhammad Ali | 03001234567 | Ahmed Khan | 03211234567', 'test.pdf').map((c) => c.name),
    ).toEqual(['Muhammad Ali', 'Ahmed Khan']));
  it('preserves vertically stacked two-column layouts', () =>
    expect(
      extractContacts('Muhammad Ali | Ahmed Khan\n03001234567 | 03211234567', 'test.pdf').map((c) => c.name),
    ).toEqual(['Muhammad Ali', 'Ahmed Khan']));
  it('does not steal the next contact’s name', () =>
    expect(extractContacts('03001234567 | Sara Fatima | 03331234567', 'test.pdf').map((c) => c.name)).toEqual(
      ['', 'Sara Fatima'],
    ));
  it('flags a non-adjacent unlabelled name for review', () => {
    const [contact] = extractContacts('Muhammad Ali\nAddress: Lahore\nPhone: 03001234567', 'test.pdf');
    expect(contact.name).toBe('Muhammad Ali');
    expect(contact.status).toBe('needs-review');
  });
  it('retains source page metadata and invalid rows', () => {
    const [contact] = extractContacts('Name: Bilal Ahmed\nPhone: 0300123', 'file.pdf', 5);
    expect(contact.sourcePage).toBe(5);
    expect(contact.status).toBe('invalid');
    expect(contact.name).toBe('Bilal Ahmed');
  });
  it('rejects labels, prose, addresses and email addresses as names', () => {
    for (const candidate of [
      'Phone:',
      'Address: Lahore',
      'John john@example.com',
      'Reach us for more information',
      '123 Main Road',
      'Customer Support',
    ])
      expect(cleanName(candidate)).toBe('');
  });
});
