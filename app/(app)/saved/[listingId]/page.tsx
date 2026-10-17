import type { Metadata } from "next";
import { SavedItemView } from "@/components/saved/SavedItemView";

export const metadata: Metadata = { title: "Saved · placeholder" };

export default function SavedItemPage() {
  return <SavedItemView />;
}
