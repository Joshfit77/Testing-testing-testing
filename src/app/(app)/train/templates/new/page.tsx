import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { TemplateEditor } from "@/components/workout/template-editor";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { loadCatalogItems } from "@/server/services/exercise-catalog-items";

export const metadata = { title: "New workout" };

export default async function NewTemplatePage() {
  const { profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const catalog = await loadCatalogItems(supabase);
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <BackLink href="/train/templates">My workouts</BackLink>
      <PageHeader title="New workout" description="Build a workout you can start again any time." />
      <TemplateEditor templateId={null} initial={{ name: "", notes: "", exercises: [] }} catalog={catalog} units={profile.unit_system} />
    </div>
  );
}
