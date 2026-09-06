export type ContactStatus = 'valid' | 'needs-review' | 'invalid';
export interface Contact {
  id: string;
  name: string;
  phone: string;
  normalizedPhone: string | null;
  sourceFile: string;
  sourcePage: number;
  status: ContactStatus;
  confidence: number;
  reviewReason?: string;
  duplicateGroup?: string;
}
export type ProcessingStage =
  'queued' | 'analyzing' | 'extracting' | 'ocr' | 'phones' | 'names' | 'cleaning' | 'complete' | 'error';
export interface FileProgress {
  id: string;
  name: string;
  size: number;
  stage: ProcessingStage;
  progress: number;
  pages?: number;
  currentPage?: number;
  contacts?: number;
  usedOcr?: boolean;
  error?: string;
  warnings?: string[];
}
export interface ExtractionStats {
  total: number;
  valid: number;
  invalid: number;
  needsReview: number;
  duplicates: number;
  duplicateGroups: number;
  filesProcessed: number;
}
export interface ExtractionJob {
  id: string;
  status: 'queued' | 'processing' | 'complete' | 'failed' | 'cancelled';
  createdAt: string;
  completedAt?: string;
  files: FileProgress[];
  contacts?: Contact[];
  stats?: ExtractionStats;
  error?: string;
}
export interface SelectedFile {
  id: string;
  file: File;
}
export interface UploadLimits {
  maxFileSize: number;
  maxTotalSize: number;
  maxFiles: number;
  maxPages: number;
}
