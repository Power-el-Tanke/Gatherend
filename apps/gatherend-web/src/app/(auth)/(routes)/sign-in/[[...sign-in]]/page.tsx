import { CustomSignIn } from "@/components/auth/custom-sign-in";
import { getServerSession } from "@/lib/auth/server-session";
import { redirect } from "next/navigation";

export default async function Page() {
  const session = await getServerSession();
  if (session?.userId) {
    redirect("/boards");
  }

  return (
    <div className="h-full flex items-center justify-center py-12 px-4">
      <CustomSignIn />
    </div>
  );
}
