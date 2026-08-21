"use client";

import { useRouter } from "next/navigation";
import { MY_TEAM_COOKIE } from "@/lib/my-team";

// Clears the stored team so the homepage shows the picker again.
export default function ChangeTeamButton({
  label = "Change team",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const clear = () => {
    document.cookie = `${MY_TEAM_COOKIE}=; path=/; max-age=0; samesite=lax`;
    router.refresh();
  };
  return (
    <button type="button" onClick={clear} className={className}>
      {label}
    </button>
  );
}
