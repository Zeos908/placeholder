import type { Metadata } from "next";
import { ProfileView } from "@/components/profile/ProfileView";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${decodeURIComponent(username)} · placeholder` };
}

export default function ProfilePage() {
  return <ProfileView />;
}
