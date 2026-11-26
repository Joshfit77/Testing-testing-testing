import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { closeTopOverlay } from "@/lib/native-back";

/** O-07: Android Back closes an open sheet the way Escape does, instead of navigating the page underneath. */
function Sheet() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <p>{open ? "sheet open" : "sheet closed"}</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent side="bottom">
          <DialogTitle>Note</DialogTitle>
          <DialogDescription>Private</DialogDescription>
          <textarea aria-label="Note" />
        </DialogContent>
      </Dialog>
    </>
  );
}

describe("Android back button", () => {
  it("closes the open sheet and reports it; with nothing open it leaves navigation to the caller", async () => {
    render(<Sheet />);
    expect(screen.getByText("sheet open")).toBeInTheDocument();
    let closed = false;
    await act(async () => {
      closed = closeTopOverlay();
    });
    expect(closed).toBe(true);
    expect(screen.getByText("sheet closed")).toBeInTheDocument();
    expect(closeTopOverlay()).toBe(false);
  });
});
