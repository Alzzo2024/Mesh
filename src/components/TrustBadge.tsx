import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

function currentVoteWeek() {
  const d = new Date();
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

export function TrustBadge({
  targetUserId,
  initialScore = 0,
  interactive = true,
  compact = false,
}: {
  targetUserId?: string;
  initialScore?: number;
  interactive?: boolean;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const [me, setMe] = useState<string | null>(null);
  const [score, setScore] = useState(initialScore);
  const [votedHere, setVotedHere] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setScore(initialScore);
  }, [initialScore]);

  useEffect(() => {
    if (!targetUserId) return;
    let active = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      setMe(user?.id ?? null);
      const [{ count }, vote] = await Promise.all([
        supabase
          .from("trust_votes")
          .select("*", { count: "exact", head: true })
          .eq("target_user_id", targetUserId),
        user
          ? supabase
              .from("trust_votes")
              .select("target_user_id")
              .eq("voter_id", user.id)
              .eq("vote_week", currentVoteWeek())
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (!active) return;
      setScore(count ?? initialScore);
      setVotedHere(vote.data?.target_user_id === targetUserId);
    })();
    return () => {
      active = false;
    };
  }, [targetUserId, initialScore]);

  async function vote() {
    if (!targetUserId || !me || me === targetUserId || busy || !interactive) return;
    setBusy(true);
    const { error } = await supabase.from("trust_votes").insert({
      voter_id: me,
      target_user_id: targetUserId,
      vote_week: currentVoteWeek(),
    });
    setBusy(false);
    if (error) return toast.error(t("trust.weeklyUsed"));
    setScore((s) => s + 1);
    setVotedHere(true);
    toast.success(t("trust.voted"));
  }

  const className = `inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
    votedHere
      ? "border-trust bg-trust/10 text-trust"
      : "border-border bg-secondary/50 text-muted-foreground"
  } ${interactive && me !== targetUserId ? "cursor-pointer hover:border-trust hover:text-trust" : ""}`;

  const content = (
    <>
      <ShieldCheck className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      <span>{score}</span>
    </>
  );

  if (!interactive || !targetUserId || me === targetUserId) {
    return (
      <span className={className} title={t("trust.title")} aria-label={t("trust.title")}>
        {content}
      </span>
    );
  }

  return (
    <button type="button" onClick={vote} disabled={busy || votedHere} className={className} title={t("trust.give")}>
      {content}
    </button>
  );
}