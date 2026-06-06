"use client";

import { useState } from "react";
import { BrickButton } from "@/components/ui/BrickButton";

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "submitting" | "ok" | "error">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      setStatus(res.ok ? "ok" : "error");
      if (res.ok) e.currentTarget.reset();
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field name="name" label="Your name" required />
      <Field name="email" label="Email" type="email" required />
      <Field name="subject" label="Subject" />
      <div>
        <label htmlFor="message" className="type-caption text-slate-500 mb-1 block">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          className="w-full rounded-chip border-2 border-jet-black bg-pure-white px-3 py-2 type-body-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-bright-blue"
        />
      </div>
      <BrickButton type="submit" variant="primary" disabled={status === "submitting"}>
        {status === "submitting" ? "Sending…" : "Send message"}
      </BrickButton>
      {status === "ok" && (
        <p className="type-body-sm text-pure-green">Thanks. We got your message and will reply within 2 business days.</p>
      )}
      {status === "error" && (
        <p className="type-body-sm text-brick-red">
          Something went wrong. Please try again in a moment.
        </p>
      )}
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  required = false,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
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
        className="w-full rounded-chip border-2 border-jet-black bg-pure-white px-3 py-2 type-body-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-bright-blue"
      />
    </div>
  );
}
