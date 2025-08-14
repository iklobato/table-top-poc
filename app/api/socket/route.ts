import { NextRequest } from "next/server";
import { getIO } from "./io";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  // Next doesn't expose Node server directly for API Routes; this endpoint is a health noop.
  return new Response("ok", { status: 200 });
}
