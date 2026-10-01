globalThis.WebSocket = class {};
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ufjbbwqaztgkqmpdmcyv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmamJid3FhenRna3FtcGRtY3l2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDAzMTM2NywiZXhwIjoyMTA1NjA3MzY3fQ.qbUVYCttTseHC_9v1hEY9dTh75E3hDtx5DuYw2hqdXQ';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function seedC1Overdue() {
  console.log("Seeding c1_overdue_alert and c1_assignment...");

  const mockAlerts = [
    {
      invoice_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      customer_id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
      due_date: '2026-07-15',
      evaluation_date: '2026-09-28',
      days_overdue: 75,
      overdue_alert: true,
      alert_status: 'LEGAL ESCALATION',
    },
    {
      invoice_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
      customer_id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02',
      due_date: '2026-07-22',
      evaluation_date: '2026-09-28',
      days_overdue: 68,
      overdue_alert: true,
      alert_status: 'HIGH RISK',
    },
    {
      invoice_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
      customer_id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03',
      due_date: '2026-08-05',
      evaluation_date: '2026-09-28',
      days_overdue: 54,
      overdue_alert: true,
      alert_status: 'WATCHLIST',
    },
    {
      invoice_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14',
      customer_id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04',
      due_date: '2026-08-12',
      evaluation_date: '2026-09-28',
      days_overdue: 47,
      overdue_alert: true,
      alert_status: 'HIGH RISK',
    },
    {
      invoice_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15',
      customer_id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05',
      due_date: '2026-08-20',
      evaluation_date: '2026-09-28',
      days_overdue: 39,
      overdue_alert: true,
      alert_status: 'WATCHLIST',
    },
    {
      invoice_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16',
      customer_id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a06',
      due_date: '2026-08-25',
      evaluation_date: '2026-09-28',
      days_overdue: 34,
      overdue_alert: true,
      alert_status: 'NEGOSIASI',
    },
  ];

  const { data: insertedAlerts, error: errAlerts } = await supabase
    .from('c1_overdue_alert')
    .upsert(mockAlerts, { onConflict: 'invoice_id' })
    .select();

  if (errAlerts) {
    console.error("Error inserting c1_overdue_alert:", errAlerts.message);
  } else {
    console.log(`Successfully seeded ${insertedAlerts.length} overdue alerts into c1_overdue_alert.`);
  }

  // Seed initial assignment
  const mockAssignments = [
    {
      invoice_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      assigned_to: 'Hendra K.',
      assigned_by: 'System Manager',
      notes: 'SP-2 dikirim via email & e-faktur portal.',
      follow_up_status: 'SP-2',
    },
    {
      invoice_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
      assigned_to: 'Deni S.',
      assigned_by: 'System Manager',
      notes: 'Audit jadwal pembayaran.',
      follow_up_status: 'AUDIT',
    },
    {
      invoice_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14',
      assigned_to: 'Agus W.',
      assigned_by: 'System Manager',
      notes: 'SP-1 dikirim.',
      follow_up_status: 'SP-1',
    },
    {
      invoice_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16',
      assigned_to: 'Hendra K.',
      assigned_by: 'System Manager',
      notes: 'Termin khusus 45 hari disepakati.',
      follow_up_status: 'TERMIN',
    },
  ];

  const { data: insertedAssign, error: errAssign } = await supabase
    .from('c1_assignment')
    .insert(mockAssignments);

  if (errAssign) {
    console.error("Error inserting c1_assignment:", errAssign.message);
  } else {
    console.log(`Successfully seeded initial assignments into c1_assignment.`);
  }
}

seedC1Overdue();
