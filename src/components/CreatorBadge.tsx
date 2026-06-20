import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

export function CreatorBadge({ fixedId }: { fixedId?: string | null }) {
  const { t } = useI18n();
  if (fixedId !== "M4EJPM") return null;

  return (
    <button
      type="button"
      onClick={() => toast(t("creator.title"))}
      className="inline-flex items-center gap-2 rounded-full border border-trust bg-trust/10 px-2.5 py-1 text-xs font-medium text-trust"
      aria-label={t("creator.title")}
      title={t("creator.title")}
    >
      <span className="seven-point-star h-4 w-4 bg-trust" aria-hidden="true" />
      <span>#{fixedId}</span>
    </button>
  );
}