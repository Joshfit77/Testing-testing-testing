import { PageSkeleton } from "@/components/common/page-skeleton";

// Read-only route: safe to suspend on navigation (routes with in-place mutations use the global progress bar instead).
// Reserves the page's space while it streams, so content doesn't jump in.
export default function Loading() {
  return <PageSkeleton variant="list" />;
}
