import "server-only";
import { NextResponse } from "next/server";

export const apiError = (status: number, error: string, message?: string) => NextResponse.json({ error, message }, { status, headers: { "Cache-Control": "no-store" } });
export const apiOk = <T,>(data: T, status = 200) => NextResponse.json({ data }, { status, headers: { "Cache-Control": "no-store" } });
