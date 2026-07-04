import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./login/signout-button";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <span className="text-sm text-gray-500">{user?.email}</span>
        <SignOutButton />
      </header>
      <main className="flex flex-1 items-center justify-center">
        <p className="text-gray-400">Sesión iniciada. Todavía no hay nada más aquí.</p>
      </main>
    </div>
  );
}
