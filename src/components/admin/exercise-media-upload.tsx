"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { publicEnv } from "@/lib/env";
import {
  AI_MEDIA_LICENSE,
  EXERCISE_MEDIA_ACCEPT,
  EXERCISE_MEDIA_BUCKET,
  EXERCISE_MEDIA_MAX_BYTES,
  EXERCISE_MEDIA_TYPES,
  extensionForMime,
} from "@/lib/exercise-media";
import { addUploadedExerciseMediaAction, discardExerciseMediaUploadAction } from "@/server/actions/admin";

type Status = { kind: "idle" } | { kind: "uploading"; pct: number } | { kind: "saving" } | { kind: "done"; message: string } | { kind: "error"; message: string };

/** Uploads straight from the browser to Supabase Storage with progress (the storage policy only allows admins). */
function uploadWithProgress(path: string, file: File, accessToken: string, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const encoded = path.split("/").map(encodeURIComponent).join("/");
    xhr.open("POST", `${publicEnv.supabaseUrl}/storage/v1/object/${EXERCISE_MEDIA_BUCKET}/${encoded}`);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("apikey", publicEnv.supabaseAnonKey);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = `Upload failed (HTTP ${xhr.status}).`;
      try {
        const body = JSON.parse(xhr.responseText) as { message?: string; error?: string };
        if (body.message || body.error) message = `Upload failed: ${body.message ?? body.error}`;
      } catch {
        /* non-JSON body */
      }
      if (xhr.status === 403 || /row-level security/i.test(message)) message = "Upload refused — only admins can upload exercise media.";
      if (xhr.status === 413 || /maximum allowed size/i.test(message)) message = "That file is larger than the 50 MB limit.";
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("Upload failed — check your connection."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhr.send(file);
  });
}

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function ExerciseMediaUpload({ exerciseId, slug, exerciseName }: { exerciseId: string; slug: string; exerciseName: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [license, setLicense] = useState("");
  const [attribution, setAttribution] = useState("");
  const [altText, setAltText] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const busy = status.kind === "uploading" || status.kind === "saving";

  const pick = (f: File | null) => {
    setStatus({ kind: "idle" });
    if (!f) return setFile(null);
    const ext = extensionForMime(f.type, f.name);
    if (!ext) {
      setFile(null);
      return setStatus({ kind: "error", message: "Choose an MP4 or WebM video, or a JPEG, PNG or WebP image." });
    }
    if (f.size > EXERCISE_MEDIA_MAX_BYTES) {
      setFile(null);
      return setStatus({ kind: "error", message: `That file is ${formatSize(f.size)} — the limit is 50 MB. Compress or shorten it first.` });
    }
    setFile(f);
    if (!altText) setAltText(`${exerciseName} demonstration`);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return setStatus({ kind: "error", message: "Choose a file to upload." });
    if (!confirm) return setStatus({ kind: "error", message: "Confirm you have the right to use this media." });
    if (license.trim().length < 2) return setStatus({ kind: "error", message: "Enter the license." });
    if (altText.trim().length < 3) return setStatus({ kind: "error", message: "Enter alt text describing the media." });
    const ext = extensionForMime(file.type, file.name);
    if (!ext) return setStatus({ kind: "error", message: "Unsupported file type." });
    // Loaded on demand so the Supabase browser client isn't in the admin page's initial bundle.
    const { getBrowserSupabase } = await import("@/lib/supabase/client");
    const { data } = await getBrowserSupabase().auth.getSession();
    const token = data.session?.access_token;
    if (!token) return setStatus({ kind: "error", message: "Your session expired — sign in again." });

    const path = `${slug}/${crypto.randomUUID()}.${ext}`;
    setStatus({ kind: "uploading", pct: 0 });
    try {
      await uploadWithProgress(path, new File([file], file.name, { type: EXERCISE_MEDIA_TYPES[ext].mime }), token, (pct) => setStatus({ kind: "uploading", pct }));
    } catch (err) {
      return setStatus({ kind: "error", message: (err as Error).message });
    }
    setStatus({ kind: "saving" });
    try {
      const res = await addUploadedExerciseMediaAction({ exerciseId, storagePath: path, license, attribution, altText, confirm });
      if (!res.ok) {
        const details = res.fieldErrors ? ` ${Object.values(res.fieldErrors).join(" ")}` : "";
        // The action removes the file itself when the insert fails; this also covers validation failures.
        await discardExerciseMediaUploadAction({ exerciseId, storagePath: path }).catch(() => undefined);
        return setStatus({ kind: "error", message: `${res.message ?? "Couldn't save the media."}${details}` });
      }
      setStatus({ kind: "done", message: res.message ?? "Media added." });
      setFile(null);
      setConfirm(false);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch {
      setStatus({ kind: "error", message: "The file uploaded but saving the record failed. Refresh and check the list; delete any duplicate." });
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div className="space-y-1">
        <Label htmlFor="upload-file">Video or image file</Label>
        <Input
          ref={fileRef}
          id="upload-file"
          type="file"
          accept={EXERCISE_MEDIA_ACCEPT}
          disabled={busy}
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
          className="h-auto py-2"
        />
        <p className="text-[11px] text-muted-foreground">
          MP4/WebM video or JPEG/PNG/WebP image, up to 50 MB. Short 5–8 s loops work best. Saved to {EXERCISE_MEDIA_BUCKET}/{slug}/.
          {file ? ` Selected: ${file.name} (${formatSize(file.size)}).` : ""}
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="upload-license">License</Label>
            <button type="button" className="text-[11px] text-gold-highlight hover:underline" onClick={() => setLicense(AI_MEDIA_LICENSE)}>
              Use AI-generated license
            </button>
          </div>
          <Input id="upload-license" value={license} onChange={(e) => setLicense(e.target.value)} maxLength={200} placeholder="e.g. Owned / AI-generated, owned by Narrow Gate Fitness" disabled={busy} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="upload-attribution">Attribution (optional)</Label>
          <Input id="upload-attribution" value={attribution} onChange={(e) => setAttribution(e.target.value)} maxLength={200} disabled={busy} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="upload-alt">Alt text</Label>
        <Input id="upload-alt" value={altText} onChange={(e) => setAltText(e.target.value)} maxLength={200} disabled={busy} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} disabled={busy} className="size-5 accent-[#C9A54C]" /> I confirm we have the right to use this media
        and I&apos;ve checked it shows correct form.
      </label>
      {status.kind === "uploading" && (
        <div className="space-y-1" role="status">
          <div className="h-2 overflow-hidden rounded-full bg-elevated" role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={status.pct}>
            <div className="h-full rounded-full bg-gold transition-[width]" style={{ width: `${status.pct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">Uploading… {status.pct}%</p>
        </div>
      )}
      {status.kind === "saving" && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <Loader2 className="size-3.5 animate-spin" aria-hidden /> Saving…
        </p>
      )}
      {status.kind === "error" && (
        <p role="alert" className="text-sm text-[#f08a8a]">
          {status.message}
        </p>
      )}
      {status.kind === "done" && (
        <p role="status" className="text-sm text-[#5fc49a]">
          {status.message}
        </p>
      )}
      <Button type="submit" size="sm" disabled={busy || !file}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />} Upload
      </Button>
    </form>
  );
}
