import { PageSkeleton } from "@/components/common/page-skeleton";

// The My Progress hub only, through the (hub) route group: a loading.tsx directly in progress/ would also wrap every
// page below it, including those with in-place mutations, which must not suspend (IMPLEMENTATION_STATUS.md, "Loading
// boundaries"). Like Home, the hub's only mutations are the steps card's, which refresh without revalidatePath.
export default function Loading() {
  return <PageSkeleton variant="list" />;
}
