import { cn } from "@/lib/cn";

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/**
 * Avatar with an initials fallback. Images are only rendered when a real URL is
 * supplied; there is no generic placeholder photo.
 */
export function Avatar({
  name,
  src,
  className,
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  const shared = cn(
    "inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800",
    className,
  );
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- remote profile hosts are not configured yet
    return <img src={src} alt={`${name} profile photo`} className={cn(shared, "object-cover")} />;
  }
  return (
    <span className={shared} role="img" aria-label={name}>
      {initialsOf(name)}
    </span>
  );
}
