import OverdueInvoiceEditView from "@/components/OverdueInvoiceEditView";

type PageProps = {
  params: Promise<{ invoiceId: string }>;
};

export default async function OverdueInvoiceEditPage({ params }: PageProps) {
  const { invoiceId } = await params;
  const decodedInvoiceId = decodeURIComponent(invoiceId || "");
  return <OverdueInvoiceEditView invoiceId={decodedInvoiceId} />;
}

