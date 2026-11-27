export const MARKER: string;
export const TARGETS: { file: string; required: boolean }[];
export function patchSource(text: string): { status: "patched" | "already-patched" | "upstream-fixed"; text: string };
export function unpatchSource(text: string): string;
export const BACKUP_SUFFIX: string;
export function applyToInstalled(opts?: { check?: boolean; root?: string }): string[];
export function restoreInstalled(opts?: { root?: string }): string[];
export function bundleHasFix(js: string): boolean | null;
export function verifyBuild(dir?: string): string[];
