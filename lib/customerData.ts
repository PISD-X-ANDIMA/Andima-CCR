import { CustomerAnalyticsItem, KpiSummary, InvoiceDetail } from '@/types/customer';

export const INITIAL_KPI_SUMMARY: KpiSummary = {
  totalActiveCustomers: 148,
  branchBreakdown: {
    jkt: 62,
    sub: 38,
    smg: 26,
    bpn: 22,
    medan: 14,
  },
  averagePaymentCycle: 24.5,
  paymentCycleDiffVsQ2: -2.1,
  highRiskOutstanding: 4850000,
  highRiskAccountCount: 4,
  highRiskGrowthPercent: 6.4,
  topContributingCustomer: {
    name: 'Aurora Blue',
    rank: 1,
    totalLogisticsVolume: 4200000000,
  },
};

export const INITIAL_CUSTOMERS: CustomerAnalyticsItem[] = [
  {
    id: 'CUST-0192',
    customer_name: 'Aurora Blue Group',
    npwp: '01.345.890.1',
    location_detail: 'PT Aurora Samudera Raya',
    branch: 'Jakarta',
    branch_office_badge: 'Jakarta Pusat',
    sales_profit: 605080000,
    sales_profit_trend: 'up',
    cost: 1259000000,
    total_outstanding: 1082000000,
    credit_limit: 5000000000,
    payment_accuracy: 94.2,
    active_invoices_count: 34,
    dso_trend: {
      may_2026: 26,
      june_2026: 23,
      july_2026: 21,
    },
    pic: {
      name: 'Hendrawan Kusuma',
      phone: '+62 21 5082 1199',
    },
    connected_routes: [
      { route: 'Tanjung Priok - Tanjung Perak', volume: '64 TEUs / bln' },
      { route: 'Tanjung Priok - Kariangau BPN', volume: '42 TEUs / bln' },
      { route: 'Tanjung Emas - Belawan Medan', volume: '28 TEUs / bln' },
    ],
  },
  {
    id: 'CUST-0841',
    customer_name: 'PT Samudera Perkasa',
    npwp: '02.482.910.4',
    location_detail: 'Tanjung Emas',
    branch: 'Semarang',
    branch_office_badge: 'Semarang',
    sales_profit: 350200000,
    sales_profit_trend: 'up',
    cost: 300000000,
    total_outstanding: 500000000,
    credit_limit: 2500000000,
    payment_accuracy: 91.5,
    active_invoices_count: 18,
    dso_trend: {
      may_2026: 28,
      june_2026: 25,
      july_2026: 24,
    },
    pic: {
      name: 'Budi Raharjo',
      phone: '+62 24 8491 2233',
    },
    connected_routes: [
      { route: 'Tanjung Emas - Tanjung Perak', volume: '35 TEUs / bln' },
    ],
  },
  {
    id: 'CUST-1033',
    customer_name: 'Logistik Nusantara Bahari',
    npwp: '03.119.405.8',
    location_detail: 'Perak Port',
    branch: 'Surabaya',
    branch_office_badge: 'Surabaya',
    sales_profit: 350500000,
    sales_profit_trend: 'up',
    cost: 385000000,
    total_outstanding: 500000000,
    credit_limit: 3000000000,
    payment_accuracy: 89.0,
    active_invoices_count: 22,
    dso_trend: {
      may_2026: 31,
      june_2026: 29,
      july_2026: 27,
    },
    pic: {
      name: 'Siti Rahmawati',
      phone: '+62 31 7733 9922',
    },
    connected_routes: [
      { route: 'Tanjung Perak - Kariangau BPN', volume: '50 TEUs / bln' },
    ],
  },
  {
    id: 'CUST-0498',
    customer_name: 'Khatulistiwa Express',
    npwp: '04.882.109.3',
    location_detail: 'Kariangau Terminal',
    branch: 'Balikpapan',
    branch_office_badge: 'Balikpapan',
    sales_profit: 350200000,
    sales_profit_trend: 'up',
    cost: 301000000,
    total_outstanding: 300000000,
    credit_limit: 2000000000,
    payment_accuracy: 95.0,
    active_invoices_count: 14,
    dso_trend: {
      may_2026: 22,
      june_2026: 20,
      july_2026: 19,
    },
    pic: {
      name: 'Agus Setiawan',
      phone: '+62 542 811 902',
    },
    connected_routes: [
      { route: 'Kariangau BPN - Makassar', volume: '20 TEUs / bln' },
    ],
  },
  {
    id: 'CUST-0714',
    customer_name: 'Maju Tirta Cargo',
    npwp: '05.901.228.7',
    location_detail: 'Priok Port',
    branch: 'Jakarta',
    branch_office_badge: 'Jakarta Utara',
    sales_profit: 412000000,
    sales_profit_trend: 'up',
    cost: 390000000,
    total_outstanding: 240000000,
    credit_limit: 1800000000,
    payment_accuracy: 92.8,
    active_invoices_count: 16,
    dso_trend: {
      may_2026: 25,
      june_2026: 24,
      july_2026: 22,
    },
    pic: {
      name: 'Rian Hidayat',
      phone: '+62 21 4390 1122',
    },
    connected_routes: [
      { route: 'Tanjung Priok - Belawan Medan', volume: '30 TEUs / bln' },
    ],
  },
  {
    id: 'CUST-0912',
    customer_name: 'PT Trans Maritime Logistics',
    npwp: '06.123.456.9',
    location_detail: 'Belawan Port',
    branch: 'Medan',
    branch_office_badge: 'Medan',
    sales_profit: 290000000,
    sales_profit_trend: 'up',
    cost: 260000000,
    total_outstanding: 180000000,
    credit_limit: 1500000000,
    payment_accuracy: 88.4,
    active_invoices_count: 12,
    dso_trend: {
      may_2026: 30,
      june_2026: 28,
      july_2026: 26,
    },
    pic: {
      name: 'Dewi Melati',
      phone: '+62 61 451 9023',
    },
    connected_routes: [
      { route: 'Belawan Medan - Tanjung Priok', volume: '25 TEUs / bln' },
    ],
  },
  {
    id: 'CUST-0553',
    customer_name: 'Pacific Freight Indonesia',
    npwp: '07.331.442.0',
    location_detail: 'Tanjung Perak',
    branch: 'Surabaya',
    branch_office_badge: 'Surabaya',
    sales_profit: 480000000,
    sales_profit_trend: 'up',
    cost: 410000000,
    total_outstanding: 620000000,
    credit_limit: 3500000000,
    payment_accuracy: 96.1,
    active_invoices_count: 28,
    dso_trend: {
      may_2026: 24,
      june_2026: 22,
      july_2026: 20,
    },
    pic: {
      name: 'Eko Prasetyo',
      phone: '+62 31 5590 8821',
    },
    connected_routes: [
      { route: 'Tanjung Perak - Bitung', volume: '40 TEUs / bln' },
    ],
  },
  {
    id: 'CUST-0331',
    customer_name: 'Borneo Inter Ocean',
    npwp: '08.991.023.4',
    location_detail: 'Kariangau Hub',
    branch: 'Balikpapan',
    branch_office_badge: 'Balikpapan',
    sales_profit: 320000000,
    sales_profit_trend: 'down',
    cost: 290000000,
    total_outstanding: 410000000,
    credit_limit: 2200000000,
    payment_accuracy: 87.2,
    active_invoices_count: 15,
    dso_trend: {
      may_2026: 33,
      june_2026: 32,
      july_2026: 31,
    },
    pic: {
      name: 'Surya Kencana',
      phone: '+62 542 770 192',
    },
    connected_routes: [
      { route: 'Kariangau BPN - Surabaya', volume: '32 TEUs / bln' },
    ],
  }
];

// Generate 43 more items to reach 51 active client entities dynamically
const BRANCH_LIST: Array<'Jakarta' | 'Semarang' | 'Surabaya' | 'Balikpapan' | 'Medan'> = [
  'Jakarta', 'Semarang', 'Surabaya', 'Balikpapan', 'Medan'
];

for (let i = 9; i <= 51; i++) {
  const padId = String(i).padStart(4, '0');
  const branch = BRANCH_LIST[i % BRANCH_LIST.length];
  INITIAL_CUSTOMERS.push({
    id: `CUST-${padId}`,
    customer_name: `PT Enterprise Client ${i}`,
    npwp: `09.${100 + i}.${200 + i}.${i % 9}`,
    location_detail: `${branch} Port Area`,
    branch: branch,
    branch_office_badge: branch,
    sales_profit: 150000000 + (i * 7000000),
    sales_profit_trend: i % 3 === 0 ? 'down' : 'up',
    cost: 120000000 + (i * 6000000),
    total_outstanding: 100000000 + (i * 8000000),
    credit_limit: 1000000000 + (i * 50000000),
    payment_accuracy: Number((85 + (i % 14) + 0.3).toFixed(1)),
    active_invoices_count: 5 + (i % 15),
    dso_trend: {
      may_2026: 30 - (i % 5),
      june_2026: 28 - (i % 5),
      july_2026: 25 - (i % 5),
    },
    pic: {
      name: `Account Executive ${i}`,
      phone: `+62 812 ${1000 + i} ${2000 + i}`,
    },
    connected_routes: [
      { route: `${branch} - Regional Hub`, volume: `${20 + (i % 30)} TEUs / bln` }
    ],
  });
}

// Invoices for Aurora Blue Group (CUST-0192) matching Image 2 exact transaction ledger
export const AURORA_BLUE_INVOICES: InvoiceDetail[] = [
  {
    invoice_id: 'inv-001',
    customer_id: 'CUST-0192',
    invoice_number: 'INV-2026/07-9004',
    bl_number: 'BL-JKT-26-701D',
    description: 'Freight 2x40ft FCL Dry JKT - SUB',
    due_date: '2026-08-02',
    amount: 485000000,
    payment_status: 'PARTIAL',
    bulk_close_status: 'PENDING',
  },
  {
    invoice_id: 'inv-002',
    customer_id: 'CUST-0192',
    invoice_number: 'INV-2026/07-9102',
    bl_number: 'BL-BPN-26-4412',
    description: 'Handling & Heavy Cargo Haulage JKT - BPN',
    due_date: '2026-08-10',
    amount: 212000000,
    payment_status: 'UNPAID',
    bulk_close_status: 'PENDING',
  },
  {
    invoice_id: 'inv-003',
    customer_id: 'CUST-0192',
    invoice_number: 'INV-2026/07-9201',
    bl_number: 'BL-JKT-26-8819',
    description: 'Freight 40ft Reefer JKT - SUB (KM Meratus Deli)',
    due_date: '2026-08-14',
    amount: 385000000,
    payment_status: 'UNPAID',
    bulk_close_status: 'PENDING',
  },
  {
    invoice_id: 'inv-004',
    customer_id: 'CUST-0192',
    invoice_number: 'INV-2026/06-8910',
    bl_number: 'BL-JKT-26-5510',
    description: 'Inland Transport & Port Handling Surabaya',
    due_date: '2026-07-25',
    amount: 250000000,
    payment_status: 'PAID',
    bulk_close_status: 'CLOSED',
  },
  {
    invoice_id: 'inv-005',
    customer_id: 'CUST-0192',
    invoice_number: 'INV-2026/06-8802',
    bl_number: 'BL-JKT-26-4402',
    description: 'Multimodal Ocean Freight JKT - BPN',
    due_date: '2026-07-08',
    amount: 450000000,
    payment_status: 'PAID',
    bulk_close_status: 'CLOSED',
  }
];


