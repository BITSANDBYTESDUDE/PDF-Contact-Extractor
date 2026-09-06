'use client';
import { Button } from '@/components/ui/button';
import { AlertCircle, RotateCcw } from 'lucide-react';
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="full-page-state">
      <AlertCircle size={38} strokeWidth={1.4} />
      <h1>A small bump in the workflow.</h1>
      <p>We couldn’t display this page. Please try again. Unsaved contacts may need to be extracted again.</p>
      <Button onClick={reset}>
        <RotateCcw size={16} />
        Try again
      </Button>
    </div>
  );
}
