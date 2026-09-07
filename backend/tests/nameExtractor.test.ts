import { describe, expect, it } from 'vitest';
import { extractContacts } from '../src/services/contactNormalizer.js';
import { cleanName, isCustomerSectionHeader } from '../src/parsers/nameExtractor.js';

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

  describe('invoice customer extraction', () => {
    it.each([
      [
        'INVOICE #1024\nBILL TO:\nMuhammad Ali\n123 Main Street\nLahore, Pakistan\nPhone: 0300-1234567',
        'Muhammad Ali',
        '03001234567',
      ],
      [
        'Billed To:\nSara Fatima\nHouse 42, Street 8, F-7/2\nIslamabad\nsara.fatima@example.com\n+92 333 1234567',
        'Sara Fatima',
        '03331234567',
      ],
      [
        'CUSTOMER DETAILS\nCustomer Name: Ahmed Khan\nAddress: Plot 15, Sector 4, Korangi, Karachi\nTel: 0321-1234567',
        'Ahmed Khan',
        '03211234567',
      ],
      ['Customer: Bilal Ahmed\nMobile: 0312-3456789', 'Bilal Ahmed', '03123456789'],
      ['Client: Ayesha Noor\nTel: +92 345 1234567', 'Ayesha Noor', '03451234567'],
      ['Sold To:\nZainab Bibi\nPhone: 0305-5555555', 'Zainab Bibi', '03055555555'],
      ['Ship To:\nBilal Hassan\nLahore\n0312-3456789', 'Bilal Hassan', '03123456789'],
      ['Invoice To:\nHassan Raza\nLahore\nPhone: 0300-9988776', 'Hassan Raza', '03009988776'],
      ['Consignee:\nTariq Mehmood\n0300-1122334', 'Tariq Mehmood', '03001122334'],
      [
        'BUYER:\nHamza Malik\nAddress: Sector G-11, Islamabad\nPhone: 0322-9988776',
        'Hamza Malik',
        '03229988776',
      ],
      ['Party Name: M/S Usman Ali\nCell: 0300-4455667', 'Usman Ali', '03004455667'],
      ['Attn: Farhan Akhtar\nPhone: 0334-7766554', 'Farhan Akhtar', '03347766554'],
      ['Bill To:\nMr. Muhammad Ali\n0300-1234567', 'Muhammad Ali', '03001234567'],
      ['Customer: Fatima\nPhone: 03001234567', 'Fatima', '03001234567'],
      ['Customer Contact: 0300-1234567\nCustomer Name: Muhammad Ali', 'Muhammad Ali', '03001234567'],
      [
        'BILL TO: John Smith\n123 Broadway, New York, NY 10001\nPhone: +1 415 555 2671',
        'John Smith',
        '+14155552671',
      ],
      ['CUSTOMER NAME : MUHAMMAD ALI\nPHONE NUMBER  : 0300-1234567', 'MUHAMMAD ALI', '03001234567'],
    ])(
      'correctly extracts customer name and phone from invoice:\n%s',
      (invoiceText, expectedName, expectedPhone) => {
        const contacts = extractContacts(invoiceText, 'invoice.pdf');
        const contact = contacts.find((c) => c.phone === expectedPhone);
        expect(contact).toBeDefined();
        expect(contact?.name).toBe(expectedName);
        expect(contact?.status).toBe('valid');
      },
    );

    it('extracts customer information from side-by-side company and bill-to columns', () => {
      const invoiceText = [
        'ACME Corporation | BILL TO:',
        '123 Tech Boulevard | Muhammad Ali',
        'Lahore, Pakistan | House 10, DHA Phase 6',
        'sales@acme.com | Lahore',
        'Tel: 042-35712345 | 0300-1234567',
      ].join('\n');
      const contacts = extractContacts(invoiceText, 'invoice.pdf');
      const customerContact = contacts.find((c) => c.phone === '03001234567');
      expect(customerContact).toBeDefined();
      expect(customerContact?.name).toBe('Muhammad Ali');
      expect(customerContact?.status).toBe('valid');
    });

    it('extracts multiple customers from tabular invoices', () => {
      const tableText = [
        'Invoice # | Customer Name | Contact Number | Total',
        'INV-001 | Muhammad Ali | 0300-1234567 | PKR 5,000',
        'INV-002 | Sara Fatima | 0333-1234567 | PKR 12,500',
        'INV-003 | Ahmed Khan | 0321-1234567 | PKR 8,000',
      ].join('\n');
      const contacts = extractContacts(tableText, 'orders.pdf');
      expect(contacts).toHaveLength(3);
      expect(contacts.map((c) => [c.name, c.phone])).toEqual([
        ['Muhammad Ali', '03001234567'],
        ['Sara Fatima', '03331234567'],
        ['Ahmed Khan', '03211234567'],
      ]);
      expect(contacts.every((c) => c.status === 'valid')).toBe(true);
    });
  });

  it.each([
    'Phone: 03001234567',
    'Customer Support\n03001234567',
    'Address: 12 Main Road\nContact: 03001234567',
    'Please call us\n03001234567',
    'Contact List\n03001234567',
    'Total Amount: PKR 50,000\nPhone: 03001234567',
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

  it('identifies customer section headers correctly', () => {
    expect(isCustomerSectionHeader('BILL TO:')).toBe(true);
    expect(isCustomerSectionHeader('Billed To')).toBe(true);
    expect(isCustomerSectionHeader('CUSTOMER DETAILS:')).toBe(true);
    expect(isCustomerSectionHeader('Customer Information')).toBe(true);
    expect(isCustomerSectionHeader('Invoice To:')).toBe(true);
    expect(isCustomerSectionHeader('Sold To:')).toBe(true);
    expect(isCustomerSectionHeader('Ship To:')).toBe(true);
    expect(isCustomerSectionHeader('Buyer:')).toBe(true);
    expect(isCustomerSectionHeader('Consignee:')).toBe(true);
    expect(isCustomerSectionHeader('Attn:')).toBe(true);
    expect(isCustomerSectionHeader('Muhammad Ali')).toBe(false);
    expect(isCustomerSectionHeader('123 Main Street')).toBe(false);
  });

  it('rejects labels, prose, addresses and email addresses as names', () => {
    for (const candidate of [
      'Phone:',
      'Address: Lahore',
      'John john@example.com',
      'Reach us for more information',
      '123 Main Road',
      'Customer Support',
      'Total Amount: 5000',
    ])
      expect(cleanName(candidate)).toBe('');
  });
});
