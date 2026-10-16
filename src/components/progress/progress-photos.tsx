"use client";

import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Columns2, ImageOff, ImagePlus, Loader2, Lock, Trash2, X } from "lucide-react";
import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { compressImage } from "@/lib/image-compress";
import {
  comparePhotos,
  PHOTO_MAX_BYTES,
  PHOTO_NOTE_MAX,
  PHOTO_POSES,
  photoPathFor,
  PROGRESS_PHOTO_BUCKET,
  type PhotoPose,
  type ProgressPhotoView,
} from "@/lib/domain/progress-photos";
import type { UnitSystem } from "@/lib/domain/types";
import { displayWeight, formatWeight, weightUnit } from "@/lib/domain/units";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { cn, titleCase } from "@/lib/utils";
import { deleteProgressPhotoAction, saveProgressPhotoAction } from "@/server/actions/progress-photos";

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
}

function PhotoImage({ photo, className, alt }: { photo: ProgressPhotoView; className?: string; alt: string }) {
  if (!photo.url) {
    return (
      <span className={cn("flex items-center justify-center bg-elevated text-muted-foreground", className)}>
        <ImageOff className="size-6" aria-hidden />
        <span className="sr-only">Image unavailable</span>
      </span>
    );
  }
  // Signed, short-lived URLs to a private bucket — next/image optimisation doesn't apply.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={photo.url} alt={alt} className={className} loading="lazy" decoding="async" />;
}

type Stage = "idle" | "compressing" | "uploading" | "saving";
const STAGE_LABEL: Record<Stage, string> = { idle: "Save photo", compressing: "Preparing…", uploading: "Uploading…", saving: "Saving…" };

function UploadDialog({ open, onOpenChange, userId, units, today }: { open: boolean; onOpenChange: (o: boolean) => void; userId: string; units: UnitSystem; today: string }) {
  const router = useRouter();
  const ids = useId();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [takenOn, setTakenOn] = useState(today);
  const [pose, setPose] = useState<PhotoPose>("front");
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const busy = stage !== "idle";

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const reset = () => {
    setFile(null);
    setTakenOn(today);
    setPose("front");
    setWeight("");
    setNote("");
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return setError("Choose a photo first.");
    setError(null);
    setStage("compressing");
    let blob: Blob;
    try {
      blob = await compressImage(file);
    } catch {
      setStage("idle");
      return setError("Couldn't read that image. Try a JPEG or PNG photo.");
    }
    if (blob.size > PHOTO_MAX_BYTES) {
      setStage("idle");
      return setError("That photo is too large even after compressing. Try a smaller one.");
    }
    setStage("uploading");
    const supabase = getBrowserSupabase();
    const path = photoPathFor(userId, crypto.randomUUID());
    const { error: upErr } = await supabase.storage.from(PROGRESS_PHOTO_BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false, cacheControl: "3600" });
    if (upErr) {
      setStage("idle");
      return setError("Upload failed. Check your connection and try again.");
    }
    setStage("saving");
    const res = await saveProgressPhotoAction({ path, takenOn, pose, note, weight }).catch(() => ({ ok: false as const, error: "You appear to be offline. Please try again." }));
    if (!res.ok) {
      await supabase.storage.from(PROGRESS_PHOTO_BUCKET).remove([path]).catch(() => null);
      setStage("idle");
      return setError(res.error);
    }
    setStage("idle");
    reset();
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (busy) return;
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent side="bottom">
        <DialogHeader>
          <DialogTitle>Add progress photo</DialogTitle>
          <DialogDescription>Only you can see your photos. They&apos;re resized on this device before upload and location data is removed.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <input
              id={`${ids}-file`}
              type="file"
              accept="image/*"
              className="peer sr-only"
              disabled={busy}
              onChange={(e) => {
                setError(null);
                setFile(e.target.files?.[0] ?? null);
              }}
            />
            <label
              htmlFor={`${ids}-file`}
              className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed border-gold-muted/60 bg-elevated/60 p-3 text-center text-sm text-muted-foreground transition-colors hover:border-gold peer-focus-visible:ring-2 peer-focus-visible:ring-gold-highlight"
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Selected photo preview" className="max-h-56 rounded-xl object-contain" />
              ) : (
                <>
                  <ImagePlus className="size-7 text-gold" aria-hidden />
                  <span className="font-semibold text-foreground">Take or choose a photo</span>
                  <span className="text-xs">JPEG, PNG or WebP</span>
                </>
              )}
              {preview && <span className="text-xs text-gold-highlight">Tap to change</span>}
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`${ids}-date`}>Date</Label>
              <Input id={`${ids}-date`} type="date" value={takenOn} max={today} required disabled={busy} onChange={(e) => setTakenOn(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${ids}-weight`}>Weight ({weightUnit(units)})</Label>
              <Input
                id={`${ids}-weight`}
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                placeholder="Optional"
                value={weight}
                disabled={busy}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground/90">Pose</legend>
            <div className="grid grid-cols-4 gap-2">
              {PHOTO_POSES.map((p) => (
                <label
                  key={p}
                  className={cn(
                    "flex h-11 cursor-pointer items-center justify-center rounded-xl border text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold-highlight",
                    pose === p ? "border-gold bg-gold/10 text-gold-highlight" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  <input type="radio" name="pose" value={p} checked={pose === p} onChange={() => setPose(p)} disabled={busy} className="sr-only" />
                  {titleCase(p)}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor={`${ids}-note`}>Note</Label>
            <Textarea
              id={`${ids}-note`}
              value={note}
              maxLength={PHOTO_NOTE_MAX}
              placeholder="Optional — how you feel, what changed"
              className="min-h-20"
              disabled={busy}
              onChange={(e) => setNote(e.target.value)}
            />
            <p className="text-right text-xs text-muted-foreground">
              {note.length}/{PHOTO_NOTE_MAX}
            </p>
          </div>
          {!weight && <p className="text-xs text-muted-foreground">Leave weight blank to use your logged bodyweight for that day, if any.</p>}
          {error && (
            <p role="alert" className="text-sm text-[#f08a8a]">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy || !file} aria-busy={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {STAGE_LABEL[stage]}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ViewerDialog({ photo, units, onClose }: { photo: ProgressPhotoView | null; units: UnitSystem; onClose: () => void }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const remove = () => {
    if (!photo) return;
    setError(null);
    start(async () => {
      const res = await deleteProgressPhotoAction(photo.id).catch(() => ({ ok: false as const, error: "You appear to be offline. Please try again." }));
      if (!res.ok) return setError(res.error);
      setConfirmOpen(false);
      onClose();
      router.refresh();
    });
  };

  return (
    <>
      <Dialog
        open={Boolean(photo)}
        onOpenChange={(o) => {
          if (!o) {
            setError(null);
            onClose();
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          {photo && (
            <>
              <DialogHeader>
                <DialogTitle>{formatDate(photo.takenOn)}</DialogTitle>
                <DialogDescription>
                  {titleCase(photo.pose)} pose{photo.weightKg != null ? ` · ${formatWeight(photo.weightKg, units)}` : ""}
                </DialogDescription>
              </DialogHeader>
              <PhotoImage photo={photo} alt={`Progress photo, ${photo.pose} pose, ${formatDate(photo.takenOn)}`} className="max-h-[65dvh] min-h-48 w-full rounded-xl bg-black object-contain" />
              {photo.note && <p className="mt-3 whitespace-pre-wrap text-sm">{photo.note}</p>}
              {error && (
                <p role="alert" className="mt-3 text-sm text-[#f08a8a]">
                  {error}
                </p>
              )}
              <div className="mt-4 flex justify-end">
                <Button variant="ghost" className="text-[#f08a8a]" onClick={() => setConfirmOpen(true)}>
                  <Trash2 aria-hidden /> Delete photo
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={confirmOpen} onOpenChange={(o) => !pending && setConfirmOpen(o)}>
        <DialogContent role="alertdialog" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this photo?</DialogTitle>
            <DialogDescription>It will be permanently removed. This can&apos;t be undone.</DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="mb-3 text-sm text-[#f08a8a]">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button variant="destructive" onClick={remove} disabled={pending} aria-busy={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CompareDialog({ pair, units, onClose }: { pair: [ProgressPhotoView, ProgressPhotoView] | null; units: UnitSystem; onClose: () => void }) {
  const cmp = pair ? comparePhotos(pair[0], pair[1]) : null;
  const delta = cmp?.weightDeltaKg;
  return (
    <Dialog open={Boolean(cmp)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        {cmp && (
          <>
            <DialogHeader>
              <DialogTitle>Before &amp; after</DialogTitle>
              <DialogDescription>
                {cmp.days === 0 ? "Same day" : `${cmp.days} day${cmp.days === 1 ? "" : "s"} apart`}
                {delta != null &&
                  ` · ${delta === 0 ? "no weight change" : `${delta > 0 ? "+" : "−"}${displayWeight(Math.abs(delta), units)} ${weightUnit(units)}`}`}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              {(
                [
                  ["Before", cmp.before],
                  ["After", cmp.after],
                ] as const
              ).map(([label, p]) => (
                <figure key={label} className="space-y-2">
                  <PhotoImage photo={p} alt={`${label}: ${p.pose} pose, ${formatDate(p.takenOn)}`} className="aspect-[3/4] w-full rounded-xl bg-black object-contain" />
                  <figcaption className="text-center text-xs sm:text-sm">
                    <span className="block font-semibold uppercase tracking-wider text-gold-highlight">{label}</span>
                    <span className="block text-muted-foreground">{formatDate(p.takenOn)}</span>
                    <span className="block text-muted-foreground">{p.weightKg != null ? formatWeight(p.weightKg, units) : "No weight"}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
            {delta == null && <p className="mt-3 text-center text-xs text-muted-foreground">Add a weight to both photos (or log bodyweight on those days) to see the change.</p>}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ProgressPhotos({ photos, userId, units, today }: { photos: ProgressPhotoView[]; userId: string; units: UnitSystem; today: string }) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const byId = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const viewing = viewingId ? (byId.get(viewingId) ?? null) : null;
  const pairPhotos = selected.map((id) => byId.get(id)).filter((p): p is ProgressPhotoView => Boolean(p));
  const pair = compareOpen && pairPhotos.length === 2 ? ([pairPhotos[0]!, pairPhotos[1]!] as [ProgressPhotoView, ProgressPhotoView]) : null;

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 2 ? [s[1]!, id] : [...s, id]));

  const exitCompare = () => {
    setComparing(false);
    setSelected([]);
  };

  return (
    <section id="photos" className="scroll-mt-24" aria-labelledby="photos-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="photos-title" className="flex items-center gap-2 font-display text-2xl font-bold uppercase">
            <Camera className="size-5 text-gold" aria-hidden /> Progress photos
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5 text-gold" aria-hidden /> Only you can see your photos.
          </p>
        </div>
        <div className="flex gap-2">
          {photos.length >= 2 && !comparing && (
            <Button variant="secondary" onClick={() => setComparing(true)}>
              <Columns2 aria-hidden /> Compare
            </Button>
          )}
          {!comparing && (
            <Button onClick={() => setUploadOpen(true)}>
              <ImagePlus aria-hidden /> Add photo
            </Button>
          )}
        </div>
      </div>

      {comparing && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gold-muted/60 bg-gold/5 p-3" role="status">
          <p className="text-sm">
            Select two photos to compare <span className="text-muted-foreground">({selected.length}/2)</span>
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={exitCompare}>
              <X aria-hidden /> Cancel
            </Button>
            <Button onClick={() => setCompareOpen(true)} disabled={pairPhotos.length !== 2}>
              <Columns2 aria-hidden /> Compare
            </Button>
          </div>
        </div>
      )}

      {photos.length ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {photos.map((p) => {
            const order = selected.indexOf(p.id);
            const isSelected = order >= 0;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => (comparing ? toggle(p.id) : setViewingId(p.id))}
                  aria-pressed={comparing ? isSelected : undefined}
                  aria-label={`${comparing ? (isSelected ? "Deselect" : "Select") : "View"} ${p.pose} photo from ${formatDate(p.takenOn)}`}
                  className={cn(
                    "group relative block aspect-[3/4] w-full overflow-hidden rounded-xl border bg-elevated transition-[border-color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-highlight active:scale-[0.98]",
                    isSelected ? "border-gold ring-2 ring-gold" : "border-border hover:border-gold-muted",
                  )}
                >
                  <PhotoImage photo={p} alt="" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-5 text-left text-[11px] leading-tight text-white">
                    <span className="block font-semibold">{formatDate(p.takenOn)}</span>
                    <span className="block text-white/70">{titleCase(p.pose)}</span>
                  </span>
                  {comparing && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full border text-xs font-bold",
                        isSelected ? "border-gold bg-gold text-black" : "border-white/70 bg-black/50 text-transparent",
                      )}
                    >
                      {isSelected ? order + 1 : <Check className="size-3" />}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={Camera}
          title="No photos yet"
          description="Photos show change the scale can't. Take one today in good light, same spot, same pose — and again in a few weeks."
          action={
            <Button onClick={() => setUploadOpen(true)}>
              <ImagePlus aria-hidden /> Add your first photo
            </Button>
          }
        />
      )}

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} userId={userId} units={units} today={today} />
      <ViewerDialog photo={viewing} units={units} onClose={() => setViewingId(null)} />
      <CompareDialog pair={pair} units={units} onClose={() => setCompareOpen(false)} />
    </section>
  );
}
