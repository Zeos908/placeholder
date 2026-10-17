import type { Metadata } from "next";
import { PassedView } from "@/components/saved/PassedView";

export const metadata: Metadata = { title: "Passed · placeholder" };

export default function PassedPage() {
  return <PassedView />;
}
