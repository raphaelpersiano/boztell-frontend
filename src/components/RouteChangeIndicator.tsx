'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export function RouteChangeIndicator() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleStart = () => setLoading(true);
    const handleComplete = () => setLoading(false);

    // Show loading for a brief moment during route changes
    handleStart();
    const timer = setTimeout(handleComplete, 100);

    return () => clearTimeout(timer);
  }, [pathname]);

  if (!loading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="h-0.5 bg-blue-600 animate-pulse" 
           style={{
             width: '100%',
             background: 'linear-gradient(90deg, transparent, #2563eb, transparent)',
             animation: 'loading 1s ease-in-out infinite'
           }}
      />
      <style jsx>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}