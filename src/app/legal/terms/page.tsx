import { ScriptureNotice } from "@/components/faith/scripture-notice";
export const metadata = { title: "Terms of Service (Draft)" };

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p>Draft last updated: [DATE — to be completed by counsel]</p>
      <h2>Eligibility</h2>
      <p>You must be 18 or older to use Narrow Gate Fitness at launch.</p>
      <h2>Health disclaimer</h2>
      <p>
        Exercise involves risk. Consult a qualified healthcare professional before beginning any exercise or nutrition program,
        especially if you have a medical condition, injury, are pregnant or take medication. Stop exercising if you feel pain,
        dizziness or shortness of breath. Content, including AI coach responses, is general information and not medical advice,
        diagnosis or treatment.
      </p>
      <h2>Subscriptions</h2>
      <p>Paid plans renew monthly (or yearly, where offered) until cancelled. Plans bought on the website are cancelled from the billing portal; plans bought in the app are managed and cancelled in your Apple or Google account. Access continues until the end of the paid period. [Counsel to complete refund and consumer-law terms, including App Store and Google Play purchases.]</p>
      <h2>Acceptable use</h2>
      <p>[To be completed.]</p>
      <h2>Limitation of liability</h2>
      <p>[To be completed by counsel.]</p>
      <h2>Scripture</h2>
      <ScriptureNotice className="" />
    </>
  );
}
