import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const data = payload as Record<string, unknown>;
  const name = String(data.name ?? "").trim();
  const email = String(data.email ?? "").trim();
  const subject = String(data.subject ?? "").trim();
  const message = String(data.message ?? "").trim();

  if (!name || !email || !message) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  // No email provider wired yet. Log to console for now; future iteration will
  // forward to Resend/Postmark/SES (see CONTACT_EMAIL env var).
  console.log("[contact]", {
    at: new Date().toISOString(),
    name,
    email,
    subject: subject || "(none)",
    message,
    forwardTo: process.env.CONTACT_EMAIL ?? "(unconfigured)",
  });

  return NextResponse.json({ ok: true });
}
