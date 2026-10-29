// The model and rig files for the preview pages: fetched as they are, or (artifact builds, which serve no binary
// types) as base64 text parts named on window.*_PARTS by the build.
declare global {
  interface Window {
    ECORCHE_PARTS?: string[];
    SKIN_PARTS?: string[];
    FACE_PARTS?: string[];
    RIG_PARTS?: string[];
    CORR_PARTS?: string[];
    BAKE_PARTS?: Record<string, string[]>;
  }
}

/** sha256 of model/ecorche.glb in github.com/Charleeh/ecorche at commit 320805e: the page checks it before showing. */
export const ECORCHE_SHA256 = "9744d3dffced835961104447d23a781ad469588289ce322d84d000e0d498326c";

/** The model file's bytes, from the .glb itself or from its base64 parts, with download progress. */
export async function fetchModel(onProgress: (f: number) => void): Promise<ArrayBuffer> {
  return fetchBinary("anatomy/ecorche.glb", window.ECORCHE_PARTS, onProgress);
}

/** A binary file, fetched as it is or (artifact builds, which serve no binary types) as base64 text parts. */
export async function fetchBinary(url: string, parts: string[] | undefined, onProgress: (f: number) => void): Promise<ArrayBuffer> {
  const read = async (url: string, done: number, share: number) => {
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`${url}: ${res.status}`);
    const total = Number(res.headers.get("content-length")) || 0;
    const reader = res.body.getReader();
    const parts: Uint8Array[] = [];
    let got = 0;
    for (;;) {
      const { done: end, value } = await reader.read();
      if (end) break;
      parts.push(value);
      got += value.length;
      if (total) onProgress(done + (share * got) / total);
    }
    const out = new Uint8Array(got);
    let o = 0;
    for (const p of parts) {
      out.set(p, o);
      o += p.length;
    }
    return out;
  };
  if (!parts) return (await read(url, 0, 1)).buffer as ArrayBuffer;
  let text = "";
  for (let i = 0; i < parts.length; i++) text += new TextDecoder().decode(await read(parts[i]!, i / parts.length, 1 / parts.length));
  const bin = atob(text.trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

