import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest) {
  return NextResponse.json({
    roundSeconds: Number(process.env.ROUND_SECONDS || 180),
  });
}
