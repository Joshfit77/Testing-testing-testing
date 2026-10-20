"use client";

import { useEffect } from "react";
import { isNativeApp } from "@/lib/native";
import { isCovered, isTextEntry, keyboardInset, prefersReducedMotion } from "@/lib/keyboard";
import "./keyboard.css";

/**
 * Keeps the on-screen keyboard from covering what you're typing into (see src/lib/keyboard.ts).
 * Mounted once in the (app) layout; renders nothing.
 */
export function KeyboardAvoidance() {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    let open = false;

    const setOpen = (inset: number) => {
      root.style.setProperty("--keyboard-inset", `${inset}px`);
      if (vv) {
        root.style.setProperty("--vv-height", `${Math.round(vv.height)}px`);
        root.style.setProperty("--vv-top", `${Math.round(vv.offsetTop)}px`);
      }
      const nowOpen = inset > 0;
      if (nowOpen !== open) {
        open = nowOpen;
        if (open) root.dataset.keyboard = "open";
        else delete root.dataset.keyboard;
        if (open) revealFocused();
      }
    };

    const revealFocused = () => {
      const el = document.activeElement;
      if (!isTextEntry(el)) return;
      // Wait for the keyboard animation and our CSS changes to settle.
      window.setTimeout(() => {
        if (document.activeElement !== el) return;
        const rect = el.getBoundingClientRect();
        const top = vv?.offsetTop ?? 0;
        const bottom = top + (vv?.height ?? window.innerHeight);
        if (isCovered(rect, top, bottom)) el.scrollIntoView({ block: "center", inline: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
      }, 250);
    };

    const measure = () => setOpen(keyboardInset(window.innerHeight, vv));
    const onFocusIn = (e: FocusEvent) => {
      if (open && isTextEntry(e.target as Element)) revealFocused();
    };

    vv?.addEventListener("resize", measure);
    vv?.addEventListener("scroll", measure);
    document.addEventListener("focusin", onFocusIn);
    measure();

    // Native shells: the web view resizes itself; the plugin events just tell us the keyboard state.
    const cleanups: (() => void)[] = [];
    if (isNativeApp()) {
      void (async () => {
        try {
          const { Keyboard } = await import("@capacitor/keyboard");
          const show = await Keyboard.addListener("keyboardDidShow", () => {
            root.dataset.keyboard = "open";
            open = true;
            revealFocused();
          });
          const hide = await Keyboard.addListener("keyboardDidHide", () => {
            delete root.dataset.keyboard;
            open = false;
          });
          cleanups.push(() => void show.remove(), () => void hide.remove());
        } catch {
          /* plugin not installed in this build */
        }
      })();
    }

    return () => {
      vv?.removeEventListener("resize", measure);
      vv?.removeEventListener("scroll", measure);
      document.removeEventListener("focusin", onFocusIn);
      cleanups.forEach((c) => c());
      delete root.dataset.keyboard;
    };
  }, []);

  return null;
}
