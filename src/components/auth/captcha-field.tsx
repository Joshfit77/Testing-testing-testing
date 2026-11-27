"use client";

import { useEffect, useRef, useState } from "react";
import { publicEnv } from "@/lib/env";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void; theme?: string }) => string;
      remove: (id: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * The bot check on the sign-up, sign-in and email-request forms (F-7): Cloudflare Turnstile, which Supabase verifies on
 * its servers when CAPTCHA protection is switched on there. It puts its token in a hidden `captchaToken` field that the
 * server action passes on. Renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't set (local development, tests,
 * and any deployment where Supabase's CAPTCHA protection is off): the two are switched on together (docs/security).
 */
export function CaptchaField() {
  const siteKey = publicEnv.turnstileSiteKey;
  const box = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState("");

  useEffect(() => {
    if (!siteKey || !box.current) return;
    let widget: string | null = null;
    let cancelled = false;
    const render = () => {
      if (cancelled || !box.current || !window.turnstile || widget) return;
      widget = window.turnstile.render(box.current, {
        sitekey: siteKey,
        theme: "dark",
        callback: (t) => setToken(t),
        "expired-callback": () => setToken(""),
        "error-callback": () => setToken(""),
      });
    };
    if (window.turnstile) render();
    else {
      // Added by this (nonce-trusted) script, so the page's strict-dynamic CSP lets it run.
      let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
      if (!script) {
        script = document.createElement("script");
        script.src = SCRIPT_SRC;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", render);
    }
    return () => {
      cancelled = true;
      if (widget && window.turnstile) window.turnstile.remove(widget);
    };
  }, [siteKey]);

  if (!siteKey) return null;
  return (
    <div className="space-y-1">
      <div ref={box} data-testid="captcha" />
      <input type="hidden" name="captchaToken" value={token} />
    </div>
  );
}
