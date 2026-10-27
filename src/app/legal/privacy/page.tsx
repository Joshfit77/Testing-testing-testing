import type { Metadata } from "next";
import Link from "next/link";
import { LegalReviewNotice } from "@/components/legal/review-notice";
import { isPrivacyPolicyReady, missingPrivacyPolicyDetails, privacyPolicyConfig as config } from "./policy-config";

const ready = isPrivacyPolicyReady();

export const metadata: Metadata = {
  title: ready ? "Privacy Policy" : "Privacy Policy (Draft)",
  description: "How Narrow Gate Fitness collects, uses, shares, stores and deletes your information, and the choices you have.",
  // Keep unfinished drafts out of search results.
  robots: ready ? undefined : { index: false, follow: false },
};

const linkClass = "text-gold-highlight underline";

const SECTIONS = [
  { id: "collect", title: "Information we collect" },
  { id: "use", title: "How we use your information" },
  { id: "ai-coach", title: "AI coach and our AI provider" },
  { id: "sharing", title: "How we share your information" },
  { id: "security", title: "How we store and protect your information" },
  { id: "retention", title: "How long we keep your information" },
  { id: "choices", title: "Your choices and rights" },
  { id: "export", title: "Exporting your data" },
  { id: "deletion", title: "Deleting your account" },
  { id: "device", title: "Information stored on your device" },
  { id: "offline-edition", title: "Offline edition" },
  { id: "children", title: "Age requirement" },
  { id: "medical", title: "Not medical advice" },
  { id: "changes", title: "Changes to this policy" },
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

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className={linkClass} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

export default function PrivacyPage() {
  const missing = missingPrivacyPolicyDetails();
  const hasContact = Boolean(config.operatorLegalName || config.contactEmail || config.postalAddress);
  return (
    <>
      {!ready && (
        <LegalReviewNotice>
          This privacy policy has not been published. Before publication, the following must be supplied:
          <ul className="mt-2">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </LegalReviewNotice>
      )}

      <header className="space-y-2">
        <h1>Privacy Policy</h1>
        <p>
          {config.effectiveDate ? (
            <>
              Effective date: <time dateTime={config.effectiveDate}>{formatDate(config.effectiveDate)}</time>
            </>
          ) : (
            "Effective date: not yet set — this policy has not been published."
          )}
        </p>
      </header>

      <p>
        This policy explains what information Narrow Gate Fitness (&ldquo;Narrow Gate Fitness&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;)
        collects when you use our website and our iOS and Android apps (together, the &ldquo;service&rdquo;), how we use and share it,
        how long we keep it, and the choices you have.
        {config.operatorLegalName ? ` The service is operated by ${config.operatorLegalName}.` : null}
      </p>

      <section aria-labelledby="summary-title" className="space-y-2 rounded-xl border border-border bg-card p-4">
        <h2 id="summary-title" className="mt-0!">
          The short version
        </h2>
        <ul>
          <li>We collect the information you give us to run your training, nutrition and progress tracking.</li>
          <li>We do not sell your information, show ads, or use third-party analytics or advertising trackers.</li>
          <li>
            When you use the AI coach, your message and a summary of your training data are sent to our AI provider, Anthropic, to
            generate a reply. Faith journal entries and progress photos are never included.
          </li>
          <li>Payments are handled by Stripe. We never receive or store your card number.</li>
          <li>
            You can download your data, withdraw consent for optional wellness information, and delete your account from{" "}
            <strong>Profile → Privacy &amp; data</strong>.
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

      <Section id="collect">
        <p>We collect information you provide directly, information created as you use the service, and limited technical information.</p>

        <h3>Account information</h3>
        <ul>
          <li>Your email address and password, used to create and sign in to your account, confirm your email and reset your password.</li>
          <li>The name you enter when you sign up (your display name), which you can change in your profile.</li>
          <li>
            Confirmation that you are 18 or older and that you accept our terms and this policy. These confirmations are required to sign
            up; we do not store them as separate records.
          </li>
        </ul>
        <p>
          Your password is handled by our authentication provider, Supabase. We do not store it in the app&apos;s own database tables and
          cannot see it.
        </p>

        <h3>Fitness profile</h3>
        <p>During onboarding and in your training preferences we ask for:</p>
        <ul>
          <li>
            Your age (stored as an approximate birth year, used to confirm you are an adult and to estimate calorie needs), height, and
            current weight.
          </li>
          <li>Your sex (male, female, or prefer not to say), used only to estimate calorie needs.</li>
          <li>
            Your primary goal, training experience, the days per week and session length you have available, equipment, preferred training
            styles, diet style and dietary preferences.
          </li>
          <li>Your preferred units, time zone, and whether you want the optional faith features.</li>
        </ul>
        <p>
          From this we calculate estimated daily calorie, protein, carbohydrate, fat and water targets, which you can change. We also
          generate a starter training program for you.
        </p>

        <h3>Training, progress and nutrition data</h3>
        <ul>
          <li>
            Workouts you log, including exercises, sets, reps, weight, time, distance, effort ratings (RPE), notes, and whether you skipped
            an exercise and why (for example, pain, equipment or time). An in-progress workout is saved to your account as you go.
          </li>
          <li>Personal records calculated from your workouts, goals you set, and training programs you save, build or generate.</li>
          <li>Bodyweight entries and optional body measurements (waist, chest, hips, arm, thigh, body-fat percentage and notes).</li>
          <li>Meals and foods you log or plan, meal templates, custom foods you create, nutrition targets, and water intake.</li>
        </ul>

        <h3>Progress photos (optional)</h3>
        <p>
          If you choose to add progress photos, we store each image along with the date, pose, an optional note, and your bodyweight for
          that day if you enter it or have logged it. Before upload, the app resizes and re-encodes each photo on your device, which removes
          embedded metadata such as the photo&apos;s location. Photos are kept in private storage that is restricted to your account, and
          the app shows them to you only through private links that expire. See <SectionLink id="security" /> for who else can technically
          access stored data.
        </p>

        <h3>Optional wellness information (consent required)</h3>
        <p>Two kinds of information are treated as sensitive wellness information and are stored only after you give explicit consent:</p>
        <ul>
          <li>Physical limitation notes you add during onboarding or in your training preferences.</li>
          <li>Recovery check-ins: sleep quality, energy, soreness, stress, optional notes, and the readiness score we calculate from them.</li>
        </ul>
        <p>
          You give consent by ticking a checkbox when you first save this information. You can withdraw it at any time; see{" "}
          <SectionLink id="choices" />. Other things you write, such as workout notes or a reason for skipping an exercise, are not covered
          by this consent, so please avoid including health details there that you would not want stored.
        </p>

        <h3>Faith features (optional)</h3>
        <p>
          If you turn on the faith features, we store the journal entries you write (date, theme, scripture reference, title and text), the
          discipline goals and check-ins you create, and your progress and notes in faith challenges. This information is used only to show
          it back to you. It is never sent to the AI coach and is not shown in our administrative tools.
        </p>

        <h3>AI coach conversations</h3>
        <p>
          If you use the AI coach (available on paid plans), we store your messages, the coach&apos;s replies, any training plans it
          proposes and whether you applied them, and a record of each AI request and its size for usage limits. See{" "}
          <SectionLink id="ai-coach" /> for what is sent to the provider.
        </p>

        <h3>Subscription and payment information</h3>
        <p>
          Paid plans are purchased on our website through Stripe Checkout. Stripe collects your payment details directly; we never receive
          or store your full card number. When you subscribe we send Stripe your email address and account ID, and we store the Stripe
          customer and subscription identifiers, your plan, the subscription status, the renewal or end date, and whether it is set to
          cancel. Billing changes are made through Stripe&apos;s billing portal.
        </p>

        <h3>Food search and barcode scanning</h3>
        <p>
          When you search for a food, the search text is sent from our servers to USDA FoodData Central. When you scan a barcode, the camera
          image is processed on your device to read the barcode number, and only that number is sent from our servers to Open Food Facts.
          Your name, email and account ID are not included in these requests. Foods you choose to log are saved to your account.
        </p>

        <h3>Technical and security information</h3>
        <ul>
          <li>Sign-in session cookies, which keep you signed in and protect your account. We do not use advertising or analytics cookies.</li>
          <li>
            Error logs that record the type of error and when it happened. Our logging is designed to exclude request contents, health data,
            journal text and passwords.
          </li>
          <li>
            Like most online services, our hosting and database providers process technical data such as IP addresses, device and browser
            information, and request times in order to deliver the service, secure it and diagnose problems.
          </li>
        </ul>

        <h3>Exercise demonstration videos</h3>
        <p>
          Some exercise pages may include demonstration videos embedded from YouTube (using its privacy-enhanced mode) or Vimeo. When such a
          video loads, your device connects to that provider, which receives technical information such as your IP address under its own
          privacy policy. Links to search YouTube for form videos open outside the app.
        </p>
      </Section>

      <Section id="use">
        <p>We use your information to:</p>
        <ul>
          <li>Create and secure your account and keep you signed in.</li>
          <li>Provide workout logging, programs, progress tracking, nutrition tracking, badges, reminders and the other features you use.</li>
          <li>Personalize your training program and estimate nutrition targets.</li>
          <li>Generate AI coach replies and proposed plans when you ask for them.</li>
          <li>Process subscriptions and determine which features your plan includes.</li>
          <li>Enforce usage limits, prevent abuse, investigate errors, and keep the service secure and working.</li>
          <li>Comply with legal obligations and enforce our terms.</li>
        </ul>
        <p>
          We do not sell your personal information, use it for advertising, or share it with data brokers. We do not use your fitness,
          wellness or faith information for marketing.
        </p>
      </Section>

      <Section id="ai-coach">
        <p>
          The AI coach is provided using Anthropic&apos;s Claude models. Each time you send the coach a message, our servers send Anthropic:
        </p>
        <ul>
          <li>Your new message and up to 20 earlier messages from the same conversation.</li>
          <li>
            A summary of your training data: preferred units, approximate age, primary goal, experience, available days and session length,
            equipment, preferred training styles, dietary preferences, your active program and progress, your six most recent bodyweight
            entries, your latest readiness score, your nutrition targets, your top estimated one-rep maxes, and your eight most recent
            completed workouts (exercises, sets, top sets, effort ratings, and any skipped exercises with the reason).
          </li>
          <li>Your physical limitation notes, but only if you have given consent for optional wellness information.</li>
          <li>When you ask for a plan, our public exercise catalog so the coach can choose exercises.</li>
        </ul>
        <p>
          We do not include your email address, display name, sex, height, body measurements, progress photos, meal logs or faith content in
          these requests. Anything you type into a message is sent as written, so avoid sharing information you do not want processed.
        </p>
        <p>
          Anthropic processes this information to generate the reply under its own terms and privacy policy (
          <ExternalLink href="https://www.anthropic.com/legal/privacy">anthropic.com/legal/privacy</ExternalLink>). AI replies are general
          information, can be wrong, and are not medical advice. You can delete individual conversations in the coach. Deleting a
          conversation removes it from our database; it does not recall information already sent to Anthropic, which keeps it according to
          its own retention practices.
        </p>
      </Section>

      <Section id="sharing">
        <p>We share information only as described below.</p>
        <h3>Service providers</h3>
        <p>We use the following providers to operate the service. Each receives only what it needs for its role:</p>
        <ul>
          <li>
            <strong>Supabase</strong> — database, authentication and file storage. Stores the account, profile, activity, wellness, faith,
            AI conversation and billing-status information described above, and your progress photos. (
            <ExternalLink href="https://supabase.com/privacy">privacy policy</ExternalLink>)
          </li>
          <li>
            <strong>Vercel</strong> — hosting for our website and servers. Your requests and the information in them pass through its
            infrastructure, along with technical data such as IP addresses. (
            <ExternalLink href="https://vercel.com/legal/privacy-policy">privacy policy</ExternalLink>)
          </li>
          <li>
            <strong>Anthropic</strong> — AI coach replies. Receives the information described in <SectionLink id="ai-coach" />, only when
            you use the coach. (<ExternalLink href="https://www.anthropic.com/legal/privacy">privacy policy</ExternalLink>)
          </li>
          <li>
            <strong>Stripe</strong> — subscription payments. Receives your email address and account ID from us, and the payment details you
            enter in Stripe Checkout. (<ExternalLink href="https://stripe.com/privacy">privacy policy</ExternalLink>)
          </li>
          <li>
            <strong>USDA FoodData Central</strong> — food search. Receives the text of your food searches from our servers, without your
            account details.
          </li>
          <li>
            <strong>Open Food Facts</strong> — barcode lookups. Receives scanned barcode numbers from our servers, without your account
            details. (<ExternalLink href="https://world.openfoodfacts.org/privacy">privacy policy</ExternalLink>)
          </li>
          <li>
            <strong>YouTube and Vimeo</strong> — only if you open an exercise page with an embedded video from them, as described above.
          </li>
        </ul>
        {config.providerProtectionConfirmed && (
          <p>
            These providers are bound by agreements that require them to protect your information with the same or equal protection as
            described in this policy.
          </p>
        )}
        <h3>Other disclosures</h3>
        <ul>
          <li>When you ask us to, for example by opening Stripe&apos;s billing portal.</li>
          <li>
            When we believe in good faith that disclosure is required by law, or necessary to protect the rights, safety or security of our
            users, the public or the service.
          </li>
        </ul>
      </Section>

      <Section id="security">
        <ul>
          <li>Your information is stored with Supabase and sent to and from the service over encrypted HTTPS connections.</li>
          <li>
            Database access rules restrict each record to the account that owns it, and progress photos are kept in private storage that only
            your account can read through the app.
          </li>
          <li>
            Our in-app administrative tools are limited to managing exercises, programs and content, viewing aggregate usage counts, and
            viewing a list of subscriptions with members&apos; display names and plan status. They do not display your health, wellness,
            nutrition, progress photo, faith or AI coach information.
          </li>
          <li>
            Our service providers and the people who administer our infrastructure (for example, through the database provider&apos;s console
            or server credentials) can technically access stored information. We limit that access to what is needed to operate, secure,
            support and troubleshoot the service, or to comply with the law.
          </li>
        </ul>
        <p>No method of storage or transmission is completely secure, and we cannot guarantee absolute security.</p>
      </Section>

      <Section id="retention">
        <ul>
          <li>We keep your information for as long as your account exists, unless you delete it sooner.</li>
          <li>
            You can delete many items yourself at any time, including workouts, bodyweight entries, logged foods, custom foods, progress
            photos, journal entries and AI conversations. Deleted items are removed from our active database.
          </li>
          <li>
            When you withdraw consent for optional wellness information, your limitation notes and recovery check-ins are deleted from our
            active database.
          </li>
          <li>
            When you delete your account, your information is removed from our active database and storage as described in{" "}
            <SectionLink id="deletion" />.
          </li>
          <li>
            Copies may remain for a limited time in backups and logs kept by our infrastructure providers until they are overwritten or expire
            in the ordinary course.
          </li>
          <li>
            Stripe keeps payment and customer records under its own policies and legal obligations, and we may keep billing records where the
            law requires.
          </li>
          <li>Information already sent to Anthropic is retained according to Anthropic&apos;s policies.</li>
        </ul>
      </Section>

      <Section id="choices">
        <ul>
          <li>
            <strong>Access and export.</strong> Download a copy of your data from Profile → Privacy &amp; data. See <SectionLink id="export" />
            .
          </li>
          <li>
            <strong>Correct.</strong> Update your name, units, height, time zone and faith setting in your profile, and your goals, schedule,
            equipment, diet and limitations in your training preferences.
          </li>
          <li>
            <strong>Withdraw wellness consent.</strong> In Profile → Privacy &amp; data, choose to withdraw consent for optional wellness
            information. This deletes your physical limitation notes and all of your recovery check-ins, and we stop storing new ones unless
            you consent again. It does not recall information already sent to the AI coach provider.
          </li>
          <li>
            <strong>Faith features.</strong> You can turn the faith features off in your profile. Turning them off hides them but does not
            delete existing journal entries; delete entries individually or delete your account to remove them.
          </li>
          <li>
            <strong>AI coach.</strong> The AI coach is used only when you send it a message. You can delete conversations at any time.
          </li>
          <li>
            <strong>Reminders.</strong> Workout reminders are scheduled on your device and can be turned off in the app or in your device
            settings.
          </li>
          <li>
            <strong>Delete your account.</strong> See <SectionLink id="deletion" />.
          </li>
        </ul>
        <p>
          Depending on where you live, you may have additional rights, such as the right to request information about how we process your
          data, to object to or restrict certain processing, or to complain to a data protection authority. To make a request, contact us
          using the details in <SectionLink id="contact" />. We may need to verify your identity before acting on a request.
        </p>
      </Section>

      <Section id="export">
        <p>
          Profile → Privacy &amp; data → <strong>Download my data</strong> gives you a JSON file containing your account ID and email, your
          profile and onboarding answers, goals, programs you saved or created, workouts, sets and personal records, bodyweight and
          measurements, recovery check-ins, custom foods, meals and nutrition targets, water entries, AI conversations, messages and usage
          records, faith journal entries, discipline goals and check-ins, challenge progress, progress photo details, and your subscription
          and plan records.
        </p>
        <p>
          Progress photo image files are not embedded in the file. Instead, the export includes a private download link for each photo that
          expires after one hour; export again for fresh links. For programs you created, the export currently includes the program&apos;s
          main details but not its week-by-week exercise layout.
        </p>
      </Section>

      <Section id="deletion">
        <p>You can delete your account in the app from Profile → Privacy &amp; data by typing DELETE to confirm. When you do:</p>
        <ol className="list-decimal space-y-1 pl-6">
          <li>Any active subscription is cancelled with Stripe immediately.</li>
          <li>Your progress photos and any other files stored under your account are deleted from storage.</li>
          <li>
            Your account is deleted from our authentication system, and all database records linked to it — including your profile,
            activity, nutrition, wellness, faith, AI coach and subscription records — are deleted with it.
          </li>
          <li>You are signed out.</li>
        </ol>
        <p>Account deletion cannot be undone. After deletion:</p>
        <ul>
          <li>Copies may remain in provider backups and logs until they expire, as described above.</li>
          <li>
            Stripe keeps its own customer and payment records (including your email address) under its policies; deleting your account does
            not delete them.
          </li>
          <li>Information previously sent to Anthropic is not recalled.</li>
          <li>Information stored locally on your device remains until you clear the app&apos;s data or uninstall it.</li>
        </ul>
        <p>
          If something goes wrong during deletion, the app will tell you. Steps that already finished, such as cancelling your subscription
          or deleting your photos, are not reversed. Please try again or contact us.
        </p>
      </Section>

      <Section id="device">
        <p>The app stores a small amount of information on your device:</p>
        <ul>
          <li>Sign-in session cookies.</li>
          <li>A copy of an in-progress workout, so it is not lost if you close the app or lose your connection.</li>
          <li>Your workout reminder settings, and reminders scheduled through your device&apos;s notification system.</li>
          <li>Display preferences, such as whether the sidebar is collapsed.</li>
          <li>Static app files cached for offline use. Pages containing your personal data are not cached.</li>
        </ul>
        <p>
          The app uses your camera only when you choose to scan a barcode or take a progress photo. We do not use location services or track
          you across other companies&apos; apps or websites.
        </p>
      </Section>

      <Section id="offline-edition">
        <p>
          We may distribute an offline edition of the app for testing. It has no accounts, payments or AI coach, and the information you
          enter is stored only on your device. When you scan a barcode in the offline edition, the barcode number is sent directly from your
          device to Open Food Facts, and the app loads fonts from Google Fonts, which receives technical information such as your IP
          address.
        </p>
      </Section>

      <Section id="children">
        <p>
          Narrow Gate Fitness is intended only for adults aged 18 and over, and we ask you to confirm your age when you sign up and during
          onboarding. We do not knowingly collect information from anyone under 18. If you believe someone under 18 has created an account,
          contact us so we can delete it.
        </p>
      </Section>

      <Section id="medical">
        <p>
          Narrow Gate Fitness provides general fitness, training and nutrition information. It is not a medical service and does not
          diagnose, treat or prevent any condition. Content in the app, including AI coach replies, calorie and nutrition estimates, and
          readiness scores, is not a substitute for advice from a doctor, physical therapist, registered dietitian or other qualified
          professional. Consult a qualified professional before starting a new exercise or nutrition program, and stop exercising if you feel
          pain, dizziness or shortness of breath.
        </p>
      </Section>

      <Section id="changes">
        <p>
          We may update this policy as the service changes. We will post the updated policy on this page and change the effective date
          above. If we make material changes, we will give notice in the app or by email before they take effect.
        </p>
      </Section>

      <Section id="contact">
        {hasContact ? (
          <>
            <p>For privacy questions or requests, contact:</p>
            <address className="not-italic">
              {config.operatorLegalName && <span className="block text-foreground">{config.operatorLegalName}</span>}
              {config.postalAddress && <span className="block whitespace-pre-line">{config.postalAddress}</span>}
              {config.contactEmail && (
                <a href={`mailto:${config.contactEmail}`} className={linkClass}>
                  {config.contactEmail}
                </a>
              )}
            </address>
          </>
        ) : (
          <p>Contact details will be listed here when this policy is published.</p>
        )}
        <p>
          You can also review our{" "}
          <Link href="/legal/terms" className={linkClass}>
            Terms of Service
          </Link>
          .
        </p>
      </Section>
    </>
  );
}
