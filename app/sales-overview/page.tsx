import HeaderAccount from "@/components/headeraccount";

export default function SalesOverviewPage() {
  return <PlaceholderPage title="Sales Overview" />;
}

function PlaceholderPage({ title }: { title: string }) {
  return <main className="min-h-dvh bg-slate-50"><header className="flex h-16 items-center justify-end border-b border-slate-200 bg-white px-6"><HeaderAccount /></header><h1 className="sr-only">{title}</h1></main>;
}
