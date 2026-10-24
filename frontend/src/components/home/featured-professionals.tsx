import { UserSearch } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/section-heading";
import { ProfessionalCard } from "@/components/professional/professional-card";
import { searchWorkers } from "@/lib/discovery";

/** Newest published professionals, straight from the directory API. */
export async function FeaturedProfessionals() {
  let workers: Awaited<ReturnType<typeof searchWorkers>>["workers"] = [];
  try {
    workers = (await searchWorkers({ sort: "newest", page: 1 }, 3)).workers;
  } catch {
    workers = [];
  }

  return (
    <section aria-labelledby="featured-heading" className="section-y">
      <div className="container-page">
        <SectionHeading
          id="featured-heading"
          eyebrow="Professionals"
          title="Recently listed professionals"
          description="Approved professionals who chose to publish their profile."
          action={
            workers.length > 0 ? (
              <LinkButton href="/workers" variant="secondary">
                Browse all professionals
              </LinkButton>
            ) : undefined
          }
        />
        <div className="mt-10">
          {workers.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {workers.map((pro) => (
                <li key={pro.id}>
                  <ProfessionalCard pro={pro} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={UserSearch}
              title="No professionals are listed yet"
              action={
                <LinkButton href="/become-a-worker" variant="secondary">
                  Learn about joining as a professional
                </LinkButton>
              }
            >
              No professionals have published a profile yet. We are not showing sample ratings or
              profiles. They will appear here once they complete a profile, a reviewer approves it,
              and they publish it.
            </EmptyState>
          )}
        </div>
      </div>
    </section>
  );
}
