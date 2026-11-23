import { redirect } from "next/navigation";
import { getAccess } from "@/lib/access";

export const dynamic = "force-dynamic";
export default async function Home() {
  const access = await getAccess();
  if (!access) redirect("/login");
  redirect(access.role === "director" ? "/directeur" : "/admin");
}
