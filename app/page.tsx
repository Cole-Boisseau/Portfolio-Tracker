import { Dashboard } from "@/components/dashboard/dashboard";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return <Dashboard userId={session.user.id} />;
}
