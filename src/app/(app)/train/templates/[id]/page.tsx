import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { TemplateEditor } from "@/components/workout/template-editor";
import { toEditorValue } from "@/lib/domain/workout-templates";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { loadCatalogItems } from "@/server/services/exercise-catalog-items";
import { getTemplate } from "@/server/services/templates";

export const metadata = { title: "Edit workout" };

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const [template, catalog] = await Promise.all([getTemplate(supabase, user.id, id), loadCatalogItems(supabase)]);
  if (!template) notFound();
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <BackLink href="/train/templates">My workouts</BackLink>
      <PageHeader title="Edit workout" description={template.name} />
      <TemplateEditor templateId={template.id} initial={toEditorValue(template, profile.unit_system)} catalog={catalog} units={profile.unit_system} />
    </div>
  );
}
