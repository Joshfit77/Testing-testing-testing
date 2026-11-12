import type { SupabaseClient } from "@supabase/supabase-js";
import { logError } from "@/server/log";

/**
 * The member's own things, for the unified search: completed workouts, saved meals, recipes and custom foods, and
 * prayer-journal entries. Every query goes through the member's own Supabase client (row-level security) AND names
 * the member's id, so a tampered id finds nothing that isn't theirs (tests/integration/personal-search.test.ts).
 * Journal hits carry the title, date and theme only: the prayer text itself stays on the entry's own screen.
 */
export interface PersonalHit {
  href: string;
  title: string;
  body?: string;
}
export interface PersonalResults {
  workouts: PersonalHit[];
  meals: PersonalHit[];
  journal: PersonalHit[];
}

/** `%query%` for ilike, with the pattern characters escaped so a member's "100%" is searched for literally. */
export function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

const LIMIT = 5;

function when(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone });
  } catch {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
}

const THEME_LABEL: Record<string, string> = { perseverance: "Perseverance", humility: "Humility", discipline: "Discipline", self_control: "Self-control", stewardship: "Stewardship", gratitude: "Gratitude", other: "" };

export async function searchPersonal(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  opts: { nutritionTools: boolean; timeZone?: string },
): Promise<PersonalResults> {
  const q = query.trim().slice(0, 80);
  const out: PersonalResults = { workouts: [], meals: [], journal: [] };
  if (q.length < 2) return out;
  const pat = likePattern(q);
  const tz = opts.timeZone ?? "UTC";

  const workouts = await supabase
    .from("workout_sessions")
    .select("id, name, started_at")
    .eq("user_id", userId)
    .eq("status", "completed")
    .ilike("name", pat)
    .order("started_at", { ascending: false })
    .limit(LIMIT);
  if (workouts.error) logError("search.workouts", workouts.error);
  out.workouts = ((workouts.data ?? []) as { id: string; name: string; started_at: string }[]).map((w) => ({ href: `/train/history/${w.id}`, title: w.name, body: `Workout · ${when(w.started_at, tz)}` }));

  if (opts.nutritionTools) {
    const [meals, recipes, foods] = await Promise.all([
      supabase.from("meals").select("id, name").eq("user_id", userId).eq("is_template", true).ilike("name", pat).order("name").limit(LIMIT),
      supabase.from("recipes").select("id, name").eq("user_id", userId).ilike("name", pat).order("name").limit(LIMIT),
      supabase.from("foods").select("id, name, brand").eq("owner_id", userId).ilike("name", pat).order("name").limit(LIMIT),
    ]);
    if (meals.error) logError("search.meals", meals.error);
    if (recipes.error) logError("search.recipes", recipes.error);
    if (foods.error) logError("search.foods", foods.error);
    out.meals = [
      ...((meals.data ?? []) as { id: string; name: string | null }[]).map((m) => ({ href: "/nutrition/saved-meals", title: m.name ?? "Saved meal", body: "Saved meal · logs again in one step" })),
      ...((recipes.data ?? []) as { id: string; name: string }[]).map((r) => ({ href: `/nutrition/recipes/${r.id}`, title: r.name, body: "Your recipe" })),
      ...((foods.data ?? []) as { id: string; name: string; brand: string | null }[]).map((f) => ({ href: "/nutrition?add=1", title: f.name, body: `Your food${f.brand ? ` · ${f.brand}` : ""} · opens Add food` })),
    ].slice(0, LIMIT * 2);
  }

  // PostgREST's or() filter reads commas, parentheses and quotes as syntax: those are blanks in the pattern.
  const orPat = likePattern(q.replace(/[,()"]/g, " ").trim());
  const journal = await supabase
    .from("faith_journal_entries")
    .select("id, title, entry_date, theme, scripture_ref")
    .eq("user_id", userId)
    .or(`title.ilike."${orPat}",scripture_ref.ilike."${orPat}",body.ilike."${orPat}"`)
    .order("entry_date", { ascending: false })
    .limit(LIMIT);
  if (journal.error) logError("search.journal", journal.error);
  out.journal = ((journal.data ?? []) as { id: string; title: string | null; entry_date: string; theme: string | null; scripture_ref: string | null }[]).map((e) => ({
    href: `/faith/journal/${e.id}`,
    title: e.title?.trim() || "Prayer journal entry",
    body: [when(`${e.entry_date}T12:00:00Z`, "UTC"), e.theme ? THEME_LABEL[e.theme] : "", e.scripture_ref ?? ""].filter(Boolean).join(" · "),
  }));
  return out;
}
