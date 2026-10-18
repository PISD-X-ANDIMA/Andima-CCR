'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { trackActivity } from '@/query/activity';

export default function ActivityTracker() {
  const pathname = usePathname();
  const lastVisit = useRef<string | null>(null);

  useEffect(() => {
    let disposed = false;
    void supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) { console.error('Gagal membaca sesi ActivityTracker.'); return; }
      if (disposed || !session) return;
      const visit = `${session.user.id}:${pathname}`;
      if (lastVisit.current === visit) return;
      lastVisit.current = visit;
      // Path only: query strings can contain tokens or other private data.
      trackActivity('Open', `Membuka halaman ${pathname}`);
    }).catch(() => console.error('Gagal membaca sesi ActivityTracker.'));
    return () => { disposed = true; };
  }, [pathname]);
  return null;
}
