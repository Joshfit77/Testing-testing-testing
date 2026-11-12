export const metadata = { title: "Privacy Policy (Draft)" };

/**
 * Draft for counsel. The facts below are taken from the code (docs/LEGAL_REQUIREMENTS.md and
 * docs/launch-audit/SECURITY_PRIVACY.md list where each one comes from); the bracketed parts are for counsel to
 * complete. Keep this page in step with ios/App/App/PrivacyInfo.xcprivacy and the App Store privacy answers.
 */
export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>Draft last updated: [DATE — to be completed by counsel]</p>
      <h2>What we collect</h2>
      <ul>
        <li>Account data: email address, display name, optional avatar.</li>
        <li>Training profile: age (to confirm adult eligibility and estimate calories), sex (male, female or not specified, used only for calorie estimates), height, weight, goals, experience, equipment, diet style and preferences.</li>
        <li>Activity data you log: workouts, sets, personal records, bodyweight, optional body measurements, nutrition and water.</li>
        <li>
          Runs and walks you record with GPS: your location is read only during a recording you started (including while your phone is locked, if you
          allow it) and is used to work out distance, pace and your route. The simplified route is saved to your account on our database provider
          (Supabase), where only you can see it; it is never used for advertising and is not passed to anyone other than the providers that run the
          service. Location is not read at any other time.
        </li>
        <li>
          Apple Health / Health Connect data, only if you connect it and only the types you allow: daily steps, sleep records (time in bed, time asleep,
          sleep stages where your watch or ring recorded them) and overnight heart rate, heart-rate variability and respiratory rate. We only read; we
          never write to Apple Health or Health Connect. This data is never used for advertising or marketing and is never sold. It is shared with our
          AI provider only as a summary, when you ask the AI coach about sleep or recovery, and only after you have allowed the AI coach to use your data.
        </li>
        <li>
          Optional sensitive wellness information (physical limitation notes, recovery check-ins) — stored only after you give explicit consent, and you
          can withdraw it at any time.
        </li>
        <li>
          Photos you choose to take or upload: progress photos and Body Scan photos (with optional tape measurements) are stored in private storage at
          our storage provider and are visible only to you; no AI analyses them. A meal photo you choose to send for a calorie estimate is sent to our
          AI provider for that request and is not stored by us.
        </li>
        <li>Optional faith journal entries — stored on our database provider, readable only by you (our administrators have no access path to them). An entry is sent to the AI coach only if you mark it &ldquo;Share with AI Coach&rdquo;.</li>
        <li>
          AI coach conversations, AI meal-plan requests and &ldquo;Ask AI about this food&rdquo; questions, which are sent to our AI provider to generate
          responses together with the parts of your account the feature needs (shown to you before you first allow it; you can withdraw this in Profile →
          Privacy &amp; data).
        </li>
        <li>Barcode scans and food searches: the barcode or search text is sent to Open Food Facts and USDA FoodData Central to look the food up.</li>
        <li>Billing status from our payment processors: Stripe for purchases on the website, and Apple or Google (through RevenueCat) for purchases in the app. We do not store card numbers.</li>
      </ul>
      <h2>How we use it</h2>
      <p>To provide and personalize the service, process payments, keep the service secure and comply with law. We do not use advertising or analytics trackers. [Counsel to complete.]</p>
      <h2>Processing by our providers is not selling or sharing for advertising</h2>
      <p>
        Everything above is held and processed by the service providers listed below so that the app can work: our database and storage provider
        holds your account and logs, our AI provider receives the data a feature needs only when you use that feature and after you allow it, and our
        payment processors handle subscriptions. They act on our instructions to provide the service. We do not sell personal data and do not share it
        with anyone for advertising or for their own purposes. [Counsel to confirm the wording and any applicable &ldquo;sale&rdquo; or
        &ldquo;sharing&rdquo; definitions under state law.]
      </p>
      <h2>Processors</h2>
      <p>
        Supabase (database, authentication, storage), Stripe (web payments), RevenueCat with Apple and Google (in-app purchases), Anthropic (AI
        responses), Open Food Facts and USDA FoodData Central (food look-ups), Vercel (hosting). [Counsel to verify and list data processing agreements.]
      </p>
      <h2>Your rights</h2>
      <p>
        You can export all of your data and permanently delete your account from Profile → Privacy &amp; data. Deleting your account removes your data,
        photos and routes from our database and storage; our providers delete their copies under their own retention terms [counsel to confirm with each
        provider&apos;s agreement]. Deleting a single run or walk removes its route immediately.
      </p>
      <h2>Not medical advice</h2>
      <p>Narrow Gate Fitness provides general fitness information and is not a medical service.</p>
      <h2>Contact</h2>
      <p>[Contact details to be added.]</p>
    </>
  );
}
