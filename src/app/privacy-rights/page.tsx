import { BrickCard } from "@/components/ui/BrickCard";
import Link from "next/link";

export const metadata = {
  title: "Privacy Rights · LegoFuture",
  description:
    "Your data-subject rights under GDPR, UK GDPR, and CCPA/CPRA, and how to exercise them.",
};

const LAST_UPDATED = "June 6, 2026";

export default function PrivacyRightsPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <p className="type-eyebrow text-slate-500 mb-2">Legal</p>
      <h1 className="type-display-2 text-jet-black mb-2">Privacy Rights</h1>
      <p className="type-body-sm text-slate-500 mb-8">Last updated: {LAST_UPDATED}</p>

      <BrickCard compact className="space-y-8">
        <p className="type-body text-slate-700">
          This page describes the privacy rights you may have under applicable law and how
          to exercise them. For background on what we collect and why, see our{" "}
          <Link href="/privacy" className="text-bright-blue underline">Privacy Policy</Link>.
        </p>

        <Section n="1" title="Rights under GDPR (EEA) and UK GDPR">
          <p className="mb-2">If you are located in the European Economic Area or the United Kingdom, you have the right to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Access</strong> the personal data we hold about you.</li>
            <li><strong>Rectify</strong> data that is inaccurate or incomplete.</li>
            <li><strong>Erase</strong> your data (&ldquo;right to be forgotten&rdquo;), subject to legal exceptions.</li>
            <li><strong>Restrict</strong> processing in certain circumstances.</li>
            <li><strong>Object</strong> to processing based on our legitimate interests.</li>
            <li><strong>Portability</strong> of data you have provided, in a structured, machine-readable format.</li>
            <li><strong>Withdraw consent</strong> at any time, where processing is based on consent.</li>
            <li><strong>Lodge a complaint</strong> with your local data-protection authority (in the UK, the Information Commissioner&rsquo;s Office at ico.org.uk).</li>
          </ul>
        </Section>

        <Section n="2" title="Rights under CCPA / CPRA (California)">
          <p className="mb-2">If you are a California resident, you have the right to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Know</strong> what categories of personal information we have collected, the sources, the purposes for collection, and the categories of third parties (if any) with whom we have shared it in the past 12 months.</li>
            <li><strong>Delete</strong> personal information we hold about you, subject to legal exceptions.</li>
            <li><strong>Correct</strong> inaccurate personal information.</li>
            <li><strong>Opt out of the sale or sharing</strong> of personal information. <span className="italic">We do not sell or share personal information for cross-context behavioural advertising</span>, so there is no opt-out mechanism to surface.</li>
            <li><strong>Limit the use of sensitive personal information.</strong> We do not collect sensitive personal information as defined by CPRA.</li>
            <li><strong>Non-discrimination:</strong> we will not deny you service, charge a different price, or provide a different level of quality because you exercised your rights.</li>
          </ul>
        </Section>

        <Section n="3" title="Other US state privacy laws">
          <p>
            Residents of states with comprehensive privacy laws similar to CCPA (including
            Virginia, Colorado, Connecticut, Utah, Texas, Oregon, and others) generally
            have rights of access, deletion, correction, portability, and opt-out of certain
            processing. We honour these requests under the same process described below.
          </p>
        </Section>

        <Section n="4" title="How to submit a privacy request">
          <p>
            Submit your request via our{" "}
            <Link href="/contact" className="text-bright-blue underline">contact form</Link>.
            Include:
          </p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>the right you wish to exercise (e.g., access, deletion);</li>
            <li>enough information for us to identify the data you are asking about (for example, the email address you used to contact us, the approximate date of contact, the IP-address range if known);</li>
            <li>your jurisdiction (so we apply the correct law).</li>
          </ul>
        </Section>

        <Section n="5" title="Verification">
          <p>
            To protect your privacy, we may need to verify your identity before fulfilling
            a request. For most requests, matching the email address used in a prior contact
            submission is sufficient. For broader requests we may ask for additional
            information to confirm you are the data subject. We will not use verification
            information for any other purpose.
          </p>
        </Section>

        <Section n="6" title="Response time">
          <p>
            We will acknowledge your request promptly and respond substantively within{" "}
            <strong>30 days</strong> under GDPR / UK GDPR and within <strong>45 days</strong>{" "}
            under CCPA / CPRA. We may extend the period by an additional 45 days where
            reasonably necessary, in which case we will notify you of the extension and the
            reason.
          </p>
        </Section>

        <Section n="7" title="Authorised agents">
          <p>
            You may designate an authorised agent to submit a request on your behalf. We
            may ask the agent to provide proof of authorisation and may also contact you
            directly to confirm. Authorised-agent requests can be submitted via the same
            contact form.
          </p>
        </Section>

        <Section n="8" title="Appeals">
          <p>
            If you are unsatisfied with our response to a privacy request, you may submit
            an appeal through the contact form within 60 days. We will review the appeal
            and respond in writing. Residents of jurisdictions with statutory appeal rights
            (including several US states and the EEA / UK) retain the right to lodge a
            complaint with their data-protection authority.
          </p>
        </Section>

        <Section n="9" title="No fee">
          <p>
            We do not charge a fee for honouring privacy requests, unless the request is
            manifestly unfounded or excessive (for example, repetitive). In those rare
            cases we may charge a reasonable administrative fee or decline to act, and we
            will explain our reasoning.
          </p>
        </Section>
      </BrickCard>
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="type-h3 text-jet-black mb-2">
        <span className="text-slate-400 mr-2">{n}.</span>
        {title}
      </h2>
      <div className="type-body text-slate-700">{children}</div>
    </div>
  );
}
