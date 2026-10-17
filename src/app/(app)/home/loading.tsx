import { PageSkeleton } from "@/components/common/page-skeleton";

// Read-only route: safe to suspend on navigation (routes with in-place mutations use the global progress bar instead).
export default function Loading() {
  return <PageSkeleton variant="dashboard" />;
}
