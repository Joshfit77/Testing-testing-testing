import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Where a nutrition value comes from (SPEC §8 "distinguish published values from estimates"):
 * - USDA: the USDA FoodData Central database.
 * - Label: a product label — Open Food Facts (community-entered label data) or a food you entered from its label.
 * - Estimate: typical values (built-in foods) or numbers you marked as your own estimate.
 * - Calculated: a recipe or planner meal, added up from its ingredients' sources.
 */
export type SourceKind = "usda" | "label" | "estimate" | "calculated";

export function sourceKind(source: string | null | undefined, isEstimate: boolean): SourceKind {
  if (source?.startsWith("recipe:") || source?.startsWith("app:")) return isEstimate ? "estimate" : "calculated";
  if (isEstimate) return "estimate";
  if (source?.startsWith("usda:")) return "usda";
  return "label";
}

const INFO: Record<SourceKind, { label: string; title: string; className: string }> = {
  usda: { label: "USDA", title: "Published values from USDA FoodData Central", className: "border-[#2f4f6b] text-[#9cc3e6]" },
  label: { label: "Label", title: "From a product label (Open Food Facts community data or your own entry). Check the package.", className: "border-[#2f5a3d] text-[#8fd3a5]" },
  estimate: { label: "Estimate", title: "Typical values or your own estimate, not a label or database value", className: "border-gold-muted/60 text-gold" },
  calculated: { label: "Calculated", title: "Added up from the ingredients' USDA and label values", className: "border-border text-muted-foreground" },
};

export function SourceBadge({ source, isEstimate, className, detail }: { source: string | null | undefined; isEstimate: boolean; className?: string; detail?: string }) {
  const kind = sourceKind(source, isEstimate);
  const info = INFO[kind];
  const off = source?.startsWith("off:");
  return (
    <Badge variant="outline" className={cn("align-middle font-medium", info.className, className)} title={info.title} data-source-kind={kind}>
      {info.label}
      {off && kind === "label" ? " · Open Food Facts" : ""}
      {detail ? ` · ${detail}` : ""}
    </Badge>
  );
}
