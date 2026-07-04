import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

export function FollowButton({ targetUserId }: { targetUserId: string }) {
  const { t } = useI18n();
  const [me, setMe] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setMe(user.id);
      const { data } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId)
        .maybeSingle();
      setFollowing(!!data);
    })();
  }, [targetUserId]);

  if (!me || me === targetUserId) return null;

  async function toggle() {
    if (!me || me === targetUserId) return;
    setBusy(true);
    try {
      if (following) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", me)
          .eq("following_id", targetUserId);
        if (error) toast.error(error.message);
        else setFollowing(false);
      } else {
        const { error } = await supabase
          .from("follows")
          .upsert(
            { follower_id: me, following_id: targetUserId },
            { onConflict: "follower_id,following_id", ignoreDuplicates: true },
          );
        if (error) toast.error(error.message);
        else setFollowing(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
        following
          ? "bg-transparent border-border text-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
          : "bg-primary text-[#1a1a1a] border-primary"
      } disabled:opacity-40`}
    >
      {following ? t("follow.unfollow") : t("follow.follow")}
    </button>
  );
}
