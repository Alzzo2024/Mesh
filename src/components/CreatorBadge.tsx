import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

export function CreatorBadge({ fixedId }: { fixedId?: string | null }) {
  const { t } = useI18n();
  if (fixedId !== "M4EJPM") return null;

  return (
    <button
      type="button"
      onClick={() => toast(t("creator.title"))}
      className="inline-flex items-center justify-center rounded-full border border-trust bg-trust/10 p-1.5 text-trust"
      aria-label={t("creator.title")}
      title={t("creator.title")}
    >
      <span className="seven-point-star h-4 w-4 bg-trust" aria-hidden="true" />
    </button>
  );
}
