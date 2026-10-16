import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton({ variant = "dashboard" }: { variant?: "dashboard" | "list" | "detail" }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <span className="sr-only" role="status">
        Loading…
      </span>
      <Skeleton className="h-10 w-64" />
      {variant === "dashboard" && (
        <>
          <Skeleton className="h-48 rounded-3xl" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-72 lg:col-span-2" />
            <Skeleton className="h-72" />
          </div>
        </>
      )}
      {variant === "list" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      )}
      {variant === "detail" && (
        <>
          <Skeleton className="h-56 rounded-3xl" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </>
      )}
    </div>
  );
}
