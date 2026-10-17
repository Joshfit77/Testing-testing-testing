export const metadata = { title: "Privacy Policy (Draft)" };

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>Draft last updated: [DATE — to be completed by counsel]</p>
      <h2>What we collect</h2>
      <ul>
        <li>Account data: email address, display name.</li>
        <li>Training profile: age (to confirm adult eligibility and estimate calories), sex (male, female or not specified, used only for calorie estimates), height, weight, goals, experience, equipment, diet style and preferences.</li>
        <li>Activity data you log: workouts, sets, personal records, bodyweight, optional body measurements, optional progress photos (stored privately; visible only to you), nutrition and water.</li>
        <li>
          Optional sensitive wellness information (physical limitation notes, recovery check-ins) — stored only after you give explicit
          consent, and you can withdraw it at any time.
        </li>
        <li>Optional faith journal entries — private to you and never visible to administrators.</li>
        <li>AI coach conversations, which are sent to our AI provider to generate responses.</li>
        <li>Billing status from our payment processor (Stripe). We do not store card numbers.</li>
      </ul>
      <h2>How we use it</h2>
      <p>To provide and personalize the service, process payments, keep the service secure and comply with law. [Counsel to complete.]</p>
      <h2>Processors</h2>
      <p>Supabase (database, authentication, storage), Stripe (payments), Anthropic (AI responses), USDA FoodData Central (food search queries), Vercel (hosting). [Counsel to verify and list data processing agreements.]</p>
      <h2>Your rights</h2>
      <p>You can export all of your data and permanently delete your account from Profile → Privacy &amp; data.</p>
      <h2>Not medical advice</h2>
      <p>Narrow Gate Fitness provides general fitness information and is not a medical service.</p>
      <h2>Contact</h2>
      <p>[Contact details to be added.]</p>
    </>
  );
}
