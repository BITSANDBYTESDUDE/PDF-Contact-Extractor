import { rm } from 'node:fs/promises';
import { parentPort, workerData } from 'node:worker_threads';
import { calculateStats, markDuplicates } from '../services/duplicateDetector.js';
import { OcrService } from '../services/ocrService.js';
import { processPdf } from '../services/pdfExtractor.js';
import type { Contact, ProcessingOptions, UploadedFile, WorkerMessage } from '../types.js';
import { safeProcessingError } from '../utils/errors.js';

const { files, options } = workerData as { files: UploadedFile[]; options: ProcessingOptions };
const send = (message: WorkerMessage) => parentPort?.postMessage(message);
const ocr = new OcrService(options.ocrLanguage, options.ocrLangPath);
try {
  const contacts: Contact[] = [];
  let processed = 0;
  for (const file of files) {
    try {
      const result = await processPdf(
        file,
        { ...options, maxContacts: options.maxContacts - contacts.length },
        ocr,
        (update) => send({ type: 'progress', fileId: file.id, update }),
      );
      contacts.push(...result);
      processed++;
    } catch (error) {
      // Logs intentionally do not include extracted text, contact details, or original filenames.
      console.error(`[pdf-worker:${file.id}]`, error);
      send({
        type: 'progress',
        fileId: file.id,
        update: { stage: 'error', progress: 100, error: safeProcessingError(error) },
      });
    } finally {
      await rm(file.path, { force: true });
    }
  }
  const normalized = markDuplicates(contacts);
  send({ type: 'result', contacts: normalized, stats: calculateStats(normalized, processed) });
} catch (error) {
  console.error('[extraction-worker]', error);
  send({ type: 'error', error: 'The extraction could not be completed. Please try again with fewer files.' });
} finally {
  await ocr.dispose();
}
