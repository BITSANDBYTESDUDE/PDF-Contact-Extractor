import { describe, expect, it } from 'vitest';
import { extractPhones, validatePhone } from '../src/parsers/phoneExtractor.js';

describe('Pakistani phone normalization', () => {
  it.each([
    '03001234567',
    '0300-1234567',
    '0300 1234567',
    '+923001234567',
    '+92 300 1234567',
    '00923001234567',
    '92-300-1234567',
    '+92 (300) 123 4567',
  ])('normalizes %s to the same verified number', (raw) => {
    expect(validatePhone(raw)).toEqual({
      valid: true,
      normalized: '+923001234567',
      display: '03001234567',
      country: 'PK',
    });
    expect(extractPhones(`Muhammad Ali | ${raw}`)).toHaveLength(1);
  });
  it.each(['021-34567890', '+92 42 34567890'])('recognizes Pakistani fixed lines: %s', (raw) =>
    expect(validatePhone(raw).valid).toBe(true),
  );
  it.each(['+1 (415) 555-2671', '+44 20 7946 0958', '00442079460958', '+971 50 123 4567'])(
    'recognizes explicit international numbers: %s',
    (raw) => {
      expect(validatePhone(raw).valid).toBe(true);
      expect(extractPhones(`Phone: ${raw}`)).toHaveLength(1);
    },
  );
  it('allows a configurable country in the reusable validator', () =>
    expect(validatePhone('020 7946 0958', 'GB').normalized).toBe('+442079460958'));
  it.each([
    '2026-09-06',
    '35202-1234567-1',
    '030012345678901234',
    'PKR 3000.00',
    '',
    'not a phone',
    '=1+1',
    '0300abc4567',
  ])('rejects %s', (raw) => expect(validatePhone(raw).valid).toBe(false));
  it.each([
    'Invoice: 03001234567',
    'Order ID: 03001234567',
    'CNIC: 35202-1234567-1',
    'Date: 2026-09-06',
    'Price: 03001234567',
    'Account Number: 03001234567',
    'ID03001234567',
    '03001234567ABC',
    'Order # 00923001234567',
  ])('does not mistake identifiers for contacts: %s', (line) => expect(extractPhones(line)).toHaveLength(0));
  it('retains labelled invalid numbers for review', () => {
    const result = extractPhones('Phone: 0300123');
    expect(result).toHaveLength(1);
    expect(result[0].valid).toBe(false);
    expect(result[0].normalized).toBeNull();
  });
  it('rejects an unlabelled arbitrary short number', () =>
    expect(extractPhones('Balance 0300123')).toHaveLength(0));
  it('finds more than one contact in a table row', () =>
    expect(extractPhones('Muhammad Ali | 03001234567 | Ahmed Khan | 03211234567')).toHaveLength(2));
});

describe('frontend/backend validation parity', () => {
  it('uses consistent canonical values when the user edits contacts', async () => {
    const { validatePhone: clientValidate } = await import('../../frontend/lib/contacts.js');
    for (const raw of [
      '03001234567',
      '0300-1234567',
      '+92 300 1234567',
      '00923001234567',
      '92-300-1234567',
      '+14155552671',
      '+44 20 7946 0958',
      '35202-1234567-1',
      '0300123',
      '=1+1',
    ]) {
      const server = validatePhone(raw);
      const client = clientValidate(raw);
      expect(!!client).toBe(server.valid);
      expect(client?.normalized || null).toBe(server.normalized);
      if (client) expect(client.display).toBe(server.display);
    }
  });
});
