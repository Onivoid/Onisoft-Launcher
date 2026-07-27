import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ROUTES } from "@/constants";

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <section className="stage-enter flex min-h-[70vh] flex-col items-start justify-center gap-4 px-10">
      <h1 className="font-display text-6xl text-foreground">{t("notFound.title")}</h1>
      <h2 className="text-xl text-muted-foreground">{t("notFound.subtitle")}</h2>
      <p className="text-muted-foreground/80">{t("notFound.description")}</p>
      <Link to={ROUTES.HOME} className="cta-launch mt-4">
        {t("notFound.backHome")}
      </Link>
    </section>
  );
}
