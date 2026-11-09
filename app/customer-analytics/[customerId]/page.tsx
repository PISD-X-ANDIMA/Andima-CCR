import CustomerAnalyticsDetail from "@/components/CustomerAnalyticsDetail";

type PageProps = {
  params: Promise<{ customerId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CustomerAnalyticsDetailPage({ params, searchParams }: PageProps) {
  const [{ customerId }, query] = await Promise.all([params, searchParams]);
  const requestedReturnTo = typeof query.returnTo === "string" ? query.returnTo : "/customer-analytics";
  const returnTo = requestedReturnTo.startsWith("/customer-analytics") ? requestedReturnTo : "/customer-analytics";
  return <CustomerAnalyticsDetail customerId={customerId} returnTo={returnTo} />;
}
