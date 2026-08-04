import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";
import "../globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Couleur de la barre système, alignée sur le manifeste : installée, la
 * PWA n'a plus de barre d'adresse, et c'est cette teinte qui prolonge la
 * coque sombre jusqu'aux bords de l'écran.
 */
export const viewport: Viewport = {
  themeColor: "#0B0B0F",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    // Sans base, les vignettes Open Graph seraient annoncées en relatif
    // et les robots de WhatsApp ou Facebook ne les résoudraient pas.
    metadataBase: new URL(getSiteUrl()),
    title: t("title"),
    description: t("description"),
  };
}

/**
 * Coque commune aux deux mondes — et rien de plus.
 *
 * Le produit lui-même (barre d'onglets, en-tête) vit dans le groupe
 * `(app)` ; la vitrine publique, qui a son propre en-tête et son pied de
 * page, vit dans `(site)`. Les deux partagent d'ici les polices et la
 * locale, mais aucune chrome — et chacun installe son propre fournisseur
 * next-intl, pour n'embarquer côté client que les messages qui le
 * regardent.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${manrope.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
