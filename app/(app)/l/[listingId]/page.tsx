import type { Metadata } from "next";
import { SharedPostView } from "@/components/feed/SharedPostView";

export const metadata: Metadata = { title: "Post · placeholder" };

export default function SharedPostPage() {
  return <SharedPostView />;
}
