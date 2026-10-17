import { redirect } from "next/navigation";

// The proxy sends signed-out visitors to /login; everyone else starts on the Feed.
export default function Home() {
  redirect("/feed");
}
