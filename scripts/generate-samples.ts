import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const samples = path.join(root, 'frontend/public/samples');
const fixtures = path.join(root, 'backend/tests/fixtures');
await mkdir(samples, { recursive: true });
await mkdir(fixtures, { recursive: true });
const doc = await PDFDocument.create();
doc.setTitle('PDF Contact Extractor — synthetic sample');
doc.setAuthor('PDF Contact Extractor');
const page = doc.addPage([595, 842]);
const font = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);
page.drawText('A little less copy-paste.', {
  x: 50,
  y: 785,
  size: 25,
  font: bold,
  color: rgb(0.17, 0.31, 0.23),
});
page.drawText('PDF Contact Extractor / Synthetic sample contact list', {
  x: 50,
  y: 761,
  size: 10,
  font,
  color: rgb(0.5, 0.55, 0.48),
});
page.drawLine({
  start: { x: 50, y: 739 },
  end: { x: 545, y: 739 },
  color: rgb(0.86, 0.9, 0.82),
  thickness: 1,
});
const lines = [
  '1. Muhammad Ali | 0300-1234567',
  '2. Ahmed Khan | +92 321 1234567',
  '',
  'Name: Sara Fatima',
  'Phone: 03331234567',
  '',
  'Contact Person: Hassan Raza',
  'Tel: +92 345 1234567',
  '',
  'Ayesha Noor - 0312 3456789',
  '',
  'Muhammad Ali',
  'Mobile: 00923001234567',
  '',
  'Contact: 03011234567',
  '',
  'Name: Emily Parker',
  'Phone: +1 415 555 2671',
  '',
  'Name: Bilal Ahmed',
  'Phone: 0300123',
  '',
  'Invoice: 03009999888',
  'CNIC: 35202-1234567-1',
];
let y = 706;
for (const line of lines) {
  if (line) page.drawText(line, { x: 50, y, font, size: 12, color: rgb(0.25, 0.31, 0.24) });
  y -= 24;
}
page.drawText('For testing only. All names and numbers are synthetic, not real customer data.', {
  x: 50,
  y: 85,
  size: 8,
  font,
  color: rgb(0.55, 0.59, 0.51),
});
page.drawText('Includes varied layouts, 1 duplicate, 1 missing name, and 1 invalid phone.', {
  x: 50,
  y: 70,
  size: 8,
  font,
  color: rgb(0.55, 0.59, 0.51),
});
const textBytes = await doc.save();
await writeFile(path.join(samples, 'sample-contacts.pdf'), textBytes);
await writeFile(path.join(fixtures, 'text-contacts.pdf'), textBytes);

const fontPath = path.join(
  root,
  'node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2',
);
GlobalFonts.registerFromPath(fontPath, 'DMSans');
const canvas = createCanvas(1400, 1750);
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, 1400, 1750);
ctx.fillStyle = '#202c24';
ctx.font = 'bold 48px DMSans, sans-serif';
ctx.fillText('SCANNED CONTACT SHEET', 110, 150);
ctx.font = '25px DMSans, sans-serif';
ctx.fillStyle = '#74796f';
ctx.fillText('Synthetic sample / Image-only PDF / OCR test', 110, 215);
ctx.fillStyle = '#181e18';
ctx.font = '38px DMSans, sans-serif';
const scanLines = [
  ['Name: Muhammad Ali', 'Mobile: 03001234567'],
  ['Name: Ahmed Khan', 'Phone: 03211234567'],
  ['Name: Sara Fatima', 'Phone: 03331234567'],
  ['Name: Ayesha Noor', 'Mobile: 03123456789'],
];
let sy = 365;
for (const block of scanLines) {
  ctx.fillText(block[0], 110, sy);
  ctx.fillText(block[1], 110, sy + 65);
  sy += 235;
}
ctx.fillStyle = '#888c82';
ctx.font = '22px DMSans, sans-serif';
ctx.fillText('For testing only. No real customer information.', 110, 1550);
const scan = await PDFDocument.create();
const image = await scan.embedPng(canvas.toBuffer('image/png'));
const scanPage = scan.addPage([595, 744]);
scanPage.drawImage(image, { x: 0, y: 0, width: 595, height: 744 });
scan.setTitle('Scanned synthetic contacts — OCR sample');
const scanBytes = await scan.save();
await writeFile(path.join(samples, 'scanned-contacts.pdf'), scanBytes);
await writeFile(path.join(fixtures, 'scanned-contacts.pdf'), scanBytes);
await writeFile(path.join(fixtures, 'sample-layouts.txt'), lines.join('\n'));
console.info('Created text and image-only PDF samples.');
