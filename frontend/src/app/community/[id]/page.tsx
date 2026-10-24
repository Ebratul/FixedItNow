import type { Metadata } from "next";
import { Suspense } from "react";
import { PostView } from "@/components/community/post-view";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Community post", robots: { index: false } };

export default function PostPage({ params }: PageProps<"/community/[id]">) {
  return (
    <div className="container-page section-y">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Community", href: "/community" }, { label: "Post" }]} />
      <div className="mt-6 max-w-3xl">
        <Suspense fallback={<Skeleton className="h-64" />}>
          <Detail params={params} />
        </Suspense>
      </div>
    </div>
  );
}

async function Detail({ params }: Pick<PageProps<"/community/[id]">, "params">) {
  const { id } = await params;
  return <PostView id={id} />;
}
