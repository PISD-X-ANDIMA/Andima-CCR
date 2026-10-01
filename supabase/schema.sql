-- =============================================================================
-- DATABASE SCHEMA: Customer Breakdown & Payment Cycle (AG-2709-003)
-- Parent Traceability: US-2609-008 | FR-2709-003 | TR-2709-003
-- Engine: Supabase PostgreSQL / Prisma
-- =============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Table Customer
-- Stores master customer account details and regional branch office.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer (
    customer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name VARCHAR(255) NOT NULL,
    npwp VARCHAR(50),
    branch VARCHAR(100) NOT NULL CHECK (branch IN ('Jakarta', 'Semarang', 'Surabaya', 'Balikpapan', 'Medan')),
    active_status BOOLEAN DEFAULT true NOT NULL,
    credit_limit NUMERIC(15, 2) DEFAULT 1000000000.00 NOT NULL,
    payment_accuracy NUMERIC(5, 2) DEFAULT 90.00 NOT NULL, -- e.g. 94.20%
    dso_days NUMERIC(5, 1) DEFAULT 25.0 NOT NULL,
    pic_name VARCHAR(150),
    pic_phone VARCHAR(50),
    finance_email VARCHAR(150),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. Table Customer Monthly Metrics
-- Stores monthly breakdown of revenue, cost, sales_profit, and total_outstanding
-- for 3-month consecutive trend analysis (FR-CCR-003-02 & FR-CCR-003-03).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_monthly_metrics (
    metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customer(customer_id) ON DELETE CASCADE,
    period_month DATE NOT NULL, -- Format YYYY-MM-01
    revenue NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    cost NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    sales_profit NUMERIC(15, 2) GENERATED ALWAYS AS (revenue - cost) STORED,
    total_outstanding NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_customer_period UNIQUE (customer_id, period_month)
);

-- -----------------------------------------------------------------------------
-- 3. Table Invoice Detail
-- Stores invoice line items, due dates, payment status, and bulk close status (FR-CCR-003-05).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_detail (
    invoice_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customer(customer_id) ON DELETE CASCADE,
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    bl_number VARCHAR(100),
    description TEXT,
    due_date DATE NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    payment_status VARCHAR(50) DEFAULT 'UNPAID' NOT NULL CHECK (payment_status IN ('PAID', 'UNPAID', 'PARTIAL')),
    bulk_close_status VARCHAR(50) DEFAULT 'PENDING' NOT NULL CHECK (bulk_close_status IN ('PENDING', 'CLOSED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Indexing for Performance Optimization
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_customer_branch ON public.customer(branch);
CREATE INDEX IF NOT EXISTS idx_metrics_period ON public.customer_monthly_metrics(period_month);
CREATE INDEX IF NOT EXISTS idx_invoice_customer_status ON public.invoice_detail(customer_id, bulk_close_status);

-- -----------------------------------------------------------------------------
-- Row Level Security (RLS) Policies (TR-2709-003)
-- -----------------------------------------------------------------------------
ALTER TABLE public.customer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_monthly_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_detail ENABLE ROW LEVEL SECURITY;

-- Select policy for authenticated users
CREATE POLICY "Allow authenticated read on customer"
    ON public.customer FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated read on customer_monthly_metrics"
    ON public.customer_monthly_metrics FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated read on invoice_detail"
    ON public.invoice_detail FOR SELECT
    TO authenticated
    USING (true);

-- Update policy for bulk close pending invoices
CREATE POLICY "Allow authenticated update on invoice_detail"
    ON public.invoice_detail FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
