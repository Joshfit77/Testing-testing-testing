import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DeviceCleanup } from "@/components/platform/device-cleanup";
import { draftStorageKey, markDeviceCleanup, takeDeviceCleanup, writeDraft } from "@/lib/drafts";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

/** Sign-out leaves a marker for this tab; the login page then removes that member's drafts and GPS recording. */
describe("device clean-up after sign-out", () => {
  it("clears the signing-out member's drafts and recording, and nobody else's", () => {
    writeDraft("u1", "a", "x");
    localStorage.setItem("run.recording.u1", "{}");
    writeDraft("u2", "a", "y");
    localStorage.setItem("run.recording.u2", "{}");
    markDeviceCleanup("u1");
    render(<DeviceCleanup />);
    expect(localStorage.getItem(draftStorageKey("u1", "a"))).toBeNull();
    expect(localStorage.getItem("run.recording.u1")).toBeNull();
    expect(localStorage.getItem(draftStorageKey("u2", "a"))).not.toBeNull();
    expect(localStorage.getItem("run.recording.u2")).not.toBeNull();
    // The marker is consumed, so a later visit to the page does nothing.
    expect(takeDeviceCleanup()).toBeNull();
  });

  it("does nothing without a marker", () => {
    localStorage.setItem("run.recording.u1", "{}");
    render(<DeviceCleanup />);
    expect(localStorage.getItem("run.recording.u1")).toBe("{}");
  });
});
