import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

export function CreatorBadge({ fixedId }: { fixedId?: string | null }) {
  const { t } = useI18n();
  if (fixedId !== "M4EJPM") return null;

  return (
    <button
      type="button"
      onClick={() => toast(t("creator.title"))}
      className="inline-flex items-center justify-center font-mesh text-[#7CF5C4] text-2xl leading-none px-1"
      aria-label={t("creator.title")}
      title={t("creator.title")}
    >
      M
    </button>
  );
}
