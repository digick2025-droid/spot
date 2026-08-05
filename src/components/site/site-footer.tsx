import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { LocaleSwitcher } from "@/components/locale-switcher";

/**
 * Pied de page de la vitrine.
 *
 * Les colonnes « Légal » et « Nous joindre » de la maquette n'ont encore
 * aucune destination : elles sont rendues en texte inerte plutôt qu'en
 * liens morts, et redeviendront des `Link` le jour où ces pages
 * existeront.
 */
export async function SiteFooter() {
  const t = await getTranslations("landing.footer");
  const locale = (await getLocale()) as Locale;

  const soon = [
    [t("legal"), [t("legalNotice"), t("terms"), t("privacy"), t("refunds")]],
    [t("reach"), [t("contact"), t("whatsapp"), t("instagram"), t("facebook")]],
  ] as const;

  return (
    <footer className="border-t border-white/10 py-12 text-[0.86rem] text-smoke">
      <div className="mx-auto w-[min(1080px,100%-2.5rem)]">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <span className="font-display text-[1.3rem] font-extrabold tracking-tight text-white">
              <span aria-hidden>
                SP<span className="spot-dot mx-0.5" />T
              </span>
            </span>
            <p className="mt-3 max-w-[30ch]">{t("tagline")}</p>
          </div>

          <div>
            <h2 className="font-display mb-3.5 text-[0.74rem] font-extrabold uppercase tracking-[0.13em] text-mist">
              {t("product")}
            </h2>
            <ul className="grid gap-2">
              <li>
                <Link href="/decouvrir" className="hover:text-brand-bright">
                  {t("discover")}
                </Link>
              </li>
              <li>
                <Link href="/organisateurs" className="hover:text-brand-bright">
                  {t("organizers")}
                </Link>
              </li>
              <li>
                <Link href="/creators" className="hover:text-brand-bright">
                  {t("creators")}
                </Link>
              </li>
              <li>
                <Link href="/pass" className="hover:text-brand-bright">
                  {t("pass")}
                </Link>
              </li>
            </ul>
          </div>

          {soon.map(([heading, items]) => (
            <div key={heading}>
              <h2 className="font-display mb-3.5 text-[0.74rem] font-extrabold uppercase tracking-[0.13em] text-mist">
                {heading}
              </h2>
              <ul className="grid gap-2">
                {items.map((item) => (
                  <li key={item} title={t("soon")} className="text-smoke/70">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5 border-t border-white/10 pt-6 text-[0.8rem]">
          <span>{t("rights")}</span>
          <LocaleSwitcher current={locale} />
        </div>
      </div>
    </footer>
  );
}
