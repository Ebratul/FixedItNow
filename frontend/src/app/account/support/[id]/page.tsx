import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SupportTicketView } from "@/components/support/ticket-view";
import { Skeleton } from "@/components/ui/skeleton";
import { isUuid } from "@/lib/route-params";

export const metadata: Metadata = { title: "Support request", robots: { index: false } };

export default function SupportTicketPage({ params }: PageProps<"/account/support/[id]">) {
  return (
    <div className="container-page section-y">
      <Suspense fallback={<Skeleton className="h-64" />}>
        <Detail params={params} />
      </Suspense>
    </div>
  );
}

async function Detail({ params }: Pick<PageProps<"/account/support/[id]">, "params">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  return <SupportTicketView id={id} />;
}
