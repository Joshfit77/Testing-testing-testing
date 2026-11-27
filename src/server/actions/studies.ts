"use server";

import { z } from "zod";
import { findLesson, findStudy } from "@/data/studies";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth";
import { logError } from "@/server/log";

/* A member's own progress and notes in a guided study (owner-only table, explicit user filter). */

const valid = (study: string, lesson: string) => {
  const s = findStudy(study);
  return Boolean(s && findLesson(s, lesson));
};

export async function saveStudyNotesAction(study: string, lesson: string, notes: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const body = z.string().max(10000).safeParse(notes);
  if (!valid(study, lesson) || !body.success) return { ok: false, error: "Couldn't save your notes." };
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("bible_study_progress")
    .upsert({ user_id: user.id, study_slug: study, lesson_slug: lesson, notes: body.data.trim() || null, updated_at: new Date().toISOString() }, { onConflict: "user_id,study_slug,lesson_slug" });
  if (error) {
    logError("faith.study.notes", error);
    return { ok: false, error: "Couldn't save your notes." };
  }
  return { ok: true };
}

export async function toggleStudyLessonAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const study = String(formData.get("study") ?? "");
  const lesson = String(formData.get("lesson") ?? "");
  if (!valid(study, lesson)) return;
  const supabase = await getServerSupabase();
  const done = formData.get("done") === "true";
  const { error } = await supabase
    .from("bible_study_progress")
    .upsert({ user_id: user.id, study_slug: study, lesson_slug: lesson, completed_at: done ? new Date().toISOString() : null, updated_at: new Date().toISOString() }, { onConflict: "user_id,study_slug,lesson_slug" });
  if (error) logError("faith.study.complete", error);
}
