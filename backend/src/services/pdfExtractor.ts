import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api.js';
import { getContactParser } from '../parsers/parserProvider.js';
import type { Contact, FileProgress, ProcessingOptions, UploadedFile } from '../types.js';
import { AppError } from '../utils/errors.js';
import { OcrService } from './ocrService.js';

const require = createRequire(import.meta.url);
const pdfRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));
// PDF.js needs these browser-compatible primitives when rendering in Node workers.
Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });

export interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL?: boolean;
}
/** Reconstruct visual rows from coordinates. Preserve large horizontal gaps as field boundaries. */
export function reconstructLines(items: PdfTextItem[]): string {
  const rows: { y: number; items: PdfTextItem[] }[] = [];
  for (const item of items
    .filter((i) => i.str.trim())
    .sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4])) {
    const y = item.transform[5];
    const row = rows.at(-1);
    if (row && Math.abs(row.y - y) <= Math.max(2.5, Math.min(item.height * 0.3, 5))) row.items.push(item);
    else rows.push({ y, items: [item] });
  }
  let previousY: number | null = null;
  return rows
    .map((row) => {
      const sorted = row.items.sort((a, b) => a.transform[4] - b.transform[4]);
      const height = Math.max(...sorted.map((i) => i.height || 10));
      const gap = previousY !== null && previousY - row.y > height * 2.5 ? '\n' : '';
      previousY = row.y;
      return (
        gap +
        sorted
          .map((item, index) => {
            const previous = sorted[index - 1];
            const gapX = previous ? item.transform[4] - previous.transform[4] - previous.width : 0;
            const separator = !index ? '' : gapX > Math.max(20, height * 1.8) ? ' | ' : ' ';
            return separator + item.str;
          })
          .join('')
      );
    })
    .join('\n');
}

async function renderPage(page: PDFPageProxy): Promise<Buffer> {
  const original = page.getViewport({ scale: 1 });
  if (original.width <= 0 || original.height <= 0 || !Number.isFinite(original.width * original.height)) {
    throw new AppError(422, 'This PDF contains an invalid page size. Re-save it and try again.');
  }
  const scale = Math.min(
    2.4,
    8192 / original.width,
    8192 / original.height,
    Math.sqrt(12_000_000 / (original.width * original.height)),
  );
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  try {
    await page.render({
      canvas: canvas as never,
      canvasContext: context as never,
      viewport,
      background: 'rgb(255,255,255)',
    }).promise;
    return canvas.toBuffer('image/png');
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
}

export async function processPdf(
  file: UploadedFile,
  options: ProcessingOptions,
  ocr: OcrService,
  progress: (update: Partial<FileProgress>) => void,
): Promise<Contact[]> {
  progress({ stage: 'analyzing', progress: 3 });
  const buffer = await readFile(file.path);
  if (!buffer.length) throw new AppError(422, 'This PDF is empty. Choose a document with at least one page.');
  if (!buffer.subarray(0, 1024).includes(Buffer.from('%PDF-')))
    throw new AppError(422, 'This file is not a valid PDF. Renaming a file to .pdf does not convert it.');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const assetUrl = (directory: string) => pathToFileURL(path.join(pdfRoot, directory) + path.sep).href;
  const task = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: true,
    standardFontDataUrl: assetUrl('standard_fonts'),
    cMapUrl: assetUrl('cmaps'),
    cMapPacked: true,
    wasmUrl: assetUrl('wasm'),
    maxImageSize: 16_000_000,
    verbosity: 0,
  });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > options.maxPages)
      throw new AppError(
        422,
        `This PDF has ${pdf.numPages} pages. The limit is ${options.maxPages} pages per file. Split the document and try again.`,
      );
    if (!pdf.numPages) throw new AppError(422, 'This PDF has no pages. Choose a different document.');
    const contacts: Contact[] = [];
    const warnings: string[] = [];
    let usedOcr = false;
    let readablePages = 0;
    const parser = getContactParser();
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const base = 8 + ((pageNumber - 1) / pdf.numPages) * 78;
      progress({ stage: 'extracting', pages: pdf.numPages, currentPage: pageNumber, progress: base });
      try {
        const content = await page.getTextContent();
        let text = reconstructLines(content.items.filter((i) => 'str' in i));
        const meaningful = text.replace(/[^\p{L}\p{N}]/gu, '').length;
        // Page-level detection handles mixed text/scanned documents. Also OCR an image-dominated
        // page containing only a text header, rather than mistaking the header for a text PDF.
        let needsOcr = meaningful < 18 || (text.match(/[\uFFFD]/g)?.length || 0) > text.length * 0.1;
        if (!needsOcr && (meaningful < 180 || !(await parser.parse(text, file.name, pageNumber)).length)) {
          const operators = await page.getOperatorList();
          needsOcr = operators.fnArray.some((op) =>
            [pdfjs.OPS.paintImageXObject, pdfjs.OPS.paintInlineImageXObject].includes(op),
          );
        }
        if (needsOcr) {
          usedOcr = true;
          progress({ stage: 'ocr', usedOcr: true, progress: base });
          try {
            const image = await renderPage(page);
            text = await ocr.recognize(image, (value) =>
              progress({ stage: 'ocr', progress: base + (value * 70) / pdf.numPages }),
            );
          } catch (error) {
            if (pdf.numPages === 1) throw error;
            warnings.push(`Page ${pageNumber} could not be read by OCR. Review the original page.`);
            continue;
          }
        }
        if (text.replace(/\s/g, '').length) readablePages++;
        progress({ stage: 'phones', progress: base + 72 / pdf.numPages });
        const pageContacts = await parser.parse(text, file.name, pageNumber);
        progress({ stage: 'names', progress: base + 76 / pdf.numPages });
        if (contacts.length + pageContacts.length > options.maxContacts)
          throw new AppError(
            422,
            `This PDF exceeds the ${options.maxContacts.toLocaleString()} contact limit. Split it into smaller documents.`,
          );
        contacts.push(...pageContacts);
      } finally {
        page.cleanup();
      }
    }
    progress({ stage: 'cleaning', progress: 95 });
    if (!contacts.length)
      warnings.push(
        readablePages
          ? 'No phone numbers were found. The layout or phone format may not be supported.'
          : 'No readable text was found, even after OCR. Try a clearer, upright scan.',
      );
    if (contacts.some((c) => !c.name))
      warnings.push('Some names could not be confidently matched. These contacts are marked Needs review.');
    progress({ stage: 'complete', progress: 100, contacts: contacts.length, usedOcr, warnings });
    return contacts;
  } finally {
    await task.destroy();
  }
}
