globalThis.WebSocket = class {};
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ufjbbwqaztgkqmpdmcyv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function seed() {
  console.log("Seeding Supabase database tables...");

  const customersData = [
    {
      customer_name: 'Aurora Blue Group',
      npwp: '01.345.890.1',
      branch: 'Jakarta',
      active_status: true,
      credit_limit: 5000000000,
      payment_accuracy: 94.2,
      dso_days: 21.0,
      pic_name: 'Hendrawan Kusuma',
      pic_phone: '+62 21 5082 1199',
      finance_email: 'siska@aurorablue.co.id',
    },
    {
      customer_name: 'PT Samudera Perkasa',
      npwp: '02.482.910.4',
      branch: 'Semarang',
      active_status: true,
      credit_limit: 2500000000,
      payment_accuracy: 91.5,
      dso_days: 24.0,
      pic_name: 'Budi Raharjo',
      pic_phone: '+62 24 8491 2233',
      finance_email: 'finance@samuderaperkasa.co.id',
    },
    {
      customer_name: 'Logistik Nusantara Bahari',
      npwp: '03.119.405.8',
      branch: 'Surabaya',
      active_status: true,
      credit_limit: 3000000000,
      payment_accuracy: 89.0,
      dso_days: 27.0,
      pic_name: 'Siti Rahmawati',
      pic_phone: '+62 31 7733 9922',
      finance_email: 'finance@logistiknusantara.co.id',
    },
    {
      customer_name: 'Khatulistiwa Express',
      npwp: '04.882.109.3',
      branch: 'Balikpapan',
      active_status: true,
      credit_limit: 2000000000,
      payment_accuracy: 95.0,
      dso_days: 19.0,
      pic_name: 'Agus Setiawan',
      pic_phone: '+62 542 811 902',
      finance_email: 'finance@khatulistiwa.co.id',
    },
    {
      customer_name: 'Maju Tirta Cargo',
      npwp: '05.901.228.7',
      branch: 'Jakarta',
      active_status: true,
      credit_limit: 1800000000,
      payment_accuracy: 92.8,
      dso_days: 22.0,
      pic_name: 'Rian Hidayat',
      pic_phone: '+62 21 4390 1122',
      finance_email: 'finance@majutirta.co.id',
    },
  ];

  const { data: insertedCustomers, error: custErr } = await supabase
    .from('customer')
    .upsert(customersData, { onConflict: 'customer_name' })
    .select();

  if (custErr) {
    console.error("Error inserting customer data:", custErr.message);
    return;
  }
  console.log(`Successfully seeded ${insertedCustomers.length} customers.`);

  // Seed invoices for first customer (Aurora Blue Group)
  const aurora = insertedCustomers.find(c => c.customer_name === 'Aurora Blue Group');
  if (aurora) {
    const invoicesData = [
      {
        customer_id: aurora.customer_id,
        invoice_number: 'INV-2026/07-9004',
        bl_number: 'BL-JKT-26-701D',
        description: 'Freight 2x40ft FCL Dry JKT - SUB',
        due_date: '2026-08-02',
        amount: 485000000,
        payment_status: 'PARTIAL',
        bulk_close_status: 'PENDING',
      },
      {
        customer_id: aurora.customer_id,
        invoice_number: 'INV-2026/07-9102',
        bl_number: 'BL-BPN-26-4412',
        description: 'Handling & Heavy Cargo Haulage JKT - BPN',
        due_date: '2026-08-10',
        amount: 212000000,
        payment_status: 'UNPAID',
        bulk_close_status: 'PENDING',
      },
      {
        customer_id: aurora.customer_id,
        invoice_number: 'INV-2026/07-9201',
        bl_number: 'BL-JKT-26-8819',
        description: 'Freight 40ft Reefer JKT - SUB (KM Meratus Deli)',
        due_date: '2026-08-14',
        amount: 385000000,
        payment_status: 'UNPAID',
        bulk_close_status: 'PENDING',
      },
    ];

    const { error: invErr } = await supabase
      .from('invoice_detail')
      .upsert(invoicesData, { onConflict: 'invoice_number' });

    if (invErr) {
      console.error("Error inserting invoice data:", invErr.message);
    } else {
      console.log("Successfully seeded invoice_detail table.");
    }
  }
}

seed();
