import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Keyword or reference search. A plain GET form, so it works before scripts load. */
export function BibleSearchForm({ defaultValue, testament, autoFocus }: { defaultValue?: string; testament?: string; autoFocus?: boolean }) {
  return (
    <form action="/faith/bible/search" method="get" role="search" className="flex gap-2">
      <label htmlFor="bible-q" className="sr-only">
        Search the Bible
      </label>
      <Input id="bible-q" name="q" type="search" defaultValue={defaultValue} placeholder="Words or a reference, e.g. John 3:16" maxLength={100} autoFocus={autoFocus} enterKeyHint="search" className="min-w-0 flex-1" />
      {testament && <input type="hidden" name="t" value={testament} />}
      <Button type="submit" size="icon" aria-label="Search">
        <Search aria-hidden />
      </Button>
    </form>
  );
}
