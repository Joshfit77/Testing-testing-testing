import { ScriptureNotice } from "@/components/faith/scripture-notice";

export const metadata = { title: "Notices & attributions" };

/** Data sources, Scripture and open-source software the app uses, with the attributions their licenses ask for. */
export default function NoticesPage() {
  return (
    <>
      <h1>Notices &amp; attributions</h1>
      <h2>Food data</h2>
      <p>
        Product information from barcode scans comes from <a href="https://world.openfoodfacts.org" className="text-gold-highlight underline">Open Food Facts</a>, a
        collaborative, free and open database made available under the{" "}
        <a href="https://opendatacommons.org/licenses/odbl/1-0/" className="text-gold-highlight underline">Open Database License (ODbL)</a>; individual contents are under
        the <a href="https://opendatacommons.org/licenses/dbcl/1-0/" className="text-gold-highlight underline">Database Contents License</a>, and product images under{" "}
        <a href="https://creativecommons.org/licenses/by-sa/3.0/" className="text-gold-highlight underline">CC BY-SA</a>. Open Food Facts data can be incomplete or out
        of date; always check the label.
      </p>
      <p>
        Food search uses the U.S. Department of Agriculture&apos;s{" "}
        <a href="https://fdc.nal.usda.gov" className="text-gold-highlight underline">FoodData Central</a> (public domain, CC0). USDA doesn&apos;t endorse this app.
      </p>
      <h2>Scripture</h2>
      <ScriptureNotice className="" />
      <h2>Open-source software</h2>
      <p>
        Narrow Gate Fitness is built with open-source software, including Next.js, React, Supabase, Capacitor and Radix UI (MIT and Apache-2.0 licenses), and
        the Capacitor Health plugin (<a href="https://github.com/Cap-go/capacitor-health" className="text-gold-highlight underline">@capgo/capacitor-health</a>,
        Mozilla Public License 2.0, whose source is available at that link). The full license texts are included with each package.
      </p>
      <h2>Trademarks</h2>
      <p>Apple Health, HealthKit and App Store are trademarks of Apple Inc.; Google Play and Health Connect are trademarks of Google LLC. Other names belong to their owners.</p>
    </>
  );
}
