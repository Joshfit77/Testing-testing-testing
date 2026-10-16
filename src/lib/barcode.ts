/**
 * Retail barcode helpers (EAN-13, UPC-A, UPC-E, EAN-8). Pure functions, safe on client and server.
 */

export type RetailBarcodeFormat = "ean13" | "upca" | "upce" | "ean8";

/** GS1 mod-10 check digit for the given digits (without the check digit). */
export function gtinCheckDigit(body: string): number {
  let sum = 0;
  // Weights alternate 3,1,3,1… starting from the rightmost digit of the body.
  for (let i = 0; i < body.length; i++) {
    const digit = body.charCodeAt(body.length - 1 - i) - 48;
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

/** True for an 8-, 12-, 13- or 14-digit GTIN whose last digit is a correct check digit. */
export function isValidGtin(code: string): boolean {
  if (!/^(\d{8}|\d{12,14})$/.test(code)) return false;
  return gtinCheckDigit(code.slice(0, -1)) === Number(code.slice(-1));
}

/**
 * Expands an 8-digit UPC-E code (number system 0/1 + 6 digits + check) to its 12-digit UPC-A form.
 * Returns null when the code isn't a valid UPC-E.
 */
export function expandUpcE(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null;
  const ns = code[0]!;
  const d = code.slice(1, 7);
  const check = code[7]!;
  const last = Number(d[5]);
  let body: string;
  if (last <= 2) body = `${d[0]}${d[1]}${d[5]}0000${d[2]}${d[3]}${d[4]}`;
  else if (last === 3) body = `${d[0]}${d[1]}${d[2]}00000${d[3]}${d[4]}`;
  else if (last === 4) body = `${d[0]}${d[1]}${d[2]}${d[3]}00000${d[4]}`;
  else body = `${d[0]}${d[1]}${d[2]}${d[3]}${d[4]}0000${d[5]}`;
  const upca = `${ns}${body}${check}`;
  return isValidGtin(upca) ? upca : null;
}

/** Strips spaces/dashes a person might type. */
export function cleanBarcodeInput(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}

/**
 * Validates a typed or scanned code and returns the codes to look up, most likely first.
 * - 13 digits: EAN-13.
 * - 12 digits: UPC-A, looked up as EAN-13 (leading 0, how Open Food Facts stores them) then as-is.
 * - 8 digits: EAN-8 if its check digit is valid, otherwise UPC-E expanded to EAN-13. If it is valid as both,
 *   both are returned.
 * Returns null when the code isn't a valid retail barcode.
 */
export function barcodeLookupCandidates(raw: string, format?: RetailBarcodeFormat): string[] | null {
  const code = cleanBarcodeInput(raw);
  if (!/^\d+$/.test(code)) return null;
  if (code.length === 13) return isValidGtin(code) ? [code] : null;
  if (code.length === 12) return isValidGtin(code) ? [`0${code}`, code] : null;
  if (code.length === 8) {
    const upce = expandUpcE(code);
    const asUpce = upce ? [`0${upce}`] : [];
    if (format === "upce") return asUpce.length ? asUpce : null;
    const asEan8 = isValidGtin(code) ? [code] : [];
    if (format === "ean8") return asEan8.length ? asEan8 : null;
    const all = [...asEan8, ...asUpce];
    return all.length ? all : null;
  }
  return null;
}

/** Human-readable reason a typed barcode was rejected (or null if it's fine). */
export function barcodeInputError(raw: string): string | null {
  const code = cleanBarcodeInput(raw);
  if (!code) return "Enter the numbers under the barcode.";
  if (!/^\d+$/.test(code)) return "Barcodes contain digits only.";
  if (![8, 12, 13].includes(code.length)) return "Enter all 8, 12 or 13 digits under the barcode.";
  if (!barcodeLookupCandidates(code)) return "That barcode's check digit doesn't match — re-check the digits.";
  return null;
}
