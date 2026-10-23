"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, ChevronRight, ImageUp, Loader2, RotateCcw, SwitchCamera, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BODY_SCAN_BUCKET,
  REQUIRED_POSES,
  SCAN_GUIDANCE,
  SCAN_MAX_DIMENSION,
  SCAN_MEASUREMENT_LABELS,
  SCAN_MEASUREMENTS,
  SCAN_POSE_LABELS,
  SCAN_POSE_TIPS,
  SCAN_TIMER_SECONDS,
  scanPhotoPath,
  tiltFromUpright,
  type ScanMeasurement,
  type ScanPose,
} from "@/lib/domain/body-scan";
import { PHOTO_MAX_BYTES } from "@/lib/domain/progress-photos";
import type { UnitSystem } from "@/lib/domain/types";
import { compressImage } from "@/lib/image-compress";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { saveBodyScanAction } from "@/server/actions/body-scan";
import { PoseOutline } from "./pose-outline";

type Step = "prepare" | ScanPose | "details";
const ORDER: Step[] = ["prepare", "front", "side", "back", "details"];
interface Shot {
  blob: Blob;
  url: string;
}

export function ScanCapture({ userId, units, previous, lastWeight }: { userId: string; units: UnitSystem; previous: Partial<Record<ScanPose, string | null>>; lastWeight: number | null }) {
  const router = useRouter();
  const [scanId] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState<Step>("prepare");
  const [shots, setShots] = useState<Partial<Record<ScanPose, Shot>>>({});
  const [values, setValues] = useState<Record<string, string>>({ weight: lastWeight != null ? String(lastWeight) : "" });
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uploaded = useRef<Partial<Record<ScanPose, string>>>({});

  // Don't lose captured photos to an accidental close before they're saved.
  const unsaved = Object.keys(shots).length > 0 && saving !== "done";
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);
  // Free the local previews when leaving the page (retakes free their own in setShot).
  const shotsRef = useRef(shots);
  shotsRef.current = shots;
  useEffect(() => () => Object.values(shotsRef.current).forEach((s) => s && URL.revokeObjectURL(s.url)), []);

  const next = () => setStep(ORDER[ORDER.indexOf(step) + 1]!);
  const setShot = (pose: ScanPose, shot: Shot | null) =>
    setShots((cur) => {
      const old = cur[pose];
      if (old) URL.revokeObjectURL(old.url);
      delete uploaded.current[pose];
      const out = { ...cur };
      if (shot) out[pose] = shot;
      else delete out[pose];
      return out;
    });

  const save = async () => {
    setError(null);
    const poses = (Object.keys(shots) as ScanPose[]).filter((p) => shots[p]);
    if (!REQUIRED_POSES.every((p) => poses.includes(p))) return setError("A scan needs a front and a side photo.");
    try {
      const supabase = getBrowserSupabase();
      for (const [i, pose] of poses.entries()) {
        if (uploaded.current[pose]) continue;
        setSaving(`Uploading photo ${i + 1} of ${poses.length}…`);
        const path = scanPhotoPath(userId, scanId, pose, crypto.randomUUID());
        const { error: upErr } = await supabase.storage.from(BODY_SCAN_BUCKET).upload(path, shots[pose]!.blob, { contentType: "image/jpeg", upsert: false, cacheControl: "60" });
        if (upErr) throw upErr;
        uploaded.current[pose] = path;
      }
      setSaving("Saving…");
      const r = await saveBodyScanAction({ id: scanId, photos: poses.map((pose) => ({ pose, path: uploaded.current[pose]! })), ...values });
      if (!r.ok) {
        setSaving(null);
        return setError(r.error);
      }
      setSaving("done");
      router.push(`/progress/body-scan?saved=${scanId}`);
      router.refresh();
    } catch {
      setSaving(null);
      setError(navigator.onLine ? "The upload didn't finish. Your photos are still here: try again." : "You're offline. Your photos are still here: save when you're back online.");
    }
  };

  const progress = (
    <ol className="flex gap-1.5" aria-label="Scan steps">
      {ORDER.map((s) => (
        <li key={s} className={cn("h-1.5 flex-1 rounded-full", ORDER.indexOf(s) <= ORDER.indexOf(step) ? "bg-gold" : "bg-elevated")} aria-current={s === step ? "step" : undefined}>
          <span className="sr-only">{s === "prepare" ? "Set up" : s === "details" ? "Measurements" : `${SCAN_POSE_LABELS[s]} photo`}</span>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="space-y-4">
      {progress}
      {step === "prepare" && (
        <Card>
          <CardHeader>
            <CardTitle>Set up for a repeatable scan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {SCAN_GUIDANCE.map((g) => (
              <section key={g.title}>
                <h3 className="text-sm font-semibold text-gold-highlight">{g.title}</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {g.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </section>
            ))}
            <Button onClick={next} data-testid="scan-start">
              I&apos;m ready <ChevronRight aria-hidden />
            </Button>
          </CardContent>
        </Card>
      )}
      {(step === "front" || step === "side" || step === "back") && (
        <PoseStep
          key={step}
          pose={step}
          shot={shots[step] ?? null}
          ghost={previous[step] ?? null}
          onShot={(s) => setShot(step, s)}
          onNext={next}
          optional={!REQUIRED_POSES.includes(step)}
        />
      )}
      {step === "details" && (
        <Card>
          <CardHeader>
            <CardTitle>Measurements (optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2" aria-label="Photos in this scan">
              {(["front", "side", "back"] as const).map((p) =>
                shots[p] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local preview of an unsaved photo
                  <img key={p} src={shots[p]!.url} alt={`${SCAN_POSE_LABELS[p]} photo`} className="aspect-[3/4] w-full rounded-xl object-cover" />
                ) : (
                  <div key={p} className="flex aspect-[3/4] items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
                    No {SCAN_POSE_LABELS[p].toLowerCase()} photo
                  </div>
                ),
              )}
            </div>
            <p className="text-sm text-muted-foreground">Measure with a soft tape at the same spots each time: waist at the navel, hips at the widest point, arm and thigh at the widest point on the same side. Leave blank anything you don&apos;t measure.</p>
            <div className="grid grid-cols-2 gap-3">
              <Field id="scan-weight" label={`Body weight (${units === "metric" ? "kg" : "lb"})`} value={values.weight ?? ""} onChange={(v) => setValues((c) => ({ ...c, weight: v }))} />
              {SCAN_MEASUREMENTS.map((m: ScanMeasurement) => (
                <Field key={m} id={`scan-${m}`} label={`${SCAN_MEASUREMENT_LABELS[m]} (${units === "metric" ? "cm" : "in"})`} value={values[m] ?? ""} onChange={(v) => setValues((c) => ({ ...c, [m]: v }))} />
              ))}
            </div>
            <div className="space-y-1">
              <Label htmlFor="scan-note">Note (optional)</Label>
              <Input id="scan-note" maxLength={280} value={values.note ?? ""} onChange={(e) => setValues((c) => ({ ...c, note: e.target.value }))} />
            </div>
            <p className="text-xs text-muted-foreground">Your weight is also saved as today&apos;s body weight, and measurements go into your measurement history.</p>
            {error && (
              <p role="alert" className="text-sm text-[#f08a8a]">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={save} disabled={saving != null} data-testid="scan-save">
                {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />} {saving && saving !== "done" ? saving : "Save scan"}
              </Button>
              <Button variant="ghost" onClick={() => setStep("front")} disabled={saving != null}>
                Back to photos
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" inputMode="decimal" step="0.1" min="0" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

type CamState = { kind: "off" } | { kind: "starting" } | { kind: "live" } | { kind: "error"; message: string };

function PoseStep({ pose, shot, ghost, onShot, onNext, optional }: { pose: ScanPose; shot: Shot | null; ghost: string | null; onShot: (s: Shot | null) => void; onNext: () => void; optional: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [cam, setCam] = useState<CamState>({ kind: "off" });
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [useTimer, setUseTimer] = useState(true);
  const [count, setCount] = useState<number | null>(null);
  const [showGhost, setShowGhost] = useState(true);
  const [tilt, setTilt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCam({ kind: "off" });
    setCount(null);
  }, []);
  useEffect(() => stop, [stop]);

  // Level guidance where the phone reports its orientation (iOS asks for permission on the first tap).
  useEffect(() => {
    if (cam.kind !== "live") return;
    const onTilt = (e: DeviceOrientationEvent) => setTilt(tiltFromUpright(e.beta, e.gamma));
    window.addEventListener("deviceorientation", onTilt);
    return () => window.removeEventListener("deviceorientation", onTilt);
  }, [cam.kind]);

  const start = async (face = facing) => {
    setError(null);
    stop();
    const D = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
    void D?.requestPermission?.().catch(() => undefined);
    if (!navigator.mediaDevices?.getUserMedia) return setCam({ kind: "error", message: "This browser can't open the camera here. Upload a photo instead." });
    setCam({ kind: "starting" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: face, width: { ideal: 1080 }, height: { ideal: 1440 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCam({ kind: "live" });
    } catch (err) {
      const name = (err as { name?: string }).name;
      setCam({
        kind: "error",
        message: name === "NotAllowedError" ? "Camera permission is off. Allow the camera in your browser or phone settings, or upload a photo instead." : "The camera couldn't start. Upload a photo instead.",
      });
    }
  };

  const accept = async (blob: Blob) => {
    setBusy(true);
    setError(null);
    try {
      const small = await compressImage(blob, SCAN_MAX_DIMENSION);
      if (small.size > PHOTO_MAX_BYTES) return setError("That photo is too large even after resizing. Try another.");
      onShot({ blob: small, url: URL.createObjectURL(small) });
      stop();
    } catch {
      setError("That file couldn't be read as a photo. Try another.");
    } finally {
      setBusy(false);
    }
  };

  const grab = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")!.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.92));
    if (blob) await accept(blob);
  };

  // Countdown, then capture.
  useEffect(() => {
    if (count == null) return;
    if (count === 0) {
      setCount(null);
      navigator.vibrate?.(150);
      void grab();
      return;
    }
    const t = setTimeout(() => setCount((c) => (c == null ? c : c - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- grab reads the live video element
  }, [count]);

  const label = SCAN_POSE_LABELS[pose];
  return (
    <Card data-testid={`scan-step-${pose}`}>
      <CardHeader>
        <CardTitle>
          {label} photo{optional ? " (optional)" : ""}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{SCAN_POSE_TIPS[pose]}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {shot ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview of an unsaved photo */}
            <img src={shot.url} alt={`Your ${label.toLowerCase()} photo`} className="mx-auto max-h-[60vh] rounded-xl" data-testid="scan-review" />
            <p className="text-sm text-muted-foreground">Check that your whole body is in the frame and the photo is sharp and evenly lit.</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={onNext} data-testid="scan-use-photo">
                <Check aria-hidden /> Use this photo
              </Button>
              <Button variant="secondary" onClick={() => onShot(null)}>
                <RotateCcw aria-hidden /> Retake
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className={cn("relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-xl bg-black", cam.kind === "live" || cam.kind === "starting" ? "" : "hidden")}>
              <video ref={videoRef} playsInline muted className="absolute inset-0 size-full object-cover" data-testid="scan-video" />
              {ghost && showGhost && (
                // eslint-disable-next-line @next/next/no-img-element -- signed link to the member's own previous photo
                <img src={ghost} alt="" className="absolute inset-0 size-full object-cover opacity-30" />
              )}
              <PoseOutline pose={pose} className="absolute inset-0 size-full p-2" />
              {count != null && (
                <span className="absolute inset-0 flex items-center justify-center font-display text-7xl text-gold-highlight drop-shadow" aria-live="assertive">
                  {count}
                </span>
              )}
              {tilt != null && (
                <span className={cn("absolute left-2 top-2 rounded-lg px-2 py-1 text-xs font-semibold", tilt <= 5 ? "bg-[#1e3b2c] text-[#9be3bd]" : "bg-[#3b2c1e] text-[#f3c89b]")} aria-live="polite">
                  {tilt <= 5 ? "Phone is upright" : `Tilt the phone upright (${tilt}°)`}
                </span>
              )}
            </div>
            {cam.kind === "error" && (
              <p role="alert" className="text-sm text-[#f08a8a]">
                {cam.message}
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-[#f08a8a]">
                {error}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {cam.kind === "live" ? (
                <>
                  <Button onClick={() => (useTimer ? setCount(SCAN_TIMER_SECONDS) : void grab())} disabled={count != null || busy} data-testid="scan-capture">
                    {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Camera aria-hidden />} {useTimer ? `Start ${SCAN_TIMER_SECONDS}-second timer` : "Take photo"}
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label="Switch camera"
                    onClick={() => {
                      const f = facing === "user" ? "environment" : "user";
                      setFacing(f);
                      void start(f);
                    }}
                  >
                    <SwitchCamera aria-hidden />
                  </Button>
                </>
              ) : (
                <Button onClick={() => start()} disabled={cam.kind === "starting"} data-testid="scan-open-camera">
                  {cam.kind === "starting" ? <Loader2 className="animate-spin" aria-hidden /> : <Camera aria-hidden />} Open camera
                </Button>
              )}
              <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
                <ImageUp aria-hidden /> Upload a photo
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label={`Upload ${label.toLowerCase()} photo`}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void accept(f);
                }}
              />
              {optional && (
                <Button variant="ghost" onClick={onNext}>
                  Skip
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="size-4 accent-[#cfa53e]" checked={useTimer} onChange={(e) => setUseTimer(e.target.checked)} />
                <Timer className="size-4 text-gold" aria-hidden /> {SCAN_TIMER_SECONDS}-second timer
              </label>
              {ghost && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="size-4 accent-[#cfa53e]" checked={showGhost} onChange={(e) => setShowGhost(e.target.checked)} />
                  Show my last scan faintly
                </label>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
