import OverdueInvoiceCreateView from "@/components/OverdueInvoiceCreateView";

type PageProps = {
  params: Promise<{ invoiceId: string }>;
};

export default async function OverdueInvoiceCreatePage({ params }: PageProps) {
  const { invoiceId } = await params;
  const decodedInvoiceId = decodeURIComponent(invoiceId || "");
  return <OverdueInvoiceCreateView invoiceId={decodedInvoiceId} />;
}

