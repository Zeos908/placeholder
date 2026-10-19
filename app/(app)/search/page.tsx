import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchView } from "@/components/search/SearchView";
import { PageHeader } from "@/components/shell/PageHeader";

export const metadata: Metadata = { title: "Search · placeholder" };

export default function SearchPage() {
  return (
    <div className="mx-auto max-w-[600px]">
      <PageHeader title="Search" />
      {/* useSearchParams (initial ?q=) needs a Suspense boundary. */}
      <Suspense>
        <SearchView />
      </Suspense>
    </div>
  );
}
