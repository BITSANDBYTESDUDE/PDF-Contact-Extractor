export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code = 'REQUEST_ERROR',
  ) {
    super(message);
    this.name = 'AppError';
  }
}
export function safeProcessingError(error: unknown): string {
  if (error instanceof AppError) return error.message;
  const name = error instanceof Error ? error.name : '';
  if (name === 'PasswordException')
    return 'This PDF is password-protected. Remove its password and upload it again.';
  if (name === 'InvalidPDFException' || name === 'FormatError')
    return 'This PDF appears to be corrupted or invalid. Try saving a new copy and uploading it again.';
  if (name === 'MissingPDFException') return 'The PDF could not be read. Please upload it again.';
  return 'Unable to process this PDF. Try a smaller file or a clearer scan, then upload it again.';
}
