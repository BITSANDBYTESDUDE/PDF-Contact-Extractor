import { afterAll, describe, expect, it } from 'vitest';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { processPdf, reconstructLines } from '../src/services/pdfExtractor.js';
import { OcrService } from '../src/services/ocrService.js';
import { config } from '../src/config.js';
import type { FileProgress } from '../src/types.js';

const fixtures = path.resolve('backend/tests/fixtures');
const scratch = path.join(config.uploadDir, 'pdf-tests');
const ocr = new OcrService('eng', '');
const options = { maxPages: 100, maxContacts: 10000, ocrLanguage: 'eng', ocrLangPath: '' };
async function processFixture(name: string, progress: (p: Partial<FileProgress>) => void = () => {}) {
  const file = path.join(fixtures, name);
  return processPdf(
    { id: name, path: file, name, size: (await readFile(file)).length },
    options,
    ocr,
    progress,
  );
}
afterAll(async () => {
  await ocr.dispose();
  await rm(scratch, { recursive: true, force: true });
});
describe('real PDF pipeline', () => {
  it('reconstructs rows and marks column gaps', () => {
    const items = [
      { str: '03001234567', transform: [1, 0, 0, 1, 200, 700], width: 80, height: 12 },
      { str: 'Muhammad Ali', transform: [1, 0, 0, 1, 50, 700], width: 85, height: 12 },
    ];
    expect(reconstructLines(items)).toBe('Muhammad Ali | 03001234567');
  });
  it('extracts all nine contacts from a real text PDF', async () => {
    const updates: Partial<FileProgress>[] = [];
    const contacts = await processFixture('text-contacts.pdf', (p) => updates.push(p));
    expect(contacts).toHaveLength(9);
    expect(contacts[0]).toMatchObject({ name: 'Muhammad Ali', phone: '03001234567' });
    expect(contacts.find((c) => c.phone === '03011234567')?.name).toBe('');
    expect(contacts.filter((c) => c.status === 'invalid')).toHaveLength(1);
    expect(updates.at(-1)).toMatchObject({ stage: 'complete', usedOcr: false, contacts: 9 });
  });
  it('performs real offline OCR on an image-only PDF', async () => {
    const updates: Partial<FileProgress>[] = [];
    const contacts = await processFixture('scanned-contacts.pdf', (p) => updates.push(p));
    expect(updates.some((p) => p.stage === 'ocr')).toBe(true);
    expect(contacts.map((c) => [c.name, c.phone])).toEqual([
      ['Muhammad Ali', '03001234567'],
      ['Ahmed Khan', '03211234567'],
      ['Sara Fatima', '03331234567'],
      ['Ayesha Noor', '03123456789'],
    ]);
  });
  it('handles mixed text and scanned pages independently', async () => {
    await mkdir(scratch, { recursive: true });
    const mixed = await PDFDocument.create();
    for (const filename of ['text-contacts.pdf', 'scanned-contacts.pdf']) {
      const source = await PDFDocument.load(await readFile(path.join(fixtures, filename)));
      const [page] = await mixed.copyPages(source, [0]);
      mixed.addPage(page);
    }
    const file = path.join(scratch, 'mixed.pdf');
    const bytes = await mixed.save();
    await writeFile(file, bytes);
    const contacts = await processPdf(
      { id: 'mixed', path: file, name: 'mixed.pdf', size: bytes.length },
      options,
      ocr,
      () => {},
    );
    expect(contacts).toHaveLength(13);
    expect(contacts.filter((c) => c.sourcePage === 2)).toHaveLength(4);
  });
  it('rejects non-PDF and empty bytes with safe errors', async () => {
    await mkdir(scratch, { recursive: true });
    for (const [name, bytes, message] of [
      ['fake.pdf', Buffer.from('not PDF'), 'not a valid PDF'],
      ['empty.pdf', Buffer.alloc(0), 'empty'],
    ] as const) {
      const file = path.join(scratch, name);
      await writeFile(file, bytes);
      await expect(
        processPdf({ id: name, path: file, name, size: bytes.length }, options, ocr, () => {}),
      ).rejects.toThrow(message);
    }
  });
  it('rejects documents over the configured page limit', async () => {
    await mkdir(scratch, { recursive: true });
    const pdf = await PDFDocument.create();
    pdf.addPage();
    pdf.addPage();
    const file = path.join(scratch, 'two-pages.pdf');
    const bytes = await pdf.save();
    await writeFile(file, bytes);
    await expect(
      processPdf(
        { id: 'pages', path: file, name: 'two-pages.pdf', size: bytes.length },
        { ...options, maxPages: 1 },
        ocr,
        () => {},
      ),
    ).rejects.toThrow('limit is 1 pages');
  });
  it('finishes blank PDFs with a useful no-readable-text warning', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const file = path.join(scratch, 'blank.pdf');
    const bytes = await pdf.save();
    await writeFile(file, bytes);
    const updates: Partial<FileProgress>[] = [];
    const contacts = await processPdf(
      { id: 'blank', path: file, name: 'blank.pdf', size: bytes.length },
      options,
      ocr,
      (p) => updates.push(p),
    );
    expect(contacts).toHaveLength(0);
    expect(updates.at(-1)?.warnings?.join(' ')).toContain('No readable text');
  });
});
