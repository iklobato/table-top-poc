import { NextRequest, NextResponse } from "next/server";
import { startTicker } from "@/lib/ticker";

let stop: null | (() => void) = null;

export async function GET(_req: NextRequest) {
  if (!stop) stop = await startTicker();
  return NextResponse.json({ ok: true });
}
