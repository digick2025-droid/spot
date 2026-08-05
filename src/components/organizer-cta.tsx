import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CampaignIcon, NextIcon, OrganizerIcon } from "./icons";

/**
 * L'appel aux organisateurs et aux creators.
 *
 * Il ne s'adresse qu'à ceux qui ne tiennent pas encore de maison : une
 * fois l'espace organisateur ouvert, la bannière devient du bruit — le
 * lien vit alors dans la barre d'onglets et dans le profil.
 *
 * La braise est réservée au premier des deux appels. Deux boutons de la
 * même intensité ne se choisissent pas : on veut d'abord des gens qui
 * publient, les creators viennent ensuite promouvoir ce qui existe.
 */
export async function OrganizerCta() {
  const t = await getTranslations("app");

  return (
    <section className="sheen relative overflow-hidden rounded-sheet bg-surface p-5">
      <span
        aria-hidden
        className="halo -right-16 -top-16 h-48 w-48 opacity-30"
        style={{ "--halo": "var(--grad-ember)" } as React.CSSProperties}
      />

      <div className="relative">
        <span
          aria-hidden
          className="grad-ember flex h-11 w-11 items-center justify-center rounded-2xl text-white"
        >
          <OrganizerIcon size={20} strokeWidth={2.2} />
        </span>

        <h2 className="font-display mt-3.5 text-[19px] font-extrabold leading-tight">
          {t("becomeOrganizer")}
        </h2>
        <p className="mt-1.5 max-w-[46ch] text-[13px] leading-relaxed text-mist">
          {t("becomeOrganizerHint")}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <Link
            href="/organisateur"
            className="press grad-ember glow-brand font-display inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[13px] font-extrabold text-white"
          >
            {t("createEvent")}
            <NextIcon size={15} strokeWidth={2.6} aria-hidden />
          </Link>

          <Link
            href="/creator"
            className="press inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-bold text-mist ring-1 ring-inset ring-white/12 transition-colors hover:text-white"
          >
            <CampaignIcon size={15} strokeWidth={2.2} aria-hidden />
            {t("infSpace")}
          </Link>
        </div>

        <p className="mt-3 max-w-[46ch] text-[12px] leading-relaxed text-smoke">
          {t("becomeCreatorHint")}
        </p>
      </div>
    </section>
  );
}
