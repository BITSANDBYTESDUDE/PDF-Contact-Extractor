import { createRequire } from 'node:module';
import { createWorker, OEM, PSM, type Worker } from 'tesseract.js';
import { AppError } from '../utils/errors.js';

const require = createRequire(import.meta.url);
export class OcrService {
  private worker?: Worker;
  private onProgress?: (progress: number) => void;
  constructor(
    private language: string,
    private languagePath: string,
  ) {}

  async recognize(image: Buffer, onProgress: (progress: number) => void): Promise<string> {
    this.onProgress = onProgress;
    try {
      if (!this.worker) {
        const bundled = require('@tesseract.js-data/eng') as { langPath: string };
        if (this.language !== 'eng' && !this.languagePath) {
          throw new AppError(
            422,
            'The requested OCR language is not installed. Ask your administrator to configure its language data.',
          );
        }
        this.worker = await createWorker(this.language, OEM.LSTM_ONLY, {
          langPath: this.languagePath || bundled.langPath,
          cacheMethod: 'none',
          gzip: true,
          logger: (message) => {
            if (message.status === 'recognizing text') this.onProgress?.(message.progress);
          },
          errorHandler: (error) => console.error('[ocr-worker]', error),
        });
        await this.worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1' });
      }
      const { data } = await this.worker.recognize(image);
      return data.text;
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('[ocr]', error);
      throw new AppError(
        422,
        'OCR could not read this page. Try a sharper, upright scan with a higher resolution.',
      );
    }
  }

  async dispose() {
    if (this.worker) await this.worker.terminate();
    this.worker = undefined;
  }
}
