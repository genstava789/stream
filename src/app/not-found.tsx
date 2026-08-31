import React from 'react';
import Link from 'next/link';
import { Film, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#050816' }}
    >
      <div className="text-center max-w-md">
        <div
          className="inline-flex items-center justify-center w-24 h-24 rounded-full mb-8"
          style={{
            background: 'rgba(6,182,212,0.08)',
            border: '2px solid rgba(6,182,212,0.2)',
          }}
        >
          <Film size={40} className="text-neo-cyan" />
        </div>

        <h1
          className="text-8xl font-black mb-4"
          style={{
            background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          404
        </h1>

        <h2 className="text-2xl font-bold text-neo-text-primary mb-3">Page Not Found</h2>
        <p className="text-neo-text-secondary mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300 hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
            color: 'white',
            boxShadow: '0 0 20px rgba(6,182,212,0.3)',
          }}
        >
          <Home size={18} />
          Back to Home
        </Link>
      </div>
    </div>
  );
}
