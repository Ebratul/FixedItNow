import { Badge, type BadgeTone } from "@/components/ui/badge";

/** Human label + tone for a machine status. Unknown values still render (never crash on new enum values). */
export function StatusBadge({ value, map }: { value: string; map: Record<string, { label: string; tone: BadgeTone }> }) {
  const entry = map[value] ?? { label: value.toLowerCase().replaceAll("_", " "), tone: "neutral" as BadgeTone };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}
