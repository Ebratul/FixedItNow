import { UserSearch } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/section-heading";
import { ProfessionalCard } from "@/components/professional/professional-card";
import { getFeaturedProfessionals } from "@/lib/professionals";

export async function FeaturedProfessionals() {
  const professionals = await getFeaturedProfessionals();

  return (
    <section aria-labelledby="featured-heading" className="section-y">
      <div className="container-page">
        <SectionHeading
          id="featured-heading"
          eyebrow="Professionals"
          title="Featured professionals"
          description="Real profiles with their verification status, ratings, and pricing will appear here."
        />
        <div className="mt-10">
          {professionals.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {professionals.map((pro) => (
                <li key={pro.id}>
                  <ProfessionalCard pro={pro} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={UserSearch}
              title="Professional profiles are coming soon"
              action={
                <LinkButton href="/become-a-worker" variant="secondary">
                  Learn about joining as a professional
                </LinkButton>
              }
            >
              We are not showing sample ratings or profiles. Verified
              professionals will be listed here once workers have joined and
              been reviewed.
            </EmptyState>
          )}
        </div>
      </div>
    </section>
  );
}
