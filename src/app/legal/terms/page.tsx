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
      <p>Paid plans renew monthly until cancelled. You can cancel at any time from the billing portal; access continues until the end of the paid period. [Counsel to complete refund and consumer-law terms.]</p>
      <h2>Acceptable use</h2>
      <p>[To be completed.]</p>
      <h2>Limitation of liability</h2>
      <p>[To be completed by counsel.]</p>
      <h2>Scripture</h2>
      <ScriptureNotice className="" />
    </>
  );
}
