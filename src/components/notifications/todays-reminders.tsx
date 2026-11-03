"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BellRing, CheckCircle2, ChevronRight, Circle } from "lucide-react";
import { isNativeApp } from "@/lib/native";
import { notificationPermission } from "@/lib/native-notifications";
import type { TodayReminder } from "@/lib/notifications/planner";

const fmt12 = (t: string) => {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/**
 * The fallback when this device can't show notifications (a web browser, or the app with notifications not allowed):
 * today's reminders as a list on Home, with anything whose time has passed marked "Earlier today". Hidden when this
 * phone delivers them itself, or when there's nothing left to do today.
 */
export function TodaysReminders({ items }: { items: TodayReminder[] }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!isNativeApp()) return setShow(true);
    void notificationPermission().then((p) => setShow(p !== "granted"));
  }, []);
  const open = items.filter((i) => i.status !== "done");
  if (!show || open.length === 0) return null;
  return (
    <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="todays-reminders-title" data-testid="todays-reminders">
      <h2 id="todays-reminders-title" className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <BellRing className="size-4 text-gold" aria-hidden /> Today&rsquo;s reminders
      </h2>
      <ul className="mt-2 divide-y divide-border">
        {items.map((i) => (
          <li key={i.kind}>
            <Link href={i.url} className="flex min-h-12 items-center gap-3 py-2">
              {i.status === "done" ? <CheckCircle2 className="size-5 shrink-0 text-[#5fc49a]" aria-hidden /> : <Circle className="size-5 shrink-0 text-gold" aria-hidden />}
              <span className="min-w-0 flex-1">
                <span className={i.status === "done" ? "block text-muted-foreground line-through" : "block font-semibold"}>{i.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {i.status === "done" ? "Done" : i.status === "missed" ? `Earlier today, ${fmt12(i.time)}` : fmt12(i.time)}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-gold" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Shown here because this device isn&rsquo;t showing notifications.{" "}
        <Link href="/profile/notifications" className="font-semibold text-gold-highlight underline">
          Notification settings
        </Link>
      </p>
    </section>
  );
}
