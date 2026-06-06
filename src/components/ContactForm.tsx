"use client";

import { useState } from "react";
import { BrickButton } from "@/components/ui/BrickButton";

type Status = "idle" | "submitting" | "success" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus("submitting");
    setError(null);

    const formData = new FormData(form);
    const honeypot = String(formData.get("company") ?? "");
    if (honeypot) {
      setStatus("success");
      form.reset();
      return;
    }

    const payload = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      subject: String(formData.get("subject") ?? ""),
      message: String(formData.get("message") ?? ""),
      company: honeypot,
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setStatus("error");
        setError(
          data.error === "missing_fields"
            ? "Please fill in name, email, and message."
            : data.error === "invalid_email"
              ? "That email address doesn't look valid."
              : data.error === "invalid_message_length"
                ? "Message must be between 10 and 5000 characters."
                : "We couldn't send your message. Please try again in a minute.",
        );
        return;
      }
      setStatus("success");
      form.reset();
    } catch {
      setStatus("error");
      setError("Network error. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-chip border-2 border-jet-black bg-pure-green/10 p-4 type-body-sm text-jet-black">
        <p className="font-semibold">Thanks, your message is on its way.</p>
        <p className="mt-1 text-slate-700">
          We&rsquo;ll reply to the email you provided, usually within 2 business days.
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setError(null);
          }}
          className="mt-3 type-caption font-semibold underline text-bright-blue"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Field name="name" label="Your name" required maxLength={120} autoComplete="name" />
      <Field name="email" label="Email" type="email" required maxLength={254} autoComplete="email" />
      <Field name="subject" label="Subject" maxLength={200} />
      <div>
        <label htmlFor="message" className="type-caption text-slate-500 mb-1 block">
          Message<span className="text-brick-red ml-0.5">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          required
          minLength={10}
          maxLength={5000}
          rows={6}
          className="w-full rounded-chip border-2 border-jet-black bg-pure-white px-3 py-2 type-body-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-bright-blue"
        />
      </div>

      {/* Honeypot: visually hidden, off the tab order. */}
      <div
        aria-hidden="true"
        style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}
      >
        <label htmlFor="contact-company">Company</label>
        <input
          id="contact-company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {status === "error" && error ? (
        <div
          className="rounded-chip border-2 border-brick-red bg-brick-red/5 p-3 type-body-sm text-brick-red"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <BrickButton type="submit" variant="primary" disabled={status === "submitting"}>
        {status === "submitting" ? "Sending…" : "Send message"}
      </BrickButton>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  required = false,
  maxLength,
  autoComplete,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  maxLength?: number;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="type-caption text-slate-500 mb-1 block">
        {label}
        {required && <span className="text-brick-red ml-0.5">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        maxLength={maxLength}
        autoComplete={autoComplete}
        className="w-full rounded-chip border-2 border-jet-black bg-pure-white px-3 py-2 type-body-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-bright-blue"
      />
    </div>
  );
}
