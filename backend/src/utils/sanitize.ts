import path from 'node:path';
export function cleanText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .trim();
}
export function safeFilename(value: string): string {
  return (
    cleanText(path.basename(value.replace(/\\/g, '/')))
      .replace(/[<>:"|?*]/g, '_')
      .slice(0, 180) || 'document.pdf'
  );
}
/** Prevent formula injection. Literal strings in XLSX do not need this prefix. */
export function csvSafeText(value: string): string {
  const text = cleanText(value).replace(/[\r\n\t]+/g, ' ');
  return /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
}
