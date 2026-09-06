import { FileQuestion } from 'lucide-react';
import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="full-page-state">
      <FileQuestion size={38} strokeWidth={1.4} />
      <h1>This page slipped out of the folder.</h1>
      <p>Let’s get you back to your workspace.</p>
      <Link href="/" className="button button-primary">
        Back to contact extractor
      </Link>
    </div>
  );
}
