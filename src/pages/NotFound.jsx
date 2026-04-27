import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center"
      style={{ backgroundColor: 'var(--page-bg, #f9fafb)' }}
    >
      {/* Cat illustration */}
      <div className="mb-8 select-none" aria-hidden="true">
        <pre className="text-5xl sm:text-7xl leading-snug font-mono inline-block text-left">
{`   /\\_/\\
  ( -.- )
   > ω <
  /|   |\\
 (_|   |_)`}
        </pre>
        {/* Couch */}
        <div className="mt-1 text-4xl sm:text-6xl">
          🛋️
        </div>
      </div>

      {/* Error number */}
      <p className="font-mono text-8xl sm:text-9xl font-black tracking-tighter mb-2"
        style={{ color: 'var(--accent, #ED64A6)', lineHeight: 1 }}
      >
        404
      </p>

      {/* Headline */}
      <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-800 mt-4 mb-3">
        Oh no, you've found our junior developer's homepage!
      </h1>

      {/* Body copy */}
      <p className="text-gray-500 max-w-md text-base sm:text-lg leading-relaxed mb-8">
        Despite sleeping on the couch most of the day, our junior web developer
        still finds time to do some coding…{' '}
        <span className="text-gray-400 text-sm">(just not this page.)</span>
      </p>

      {/* CTA */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-semibold text-sm shadow-md hover:opacity-90 hover:-translate-y-0.5 transition-all duration-150"
        style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </Link>
    </div>
  );
}
