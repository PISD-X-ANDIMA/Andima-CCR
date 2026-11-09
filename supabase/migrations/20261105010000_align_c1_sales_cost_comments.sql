-- Clarify and document that C1 company sales report cost columns store the original report breakdown:
-- trucking_cost          -> Sub Total
-- handling_cost          -> VAT (PPN)
-- storage_cost           -> PPH 23
-- other_operational_cost -> Others + DIP IATA

comment on column public.c1_company_sales_staging_rows.trucking_cost is 'Maps to original sales report Sub Total';
comment on column public.c1_company_sales_staging_rows.handling_cost is 'Maps to original sales report VAT (PPN)';
comment on column public.c1_company_sales_staging_rows.storage_cost is 'Maps to original sales report PPH 23';
comment on column public.c1_company_sales_staging_rows.other_operational_cost is 'Maps to original sales report Others + DIP IATA';

