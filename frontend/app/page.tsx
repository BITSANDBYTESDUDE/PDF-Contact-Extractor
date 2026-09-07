import Dashboard from '@/components/dashboard/dashboard';
import Link from 'next/link';

export default function Page() {
  return (
    <>
      <p className="text-center my-4">
        <Link
          href="http://bitsandbytesdude.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="glow-link"
        >
          BITSANDBYTESDUDE – A SaaS / Web Application
        </Link>
      </p>
      <Dashboard />
    </>
  );
}
