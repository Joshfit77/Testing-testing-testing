import type { Metadata } from "next";
import Link from "next/link";
import { ContactDetails, EffectiveDate, ExternalLink, legalLinkClass as linkClass, UnpublishedNotice } from "@/components/legal/legal-parts";
import { isTermsReady, missingTermsDetails, termsConfig as config } from "./terms-config";

const ready = isTermsReady();

export const metadata: Metadata = {
  title: ready ? "Terms of Service" : "Terms of Service (Draft)",
  description: "The terms that apply when you use Narrow Gate Fitness, including subscriptions, the AI coach and health information.",
  // Keep unfinished drafts out of search results.
  robots: ready ? undefined : { index: false, follow: false },
};

const SECTIONS = [
  { id: "agreement", title: "Agreement to these terms" },
  { id: "eligibility", title: "Eligibility and your account" },
  { id: "health", title: "Health and safety" },
  { id: "service", title: "The service" },
  { id: "ai-coach", title: "AI coach" },
  { id: "nutrition", title: "Nutrition information" },
  { id: "subscriptions", title: "Subscriptions and billing" },
  { id: "your-content", title: "Your content" },
  { id: "acceptable-use", title: "Acceptable use" },
  { id: "our-content", title: "Our content" },
  { id: "termination", title: "Ending your use of the service" },
  { id: "disclaimers", title: "Disclaimers" },
  { id: "liability", title: "Limitation of liability" },
  { id: "indemnity", title: "Indemnity" },
  { id: "law", title: "Governing law" },
  { id: "changes", title: "Changes to these terms" },
  { id: "general", title: "General" },
  { id: "contact", title: "Contact us" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function Section({ id, children }: { id: SectionId; children: React.ReactNode }) {
  const title = SECTIONS.find((s) => s.id === id)!.title;
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6 space-y-3">
      <h2 id={`${id}-title`}>{title}</h2>
      {children}
    </section>
  );
}

function SectionLink({ id }: { id: SectionId }) {
  return (
    <a href={`#${id}`} className={linkClass}>
      {SECTIONS.find((s) => s.id === id)!.title}
    </a>
  );
}

function PrivacyLink() {
  return (
    <Link href="/legal/privacy" className={linkClass}>
      Privacy Policy
    </Link>
  );
}

export default function TermsPage() {
  const operator = config.operatorLegalName ?? "Narrow Gate Fitness";
  return (
    <>
      {!ready && <UnpublishedNotice missing={missingTermsDetails()} />}

      <header className="space-y-2">
        <h1>Terms of Service</h1>
        <EffectiveDate date={config.effectiveDate} />
      </header>

      <section aria-labelledby="summary-title" className="space-y-2 rounded-xl border border-border bg-card p-4">
        <h2 id="summary-title" className="mt-0!">
          The short version
        </h2>
        <ul>
          <li>You must be 18 or older to use Narrow Gate Fitness.</li>
          <li>
            Exercise carries risk. The app, including the AI coach, gives general fitness information, not medical advice. Check with a
            qualified professional before starting a new program.
          </li>
          <li>Paid plans renew automatically until you cancel. When you cancel, you keep access until the end of the period you paid for.</li>
          <li>Your logs, photos and journal entries are yours. You can export them or delete your account at any time.</li>
          <li>
            This summary is for convenience; the full terms below apply. Our <PrivacyLink /> explains how we handle your information.
          </li>
        </ul>
      </section>

      <nav aria-labelledby="toc-title" className="space-y-2">
        <h2 id="toc-title">Contents</h2>
        <ol className="list-decimal space-y-1 pl-6">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <SectionLink id={s.id} />
            </li>
          ))}
        </ol>
      </nav>

      <Section id="agreement">
        <p>
          These Terms of Service (&ldquo;terms&rdquo;) are an agreement between you and {operator} (&ldquo;we&rdquo;, &ldquo;us&rdquo;)
          covering your use of the Narrow Gate Fitness website and iOS and Android apps (together, the &ldquo;service&rdquo;). By creating
          an account or using the service, you agree to these terms and acknowledge our <PrivacyLink />. If you do not agree, do not use the
          service.
        </p>
      </Section>

      <Section id="eligibility">
        <ul>
          <li>You must be at least 18 years old to create an account or use the service.</li>
          <li>You must give accurate information when you sign up and keep your email address up to date.</li>
          <li>
            You are responsible for keeping your password secure and for activity on your account. Tell us promptly if you believe your
            account has been accessed without permission.
          </li>
          <li>Accounts are personal. Do not share your account or create an account for someone else.</li>
        </ul>
      </Section>

      <Section id="health">
        <p>
          <strong>
            Exercise involves a risk of injury. Narrow Gate Fitness is not a medical service and does not diagnose, treat or prevent any
            condition.
          </strong>
        </p>
        <ul>
          <li>
            Consult a qualified healthcare professional before beginning any exercise or nutrition program, especially if you have a medical
            condition or injury, are pregnant, or take medication.
          </li>
          <li>Stop exercising and seek medical help if you feel pain, dizziness, chest pain or shortness of breath.</li>
          <li>
            Programs, exercise instructions, calorie and nutrition estimates, readiness scores and AI coach responses are general information.
            They are not tailored medical advice and do not replace a doctor, physical therapist, registered dietitian or other qualified
            professional.
          </li>
          <li>
            You choose which exercises to do, at what intensity, and with what equipment. Use proper form, warm up, and use a spotter or
            safety equipment where appropriate.
          </li>
        </ul>
      </Section>

      <Section id="service">
        <p>
          The service lets you follow and build training programs, log workouts and progress, track nutrition and water, use an optional
          faith and discipline section, and, on paid plans, use an AI coach. Some features are available only on certain plans; the Plans
          &amp; billing page shows what each plan includes.
        </p>
        <p>
          We are continually improving the service and may add, change or remove features. We may also temporarily limit or switch off
          features, for example for maintenance or security. We will try to give notice of significant changes that reduce what a paid
          plan includes.
        </p>
        <p>
          We may distribute an offline edition of the app for testing. It stores information only on your device and has no accounts,
          payments or AI coach. If you lose or reset your device, that information may be lost.
        </p>
      </Section>

      <Section id="ai-coach">
        <ul>
          <li>
            The AI coach generates responses automatically using a third-party AI model. Responses can be inaccurate, incomplete or
            unsuitable for you. Use your own judgment and do not rely on them for medical, nutritional or safety decisions.
          </li>
          <li>
            The coach can propose training plans, but they are only added to your account if you review and approve them. You are
            responsible for the plans you choose to follow.
          </li>
          <li>
            Each paid plan includes a monthly allowance of AI messages (and, on Pro, plan generations), shown on the Plans &amp; billing
            page. Allowances reset at the start of each calendar month (UTC) and unused messages do not carry over. Short-term rate limits
            also apply.
          </li>
          <li>
            Do not use the coach to seek help with anything unlawful or harmful, or to try to get around its safety guidelines. Information
            you send is shared with our AI provider as described in our <PrivacyLink />.
          </li>
        </ul>
      </Section>

      <Section id="nutrition">
        <p>
          Food information comes from USDA FoodData Central, Open Food Facts (a crowd-sourced database whose values are entered by
          volunteers), our own curated list, and foods you enter. We do not verify third-party food data, and it may be wrong or out of
          date. Always check the product label, especially if you have allergies or dietary restrictions. Calorie and macronutrient targets
          are estimates.
        </p>
      </Section>

      <Section id="subscriptions">
        <h3>Plans and prices</h3>
        <p>
          Narrow Gate Fitness offers a free plan and a paid Pro plan, billed monthly or yearly. Current prices and what each plan includes
          are shown on the Plans &amp; billing page and at checkout. Prices are in US dollars. The earlier Plus plan is no longer offered to
          new members; existing Plus subscriptions continue on their current terms until cancelled.
        </p>
        <h3>Payment</h3>
        <ul>
          <li>
            Paid plans are purchased on our website and processed by Stripe. By subscribing, you authorize recurring charges to your payment
            method and agree to Stripe&apos;s terms for the payment (
            <ExternalLink href="https://stripe.com/legal/consumer">stripe.com/legal/consumer</ExternalLink>).
          </li>
          <li>Subscriptions cannot currently be purchased inside the iOS or Android apps.</li>
          <li>Promotion codes, when offered, are subject to any conditions stated with them and have no cash value.</li>
        </ul>
        <h3>Automatic renewal</h3>
        <p>
          <strong>
            Your subscription renews automatically at the end of each billing period (monthly or yearly) and you will be charged the
            then-current price until you cancel.
          </strong>{" "}
          If we change the price of your plan, we will tell you before the change applies to your next renewal, and you can cancel before
          then.
        </p>
        <h3>Cancelling</h3>
        <ul>
          <li>
            You can cancel at any time from Profile → Plans &amp; billing → Manage billing. Cancellation takes effect at the end of the current
            billing period, and you keep paid access until then.
          </li>
          <li>
            If a payment fails, we may keep your paid access for a short time while Stripe retries the payment. If payment is not completed,
            your account moves to the free plan. Your data is kept.
          </li>
          <li>
            Deleting your account cancels any subscription immediately and ends paid access at once, without waiting for the end of the
            billing period.
          </li>
        </ul>
        <h3>Refunds</h3>
        <p>
          Cancelling stops future charges but does not refund past ones. Except where required by law, payments are non-refundable,
          including for unused time after cancellation or account deletion. If you believe you were charged in error, or you are entitled to
          a refund under the law where you live, contact us using the details in <SectionLink id="contact" />. Nothing in these terms
          limits any rights you have under applicable consumer law.
        </p>
      </Section>

      <Section id="your-content">
        <ul>
          <li>
            You keep ownership of the content you add to the service, such as workout logs, notes, measurements, progress photos, journal
            entries and messages to the AI coach (&ldquo;your content&rdquo;).
          </li>
          <li>
            You give us a limited, non-exclusive, royalty-free licence to store, process, display and transmit your content only as needed to
            operate and provide the service to you, including sending it to our service providers as described in our <PrivacyLink />. This
            licence ends when you delete the content or your account, except for copies kept as described in the <PrivacyLink />.
          </li>
          <li>
            Only upload content you have the right to use. Progress photos must be of you. Do not upload images of other people or explicit
            content.
          </li>
          <li>You can export your content or delete your account at any time from Profile → Privacy &amp; data.</li>
        </ul>
      </Section>

      <Section id="acceptable-use">
        <p>You agree not to:</p>
        <ul>
          <li>Break the law, or use the service to harm, harass or deceive anyone.</li>
          <li>Access another person&apos;s account or data, or try to get around security, access controls, usage limits or plan restrictions.</li>
          <li>Probe, scan or test the service for vulnerabilities without our written permission, or interfere with its operation.</li>
          <li>Scrape, copy or harvest data or content from the service using automated means, except through features we provide.</li>
          <li>Copy, resell or redistribute our programs, devotionals, exercise media or other content, or use the service to build a competing product.</li>
          <li>Upload malicious code, or content that is unlawful, infringing, sexually explicit, hateful or that violates someone&apos;s privacy.</li>
          <li>Misuse the AI coach, including trying to make it produce harmful content.</li>
        </ul>
      </Section>

      <Section id="our-content">
        <p>
          The service and its content, including the app&apos;s design, software, training programs, exercise instructions, devotionals and
          the Narrow Gate Fitness name and logo, belong to us or our licensors and are protected by law. We give you a personal,
          non-transferable, revocable licence to use them through the service for your own non-commercial use while you follow these terms.
        </p>
        <p>
          Some exercise images and videos are provided by third parties under their own licences, and some may be embedded from services
          such as YouTube or Vimeo, whose terms apply when you view them. Scripture quotations are from the King James Version.
        </p>
      </Section>

      <Section id="termination">
        <ul>
          <li>
            You can stop using the service at any time and delete your account from Profile → Privacy &amp; data. What happens to your
            information is explained in our <PrivacyLink />.
          </li>
          <li>
            We may suspend or end your access if you seriously or repeatedly break these terms, if we must do so by law, or to protect the
            service or other users. Where reasonable, we will tell you why and give you a chance to export your data first.
          </li>
          <li>
            If we stop offering the service entirely, we will give reasonable advance notice so you can export your data.
          </li>
          <li>
            Sections that by their nature should continue after these terms end (including your content licence for retained copies,
            disclaimers, limitation of liability, indemnity and governing law) will continue.
          </li>
        </ul>
      </Section>

      <Section id="disclaimers">
        <p>
          To the fullest extent permitted by law, the service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. We do not
          promise that the service will be uninterrupted, error-free or secure, that information in it (including AI coach responses and
          food data) will be accurate or complete, or that using it will achieve any particular fitness, weight or health result. We
          disclaim all implied warranties, including merchantability, fitness for a particular purpose and non-infringement, except where
          they cannot be excluded by law.
        </p>
      </Section>

      <Section id="liability">
        <p>
          To the fullest extent permitted by law, we will not be liable for any indirect, incidental, special, consequential or punitive
          damages, or for loss of data, profits or goodwill, arising out of or relating to the service or these terms. Our total liability
          for all claims relating to the service or these terms will not exceed the amount you paid us for the service in the 12 months
          before the event giving rise to the claim.
        </p>
        <p>
          Nothing in these terms excludes or limits liability that cannot be excluded or limited by law, such as liability for death or
          personal injury caused by our negligence, for fraud, or your rights under consumer protection laws. Some jurisdictions do not allow
          certain exclusions or limitations, so some of the above may not apply to you.
        </p>
      </Section>

      <Section id="indemnity">
        <p>
          To the extent permitted by law, you agree to indemnify us against claims, losses and reasonable costs (including legal fees)
          brought by third parties arising from your breach of these terms or your misuse of the service.
        </p>
      </Section>

      <Section id="law">
        <p>
          {config.governingLaw
            ? `These terms are governed by the laws of ${config.governingLaw}, without regard to its conflict-of-laws rules. `
            : "The law that governs these terms will be stated here when they are published. "}
          If you live in a country or state whose consumer protection laws give you the right to bring a claim in your local courts or
          under your local law, nothing in these terms takes away that right.
        </p>
      </Section>

      <Section id="changes">
        <p>
          We may update these terms as the service changes or as the law requires. We will post the updated terms on this page and change
          the effective date above. If a change materially affects your rights, we will give notice in the app or by email before it takes
          effect. If you keep using the service after the changes take effect, you accept the updated terms; if you do not agree, you can
          cancel your subscription and delete your account.
        </p>
      </Section>

      <Section id="general">
        <ul>
          <li>These terms and our Privacy Policy are the entire agreement between you and us about the service.</li>
          <li>If any part of these terms is found unenforceable, the rest stays in effect.</li>
          <li>If we do not enforce a part of these terms right away, we have not waived our right to do so later.</li>
          <li>
            You may not transfer your rights under these terms without our consent. We may transfer ours as part of a merger, acquisition
            or sale of the service, and will tell you if that happens.
          </li>
          <li>We are not responsible for delays or failures caused by events beyond our reasonable control.</li>
        </ul>
      </Section>

      <Section id="contact">
        <p>For questions about these terms, contact:</p>
        <ContactDetails name={config.operatorLegalName} email={config.contactEmail} address={config.postalAddress} />
      </Section>
    </>
  );
}
