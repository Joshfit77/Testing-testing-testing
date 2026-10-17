import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, Lightbulb, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EQUIPMENT_LABELS, type Equipment } from "@/lib/domain/types";
import type { ExerciseRow } from "@/lib/types/db";
import { titleCase } from "@/lib/utils";
import { getServerSupabase } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { formVideoSearchUrl, videoEmbedUrl } from "@/lib/media";
import { exerciseMediaPublicUrl } from "@/lib/exercise-media";
import { DemoVideo } from "@/components/train/demo-video";
import { requireOnboardedUser } from "@/server/auth";

export const metadata = { title: "Exercise" };

export default async function ExerciseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const { data } = await supabase.from("exercises").select("*").eq("slug", slug).maybeSingle();
  if (!data) notFound();
  const ex = data as ExerciseRow;
  const [altsRes, mediaRes] = await Promise.all([
    supabase.from("exercise_alternatives").select("alt:exercises!exercise_alternatives_alternative_id_fkey(slug, name, difficulty)").eq("exercise_id", ex.id),
    supabase.from("exercise_media").select("id, media_type, storage_path, external_url, license, attribution, alt_text").eq("exercise_id", ex.id),
  ]);
  const alts = (altsRes.data ?? []).map((a) => a.alt as unknown as { slug: string; name: string; difficulty: string }).filter(Boolean);
  const media = mediaRes.data ?? [];
  const mediaUrl = (m: (typeof media)[number]) =>
    (m.external_url as string | null) ?? exerciseMediaPublicUrl(publicEnv.supabaseUrl, m.storage_path as string);

  return (
    <div className="space-y-6">
      <Link href="/train/exercises" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Exercise library
      </Link>

      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">{titleCase(ex.category)}</p>
        <h1 className="mt-1 font-display text-4xl font-bold uppercase md:text-5xl">{ex.name}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{ex.description}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="secondary">{titleCase(ex.difficulty)}</Badge>
          {ex.mechanics && <Badge variant="outline">{titleCase(ex.mechanics)}</Badge>}
          {ex.is_timed && <Badge variant="outline">Timed</Badge>}
          {ex.low_impact && <Badge variant="success">Low impact</Badge>}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section aria-label="Demonstration media" className="overflow-hidden rounded-2xl border border-border bg-card">
          {media.length ? (
            <div className="space-y-3 p-3">
              {media.map((m) => (
                <figure key={m.id as string}>
                  {m.media_type === "video" && videoEmbedUrl(mediaUrl(m)) ? (
                    <iframe
                      src={videoEmbedUrl(mediaUrl(m))!}
                      title={(m.alt_text as string) || `${ex.name} demonstration`}
                      className="aspect-video w-full rounded-xl"
                      loading="lazy"
                      allow="encrypted-media; picture-in-picture; fullscreen"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  ) : m.media_type === "video" && m.storage_path && !m.external_url ? (
                    <DemoVideo src={mediaUrl(m)} label={(m.alt_text as string) || `${ex.name} demonstration`} />
                  ) : m.media_type === "video" ? (
                    <video src={mediaUrl(m)} controls preload="metadata" playsInline className="w-full rounded-xl" aria-label={(m.alt_text as string) || ex.name} />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl(m)} alt={(m.alt_text as string) || `${ex.name} demonstration`} className="w-full rounded-xl" loading="lazy" />
                  )}
                  <figcaption className="mt-1 text-[11px] text-muted-foreground">
                    License: {m.license as string}
                    {m.attribution ? ` · ${m.attribution as string}` : ""}
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center gap-2 bg-elevated/40 p-6 text-center">
              <PlayCircle className="size-10 text-gold" aria-hidden />
              <p className="text-sm font-semibold">No built-in video for this exercise yet</p>
              <p className="max-w-xs text-xs text-muted-foreground">An admin can add a YouTube, Vimeo or uploaded video. Until then, watch a form video or follow the steps below.</p>
            </div>
          )}
          <div className="border-t border-border p-3">
            <a
              href={formVideoSearchUrl(ex.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gold-muted px-4 text-sm font-semibold text-gold-highlight hover:bg-gold/10"
            >
              <PlayCircle className="size-4" aria-hidden /> Watch form videos <ExternalLink className="size-3.5" aria-hidden />
            </a>
            <p className="mt-1 text-[11px] text-muted-foreground">Opens YouTube search. Videos there are made by other creators.</p>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5" aria-label="Muscles and equipment">
          <h2 className="font-display text-lg font-semibold uppercase">Target muscles</h2>
          <p className="mt-1 text-sm">{ex.primary_muscles.map(titleCase).join(", ")}</p>
          {ex.secondary_muscles.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Also works: {ex.secondary_muscles.map(titleCase).join(", ")}</p>}
          <h2 className="mt-5 font-display text-lg font-semibold uppercase">Equipment</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {ex.equipment.map((e) => (
              <Badge key={e} variant="secondary">
                {EQUIPMENT_LABELS[e as Equipment] ?? titleCase(e)}
              </Badge>
            ))}
          </div>
          {alts.length > 0 && (
            <>
              <h2 className="mt-5 font-display text-lg font-semibold uppercase">Alternatives</h2>
              <ul className="mt-2 space-y-1.5">
                {alts.map((a) => (
                  <li key={a.slug}>
                    <Link href={`/train/exercises/${a.slug}`} className="text-sm text-gold-highlight hover:underline">
                      {a.name}
                    </Link>{" "}
                    <span className="text-xs text-muted-foreground">· {titleCase(a.difficulty)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="how-title">
        <h2 id="how-title" className="font-display text-xl font-bold uppercase">
          How to do it
        </h2>
        <ol className="mt-3 space-y-3">
          {ex.instructions.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gold/15 font-display font-semibold text-gold-highlight">{i + 1}</span>
              <span className="pt-1">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="cues-title">
          <h2 id="cues-title" className="flex items-center gap-2 font-display text-lg font-semibold uppercase">
            <Lightbulb className="size-4 text-gold" aria-hidden /> Form cues
          </h2>
          <ul className="mt-3 space-y-2">
            {ex.form_cues.map((c) => (
              <li key={c} className="flex gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> {c}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="mistakes-title">
          <h2 id="mistakes-title" className="flex items-center gap-2 font-display text-lg font-semibold uppercase">
            <AlertTriangle className="size-4 text-gold" aria-hidden /> Common mistakes
          </h2>
          <ul className="mt-3 space-y-2">
            {ex.common_mistakes.map((c) => (
              <li key={c} className="flex gap-2 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden /> {c}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="text-xs text-muted-foreground">
        General fitness information, not medical advice. Stop if an exercise causes pain and choose an alternative or consult a qualified
        professional.
      </p>
    </div>
  );
}
