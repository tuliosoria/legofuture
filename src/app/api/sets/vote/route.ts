import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { enforceIpRateLimit, getClientIp } from "@/lib/db/rate-limit";
import { hasVoted, recordVote } from "@/lib/db/curated-sets";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rl = await enforceIpRateLimit(req, {
    bucket: "vote",
    windowSec: 60,
    max: 5,
  });
  if (rl) return rl;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const setNumber =
    body && typeof body === "object" && "setNumber" in body
      ? String((body as { setNumber: unknown }).setNumber)
      : null;

  if (!setNumber) {
    return NextResponse.json({ error: "setNumber required" }, { status: 400 });
  }

  const ip = getClientIp(req);
  const hashedIp = createHash("sha256").update(ip).digest("hex");

  const alreadyVoted = await hasVoted(hashedIp, setNumber);
  if (alreadyVoted) {
    return NextResponse.json(
      { error: "Already voted. You can vote again after 30 days." },
      { status: 409 }
    );
  }

  const voteCount = await recordVote(hashedIp, setNumber);
  return NextResponse.json({ voteCount }, { status: 200 });
}
