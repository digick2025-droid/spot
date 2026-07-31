import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { getOwnedOrganizers, getUser } from "@/lib/auth/dal";
import { getUnreadNotificationCount } from "@/lib/db/notifications";
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

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

  // Sert uniquement à décider des onglets affichés : les pages et les
  // Server Actions revérifient les droits pour leur propre compte.
  const [user, ownedOrganizers] = await Promise.all([
    getUser(),
    getOwnedOrganizers(),
  ]);
  const unreadCount = user ? await getUnreadNotificationCount() : 0;

  return (
    <html
      lang={locale}
      className={`${manrope.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>
          <AppHeader isSignedIn={user !== null} unreadCount={unreadCount} />
          {children}
          <BottomNav
            canScan={ownedOrganizers.length > 0}
            isSignedIn={user !== null}
          />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
