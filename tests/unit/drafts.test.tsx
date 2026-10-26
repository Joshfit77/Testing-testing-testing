import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { vi } from "vitest";
import { DRAFT_MAX_AGE_MS, clearAllDrafts, draftStorageKey, isBlankDraft, readDraft, writeDraft } from "@/lib/drafts";
import { DraftUserProvider, useDraft } from "@/lib/use-draft";

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe("draft storage", () => {
  it("namespaces drafts per user", () => {
    writeDraft("u1", "coach.input.new", "hello");
    expect(readDraft("u1", "coach.input.new")?.value).toBe("hello");
    expect(readDraft("u2", "coach.input.new")).toBeNull();
    expect(localStorage.getItem(draftStorageKey("u1", "coach.input.new"))).toContain("hello");
  });

  it("expires old drafts and drops malformed ones", () => {
    const now = Date.now();
    writeDraft("u1", "a", "old", now - DRAFT_MAX_AGE_MS - 1);
    expect(readDraft("u1", "a", now)).toBeNull();
    expect(localStorage.getItem(draftStorageKey("u1", "a"))).toBeNull();
    localStorage.setItem(draftStorageKey("u1", "b"), "{not json");
    expect(readDraft("u1", "b")).toBeNull();
    localStorage.setItem(draftStorageKey("u1", "c"), JSON.stringify({ v: 2, at: now, value: 1 }));
    expect(readDraft("u1", "c")).toBeNull();
  });

  it("clears one user's drafts or all of them", () => {
    writeDraft("u1", "a", "x");
    writeDraft("u1", "b", "y");
    writeDraft("u2", "a", "z");
    localStorage.setItem("ngf.textSize", "large");
    expect(clearAllDrafts("u1")).toBe(2);
    expect(readDraft("u2", "a")?.value).toBe("z");
    expect(clearAllDrafts()).toBe(1);
    expect(localStorage.getItem("ngf.textSize")).toBe("large");
  });

  it("also removes a run or walk still being recorded (its GPS fixes), for that user only", () => {
    writeDraft("u1", "a", "x");
    localStorage.setItem("run.recording.u1", JSON.stringify({ track: { status: "recording" } }));
    localStorage.setItem("run.recording.u2", JSON.stringify({ track: { status: "recording" } }));
    expect(clearAllDrafts("u1")).toBe(2);
    expect(localStorage.getItem("run.recording.u1")).toBeNull();
    expect(localStorage.getItem("run.recording.u2")).not.toBeNull();
    expect(clearAllDrafts()).toBe(1);
    expect(localStorage.getItem("run.recording.u2")).toBeNull();
  });

  it("treats empty forms as blank", () => {
    expect(isBlankDraft("  ")).toBe(true);
    expect(isBlankDraft({ name: "", calories: "", isEstimate: true })).toBe(true);
    expect(isBlankDraft({ name: "Oats", calories: "" })).toBe(false);
    const blank = { date: "2026-10-20", body: "" };
    expect(isBlankDraft({ ...blank }, blank)).toBe(true);
    expect(isBlankDraft({ ...blank, date: "2026-10-19" }, blank)).toBe(false);
  });

  it("survives storage that throws", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    expect(writeDraft("u1", "a", "x")).toBe(false);
    spy.mockRestore();
  });
});

function Journal({ onSaved }: { onSaved?: () => void }) {
  const d = useDraft("faith.journal.new", { title: "", body: "" }, { debounceMs: 50 });
  const [saved, setSaved] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        d.clear();
        setSaved(true);
        onSaved?.();
      }}
    >
      {d.restored && <p>Draft restored</p>}
      {saved && <p>Saved</p>}
      <label>
        Body
        <textarea value={d.value.body} onChange={(e) => d.setValue((v) => ({ ...v, body: e.target.value }))} />
      </label>
      <button type="submit">Save</button>
    </form>
  );
}

describe("useDraft", () => {
  it("saves while typing, restores after a remount (tab switch / reload) and clears on submit", async () => {
    vi.useFakeTimers();
    const first = render(
      <DraftUserProvider userId="u1">
        <Journal />
      </DraftUserProvider>,
    );
    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "Grateful for today" } });
    act(() => vi.advanceTimersByTime(60));
    expect(readDraft<{ body: string }>("u1", "faith.journal.new")?.value.body).toBe("Grateful for today");
    first.unmount();

    render(
      <DraftUserProvider userId="u1">
        <Journal />
      </DraftUserProvider>,
    );
    expect(screen.getByLabelText("Body")).toHaveValue("Grateful for today");
    expect(screen.getByText("Draft restored")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByLabelText("Body")).toHaveValue("");
    act(() => vi.advanceTimersByTime(100));
    expect(readDraft("u1", "faith.journal.new")).toBeNull();
  });

  it("writes pending text immediately when the form unmounts before the debounce", () => {
    vi.useFakeTimers();
    const view = render(
      <DraftUserProvider userId="u1">
        <Journal />
      </DraftUserProvider>,
    );
    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "half a thought" } });
    view.unmount();
    expect(readDraft<{ body: string }>("u1", "faith.journal.new")?.value.body).toBe("half a thought");
  });

  it("never shows another user's draft", () => {
    writeDraft("u1", "faith.journal.new", { title: "", body: "private" });
    render(
      <DraftUserProvider userId="u2">
        <Journal />
      </DraftUserProvider>,
    );
    expect(screen.getByLabelText("Body")).toHaveValue("");
    expect(screen.queryByText("Draft restored")).toBeNull();
  });
});
