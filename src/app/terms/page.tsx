import { getLegalConfig } from "@/lib/legal-config";
import { BrickCard } from "@/components/ui/BrickCard";
import Link from "next/link";

export const metadata = {
  title: "Terms of Use · BricksFuture",
  description: "The terms and conditions that govern your use of BricksFuture.",
};

const LAST_UPDATED = "June 6, 2026";

export default function TermsPage() {
  const cfg = getLegalConfig();
  const op = cfg.operatorName;

  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <p className="type-eyebrow text-slate-500 mb-2">Legal</p>
      <h1 className="type-display-2 text-jet-black mb-2">Terms of Use</h1>
      <p className="type-body-sm text-slate-500 mb-8">Last updated: {LAST_UPDATED}</p>

      <BrickCard compact className="space-y-8">
        <p className="type-body text-slate-700">
          These Terms of Use (&ldquo;Terms&rdquo;) govern your access to and use of{" "}
          <strong className="text-jet-black">{op}</strong> (the &ldquo;Service&rdquo;), operated
          at bricksfuture.com. By accessing or using the Service, you agree to these Terms. If
          you do not agree, do not use the Service.
        </p>

        <Section n="1" title="Eligibility">
          <p>
            You must be at least 18 years old (or the age of majority in your jurisdiction) to
            use the Service. By using the Service, you represent that you meet this requirement.
          </p>
        </Section>

        <Section n="2" title="Description of the Service">
          <p>
            {op} provides educational market-analysis tools, price forecasts, and buying
            signals for sealed LEGO sets. All content is provided for informational and
            educational purposes only. The Service does not require an account.
          </p>
        </Section>

        <Section n="3" title="No financial, investment, or professional advice">
          <p>
            Nothing on the Service constitutes financial, investment, tax, legal, or other
            professional advice. Forecasts, scores, and signals are model outputs based on
            historical data and assumptions described on our{" "}
            <Link href="/methodology" className="text-bright-blue underline">methodology page</Link>.
            Past performance does not guarantee future results. You are solely responsible
            for your own investment, purchase, and resale decisions, and you should consult
            a qualified professional before acting on any information presented here.
          </p>
        </Section>

        <Section n="4" title="Acceptable use">
          <p>You agree not to:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>scrape, crawl, or harvest content from the Service except via official APIs we may publish;</li>
            <li>reverse-engineer, decompile, or attempt to extract the model weights or training data behind our forecasts;</li>
            <li>republish or resell substantial portions of our data, forecasts, scores, or rankings without prior written permission;</li>
            <li>use the Service to harass, defame, or infringe the rights of others;</li>
            <li>interfere with the Service&rsquo;s normal operation, including by attempting unauthorised access, sending malicious code, or overloading our infrastructure;</li>
            <li>misrepresent your identity or submit knowingly false information through any form on the Service.</li>
          </ul>
        </Section>

        <Section n="5" title="Intellectual property">
          <p>
            All content on the Service, including text, graphics, forecasts, composite scores,
            signal classifications, and code, is owned by {op} or its licensors and is
            protected by copyright, trademark, and other intellectual-property laws. You may
            view and print pages for personal, non-commercial reference. No other use is
            permitted without our prior written consent.
          </p>
          <p className="mt-2">
            LEGO® is a registered trademark of the LEGO Group. {op} is not affiliated with,
            endorsed by, sponsored by, or otherwise authorised by the LEGO Group. Other
            third-party marks (PriceCharting, BrickLink, eBay, Rebrickable, Reddit, Google)
            belong to their respective owners and are used here for identification only.
          </p>
        </Section>

        <Section n="6" title="User-submitted content">
          <p>
            When you submit a message via our contact form, you grant {op} a perpetual,
            worldwide, royalty-free licence to use that submission for the purpose of
            responding to you and improving the Service. Do not submit information you wish
            to keep confidential. Do not submit personal data of others without authority.
          </p>
        </Section>

        <Section n="7" title="Affiliate disclosure">
          <p>
            {op} participates in the eBay Partner Network and may earn commissions on
            qualifying purchases originated from links on the Service. Affiliate participation
            does not influence forecast outputs, scores, or signals. We may add or remove
            affiliate programs in the future.
          </p>
        </Section>

        <Section n="8" title="Data sources and accuracy">
          <p>
            Pricing and metadata are sourced from third parties including PriceCharting,
            BrickLink, eBay, Rebrickable, Brick Insights, Google Trends, and Reddit. Data may
            be delayed, incomplete, or inaccurate. We make no representation that any price,
            forecast, or signal is current or correct at the moment you read it. Verify
            independently before making any purchase or sale.
          </p>
        </Section>

        <Section n="9" title="Disclaimer of warranties">
          <p className="uppercase tracking-wide text-slate-700">
            The Service is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without
            warranties of any kind, express or implied, including but not limited to implied
            warranties of merchantability, fitness for a particular purpose, non-infringement,
            and accuracy. {op} does not warrant that the Service will be uninterrupted,
            secure, error-free, or that forecasts will prove correct.
          </p>
        </Section>

        <Section n="10" title="Limitation of liability">
          <p className="uppercase tracking-wide text-slate-700">
            To the maximum extent permitted by law, {op}, its operators, contributors, and
            affiliates shall not be liable for any indirect, incidental, special,
            consequential, exemplary, or punitive damages, or for any loss of profits,
            revenue, data, or goodwill arising out of or in connection with your use of the
            Service, even if advised of the possibility of such damages. {op}&rsquo;s total
            aggregate liability to you for any claim arising out of or relating to the
            Service shall not exceed one hundred US dollars (US$100).
          </p>
        </Section>

        <Section n="11" title="Indemnification">
          <p>
            You agree to indemnify, defend, and hold harmless {op} and its operators from any
            claim, liability, loss, or expense (including reasonable legal fees) arising out
            of your use of the Service, your breach of these Terms, or your violation of any
            law or third-party right.
          </p>
        </Section>

        <Section n="12" title="Third-party links and services">
          <p>
            The Service contains links to third-party websites and services (including eBay,
            BrickLink, LEGO.com, and others). We do not control and are not responsible for
            their content, policies, or practices. Following a third-party link is at your
            own risk.
          </p>
        </Section>

        <Section n="13" title="Modifications to the Service or these Terms">
          <p>
            We may modify, suspend, or discontinue any part of the Service at any time
            without notice. We may also update these Terms from time to time. Material
            changes will be indicated by an updated &ldquo;Last updated&rdquo; date at the
            top of this page. Your continued use of the Service after changes take effect
            constitutes acceptance of the revised Terms.
          </p>
        </Section>

        <Section n="14" title="Termination">
          <p>
            We may suspend or terminate your access to the Service at any time, with or
            without notice, including for violation of these Terms. All provisions that by
            their nature should survive termination (including ownership, disclaimers,
            limitation of liability, and dispute resolution) will survive.
          </p>
        </Section>

        <Section n="15" title="Governing law and dispute resolution">
          <p>
            These Terms are governed by the laws of the State of Delaware, USA, without
            regard to its conflict-of-laws principles. You and {op} agree to first attempt
            to resolve any dispute informally by contacting us via our{" "}
            <Link href="/contact" className="text-bright-blue underline">contact form</Link>{" "}
            and allowing 60 days for a response. If the dispute cannot be resolved
            informally, both parties agree that any claim shall be brought exclusively in
            the state or federal courts located in Delaware, and you consent to personal
            jurisdiction there. To the extent permitted by law, you and {op} waive any right
            to a jury trial and to participate in a class action.
          </p>
        </Section>

        <Section n="16" title="Severability and entire agreement">
          <p>
            If any provision of these Terms is held invalid or unenforceable, the remaining
            provisions will remain in full force. These Terms, together with our{" "}
            <Link href="/privacy" className="text-bright-blue underline">Privacy Policy</Link>{" "}
            and any other policies referenced here, constitute the entire agreement between
            you and {op} regarding the Service.
          </p>
        </Section>

        <Section n="17" title="Contact">
          <p>
            Questions about these Terms? Reach us via our{" "}
            <Link href="/contact" className="text-bright-blue underline">contact form</Link>.
          </p>
        </Section>
      </BrickCard>
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div id={`section-${n}`} className="scroll-mt-24">
      <h2 className="type-h3 text-jet-black mb-2">
        <span className="text-slate-400 mr-2">{n}.</span>
        {title}
      </h2>
      <div className="type-body text-slate-700">{children}</div>
    </div>
  );
}
