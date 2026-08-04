import { getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getUser } from "@/lib/auth/dal";
import { OtpForm } from "./otp-form";

export default async function ConnexionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }

  // Déjà connecté : rien à faire ici.
  if (await getUser()) {
    redirect({ href: "/accueil", locale });
  }

  const t = await getTranslations("auth");

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{
          background: "radial-gradient(circle, #ff6b35 0%, transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="font-display text-2xl font-extrabold tracking-tight">
          SP<span className="spot-dot mx-0.5" aria-hidden />T
        </div>

        <h1 className="font-display mt-8 text-3xl font-extrabold uppercase tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-mist">
          {t("subtitle")}
        </p>

        <OtpForm />
      </div>
    </main>
  );
}
