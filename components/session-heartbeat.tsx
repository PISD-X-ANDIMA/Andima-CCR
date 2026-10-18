'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const HEARTBEAT_INTERVAL_MS = 20_000;

export default function SessionHeartbeat() {
  useEffect(() => {
    let stopped = false;
    let sending = false;

    const sendHeartbeat = async () => {
      if (stopped || sending) return;
      sending = true;

      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session || stopped) return;

        const response = await fetch('/api/login-log/heartbeat', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store',
        });

        if (!response.ok) {
          console.error('Gagal memperbarui heartbeat Log Login:', response.status);
        }
      } catch {
        console.error('Gagal mengirim heartbeat Log Login.');
      } finally {
        sending = false;
      }
    };

    void sendHeartbeat();
    const interval = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    window.addEventListener('focus', sendHeartbeat);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', sendHeartbeat);
    };
  }, []);

  return null;
}
