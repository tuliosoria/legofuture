import { NextResponse } from "next/server";

export const runtime = "nodejs";

const FORMSUBMIT_EMAIL =
  process.env.FORMSUBMIT_EMAIL ??
  process.env.NEXT_PUBLIC_FORMSUBMIT_EMAIL ??
  "tulio.soria@gmail.com";

const FORMSUBMIT_ENDPOINT = `https://formsubmit.co/ajax/${FORMSUBMIT_EMAIL}`;

export async function POST(req: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const name = String(payload.name ?? "").trim();
  const email = String(payload.email ?? "").trim();
  const subject = String(payload.subject ?? "").trim();
  const message = String(payload.message ?? "").trim();
  const honeypot = String(payload.company ?? "");

  if (!name || !email || !message) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }
  if (message.length < 10 || message.length > 5000) {
    return NextResponse.json({ ok: false, error: "invalid_message_length" }, { status: 400 });
  }

  // Honeypot: silently swallow bot submissions.
  if (honeypot) {
    return NextResponse.json({ ok: true });
  }

  const fsPayload = {
    name,
    email,
    subject: subject || "(none)",
    message,
    _subject: subject ? `LegoFuture: ${subject}` : "LegoFuture contact form",
    _template: "table",
    _honey: honeypot,
  };

  try {
    const origin = req.headers.get("origin") ?? "https://legofuture.com";
    const referer = req.headers.get("referer") ?? `${origin}/contact`;

    const res = await fetch(FORMSUBMIT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        // FormSubmit gates the /ajax/ endpoint on the Referer header.
        Referer: referer,
        Origin: origin,
        "User-Agent": "Mozilla/5.0 (compatible; LegoFuture/1.0)",
      },
      body: JSON.stringify(fsPayload),
    });

    const text = await res.text();
    let data: { success?: string | boolean; message?: string } = {};
    try {
      data = JSON.parse(text);
    } catch {
      // formsubmit occasionally returns HTML (e.g., activation page). Fall through.
    }

    const ok = res.ok && (data.success === "true" || data.success === true);
    if (!ok) {
      console.error("[contact] formsubmit non-ok", {
        status: res.status,
        bodySnippet: text.slice(0, 200),
      });
      const msg = data.message ?? "";
      const errorCode = /Activation/i.test(msg)
        ? "pending_activation"
        : "delivery_failed";
      return NextResponse.json(
        { ok: false, error: errorCode, detail: msg || undefined },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[contact] proxy error", err);
    return NextResponse.json({ ok: false, error: "network_error" }, { status: 502 });
  }
}
