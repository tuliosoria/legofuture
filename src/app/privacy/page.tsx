import { getLegalConfig } from "@/lib/legal-config";
import { BrickCard } from "@/components/ui/BrickCard";
import Link from "next/link";

export const metadata = {
  title: "Privacy Policy · BricksFuture",
  description:
    "How BricksFuture collects, uses, and protects your data. What we don't collect, who we share with, and your rights.",
};

const LAST_UPDATED = "June 6, 2026";

export default function PrivacyPage() {
  const cfg = getLegalConfig();
  const op = cfg.operatorName;

  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <p className="type-eyebrow text-slate-500 mb-2">Legal</p>
      <h1 className="type-display-2 text-jet-black mb-2">Privacy Policy</h1>
      <p className="type-body-sm text-slate-500 mb-8">Last updated: {LAST_UPDATED}</p>

      <BrickCard compact className="space-y-8">
        <p className="type-body text-slate-700">
          <strong className="text-jet-black">{op}</strong> (&ldquo;we,&rdquo; &ldquo;us,&rdquo; &ldquo;our&rdquo;)
          provides educational market-analysis tools for LEGO sets at bricksfuture.com (the
          &ldquo;Service&rdquo;). This policy explains what data we collect, how we use it,
          who we share it with, and your rights.
        </p>

        <Section n="1" title="Who this policy covers">
          <p>
            This policy applies to all visitors to bricksfuture.com. The Service does not
            require an account and is designed to collect as little personal data as
            possible.
          </p>
        </Section>

        <Section n="2" title="Data we collect">
          <p className="mb-2">We collect only what is necessary to operate the Service:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Server logs.</strong> When you visit a page, our hosting provider
              automatically records standard request metadata: IP address, user-agent string,
              referring URL, requested path, response status, and timestamp. These logs are
              used for security, debugging, and traffic-pattern analysis.
            </li>
            <li>
              <strong>Contact-form submissions.</strong> If you send us a message, we
              collect the name, email address, subject, and message body you provide.
            </li>
            <li>
              <strong>Affiliate click metadata.</strong> When you click an eBay affiliate
              link, eBay records that the click originated from {op} for commission
              tracking. We do not see your eBay activity.
            </li>
          </ul>
          <p className="mt-2">
            We do not currently use analytics scripts, advertising trackers, social-media
            pixels, or third-party fingerprinting on the Service.
          </p>
        </Section>

        <Section n="3" title="What we do not collect">
          <p>
            We do not require accounts and do not store passwords. We do not request
            location data, contacts, or device permissions. We do not collect payment
            information (we do not sell anything directly). We do not knowingly collect
            data from children under 13.
          </p>
        </Section>

        <Section n="4" title="How we use your data">
          <p className="mb-2">We use the limited data we collect to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>operate, secure, and improve the Service;</li>
            <li>respond to contact-form messages;</li>
            <li>detect and prevent abuse, fraud, or attacks;</li>
            <li>comply with legal obligations.</li>
          </ul>
          <p className="mt-2">
            We do not use your data for advertising, profiling, or automated decisions that
            produce legal effects about you.
          </p>
        </Section>

        <Section n="5" title="Legal bases (GDPR / UK GDPR)">
          <p>
            If you are in the European Economic Area, United Kingdom, or another
            jurisdiction with similar law, we process personal data under the following
            legal bases: <strong>legitimate interests</strong> (operating and securing the
            Service, responding to inquiries), <strong>consent</strong> (where you
            voluntarily submit a contact-form message), and <strong>legal obligation</strong>{" "}
            (where required to comply with law).
          </p>
        </Section>

        <Section n="6" title="Third parties">
          <p className="mb-2">
            The Service relies on the following third parties. Each has its own privacy
            policy that you should review:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Hosting and CDN:</strong> processes requests and logs as described above.</li>
            <li><strong>PriceCharting, BrickLink, Rebrickable, Brick Insights, Google Trends, Reddit:</strong> read-only public-data sources we fetch from to build forecasts and signals. They do not receive any personal data about you from us.</li>
            <li><strong>eBay Partner Network:</strong> when you click an outbound eBay link, eBay tracks the click for affiliate-commission purposes.</li>
          </ul>
        </Section>

        <Section n="7" title="Cookies and similar technologies">
          <p>
            We use only strictly necessary first-party cookies required for basic Service
            operation (for example, remembering a one-time dismissal of a disclaimer
            banner). We do not use analytics cookies, advertising cookies, or third-party
            tracking cookies. Because no non-essential cookies are used, no cookie consent
            banner is shown.
          </p>
        </Section>

        <Section n="8" title="Data sharing and sale">
          <p>
            We do not sell or rent personal data. We do not share personal data with third
            parties for their own marketing. We may disclose data when required by law,
            court order, or to protect the rights, property, or safety of {op}, our users,
            or the public.
          </p>
        </Section>

        <Section n="9" title="Data retention">
          <p>
            Server logs are retained for up to 30 days for security and debugging, after
            which they are rotated and deleted. Contact-form submissions are retained for up
            to 12 months so we can follow up on conversations, then deleted. We retain data
            longer only when required by law.
          </p>
        </Section>

        <Section n="10" title="Security">
          <p>
            We use industry-standard safeguards (HTTPS in transit, restricted access to
            production systems, principle of least privilege). No system is perfectly
            secure. You acknowledge that you use the Service at your own risk.
          </p>
        </Section>

        <Section n="11" title="International data transfers">
          <p>
            {op} operates from the United States. If you access the Service from outside
            the US, your data may be processed in the US, which may have data-protection
            laws different from those in your country. By using the Service, you consent to
            this transfer.
          </p>
        </Section>

        <Section n="12" title="Children">
          <p>
            The Service is not directed to children under 13 (or under 16 in the EEA/UK).
            We do not knowingly collect personal data from children. If you believe a child
            has provided us personal data, contact us via the contact form and we will
            delete it.
          </p>
        </Section>

        <Section n="13" title="Your rights">
          <p>
            Depending on your jurisdiction, you may have the right to access, correct,
            delete, or port your personal data, and to object to or restrict certain
            processing. See our{" "}
            <Link href="/privacy-rights" className="text-bright-blue underline">
              Privacy Rights page
            </Link>{" "}
            for the full list of rights and how to exercise them.
          </p>
        </Section>

        <Section n="14" title="Changes to this policy">
          <p>
            We may update this policy from time to time. Material changes will be indicated
            by an updated &ldquo;Last updated&rdquo; date at the top of this page. We
            encourage you to review the policy periodically.
          </p>
        </Section>

        <Section n="15" title="Contact">
          <p>
            For any privacy question or to exercise a privacy right, use our{" "}
            <Link href="/contact" className="text-bright-blue underline">contact form</Link>.
            We will respond within the timelines described on the{" "}
            <Link href="/privacy-rights" className="text-bright-blue underline">
              Privacy Rights page
            </Link>.
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
