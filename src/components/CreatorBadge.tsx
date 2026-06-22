import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

export function CreatorBadge({ fixedId }: { fixedId?: string | null }) {
  const { t } = useI18n();
  if (fixedId !== "M4EJPM") return null;

  return (
    <button
      type="button"
      onClick={() => toast(t("creator.title"))}
      className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#7CF5C4] bg-[#7CF5C4]/15 font-mesh text-[#7CF5C4] text-base leading-none"
      aria-label={t("creator.title")}
      title={t("creator.title")}
    >
      M
    </button>
  );
}
