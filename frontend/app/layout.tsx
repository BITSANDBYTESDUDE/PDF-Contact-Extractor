import '@fontsource-variable/dm-sans';
import '@fontsource-variable/manrope';
import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';
export const metadata: Metadata = {
  title: 'PDF Contact Extractor — Less busywork. More possibility.',
  description:
    'Turn text and scanned PDFs into clean contact lists. Extract names and phone numbers, review duplicates, and export to Excel or CSV. No account needed.',
  applicationName: 'PDF Contact Extractor',
  robots: { index: true, follow: true },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a href="#workspace-content" className="skip-link">
          Skip to content
        </a>
        <div id="main-content">{children}</div>
        <Toaster
          position="bottom-right"
          richColors
          closeButton
          toastOptions={{ className: 'app-toast', duration: 4500 }}
        />
      </body>
    </html>
  );
}
