import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/* Shows an "Admin console" entry only for accounts with the admin role. */
export function AdminLink({ onNavigate }: { onNavigate: () => void }) {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", auth.user.id).eq("role", "admin").maybeSingle();
      if (alive) setIsAdmin(!!data);
    })();
    return () => { alive = false; };
  }, []);
  if (!isAdmin) return null;
  return (
    <Link
      to="/admin"
      onClick={onNavigate}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm !text-[#2D3436] dark:!text-[#E8E8E8] hover:bg-[#F4A261]/10 transition-colors"
    >
      Admin console
    </Link>
  );
}
