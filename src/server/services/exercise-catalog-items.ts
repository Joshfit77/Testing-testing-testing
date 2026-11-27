import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogItem } from "@/components/workout/exercise-picker";

/** Published exercises in the shape the exercise picker uses. */
export async function loadCatalogItems(supabase: SupabaseClient): Promise<CatalogItem[]> {
  const { data } = await supabase.from("exercises").select("id, slug, name, is_timed, category, primary_muscles").eq("is_published", true).order("name");
  return (data ?? []).map((e) => ({
    id: e.id as string,
    slug: e.slug as string,
    name: e.name as string,
    isTimed: e.is_timed as boolean,
    category: e.category as string,
    primary: e.primary_muscles as string[],
  }));
}
