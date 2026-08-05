import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import {
  AdminIcon,
  CampaignIcon,
  NextIcon,
  OrganizerIcon,
  ProfileIcon,
  SettingsIcon,
  SignOutIcon,
} from "@/components/icons";
import { requireProfile } from "@/lib/auth/dal";
import { signOut } from "@/lib/auth/actions";
import { InstallPrompt } from "@/components/install-prompt";
import { ProfileForm } from "./profile-form";

/**
 * Écran Profil — identité, portes vers les autres espaces, réglages.
 *
 * Les trois portes (organisateur, créateur, admin) partagent une seule
 * forme de ligne : c'est la même promesse à chaque fois — une icône, un
 * nom, ce qu'on y fait, un chevron. Seule la teinte de l'icône change,
 * pour qu'on les distingue sans les lire.
 */
export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }

  const profile = await requireProfile();
  const t = await getTranslations("app");
  const tAuth = await getTranslations("auth");
  const tOrganizer = await getTranslations("organizer");
  const tAffiliation = await getTranslations("affiliation");
  const tAdmin = await getTranslations("admin");

  return (
    <main className="relative flex-1 overflow-hidden">
      <span
        aria-hidden
        className="halo inset-x-0 -top-20 h-[240px] opacity-25"
      />

      <div className="relative mx-auto w-full max-w-3xl px-5 pb-10 pt-6">
        <h1 className="font-display text-[30px] font-extrabold uppercase">
          {t("profile")}
        </h1>

        <div className="sheen mt-6 flex items-center gap-4 rounded-card bg-surface p-5">
          <span
            aria-hidden
            className="grad-ember flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white"
          >
            <ProfileIcon size={24} strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <p className="font-display truncate text-[15px] font-extrabold">
              {profile.full_name ?? profile.email}
            </p>
            {profile.full_name && (
              <p className="mt-0.5 truncate text-[13px] text-mist">
                {profile.email}
              </p>
            )}
          </div>
        </div>

        <nav className="mt-3 flex flex-col gap-2.5">
          <SpaceLink
            href="/organisateur"
            icon={<OrganizerIcon size={20} strokeWidth={2.2} />}
            iconClass="bg-brand/15 text-brand-bright"
            title={t("orgSpace")}
            hint={tOrganizer("openSpace")}
          />

          <SpaceLink
            href="/creator"
            icon={<CampaignIcon size={20} strokeWidth={2.2} />}
            iconClass="bg-accent/15 text-accent"
            title={t("infSpace")}
            hint={tAffiliation("creatorSpace")}
          />

          {profile.role === "admin" && (
            <SpaceLink
              href="/admin"
              icon={<AdminIcon size={20} strokeWidth={2.2} />}
              iconClass="bg-white/10 text-fog"
              title={tAdmin("title")}
              hint={tAdmin("readOnlyHint")}
            />
          )}
        </nav>

        <InstallPrompt />

        <section className="mt-8">
          <h2 className="font-display flex items-center gap-2 text-[15px] font-extrabold">
            <SettingsIcon size={16} strokeWidth={2.2} aria-hidden />
            {t("settings")}
          </h2>
          <ProfileForm
            fullName={profile.full_name ?? ""}
            phone={profile.phone ?? ""}
            locale={profile.locale}
          />
        </section>

        <form action={signOut} className="mt-8">
          <button
            type="submit"
            className="press font-display flex w-full items-center justify-center gap-2 rounded-2xl bg-surface px-5 py-3.5 text-[14px] font-extrabold text-danger ring-1 ring-inset ring-white/10 hover:ring-danger/50"
          >
            <SignOutIcon size={16} strokeWidth={2.4} aria-hidden />
            {tAuth("signOut")}
          </button>
        </form>
      </div>
    </main>
  );
}

/** Une porte vers un autre espace du produit. */
function SpaceLink({
  href,
  icon,
  iconClass,
  title,
  hint,
}: {
  href: string;
  icon: ReactNode;
  iconClass: string;
  title: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="press sheen flex items-center gap-4 rounded-card bg-surface p-4 transition-colors hover:bg-surface-high"
    >
      <span
        aria-hidden
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconClass}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-display block text-[15px] font-extrabold">
          {title}
        </span>
        <span className="mt-0.5 block text-[13px] text-mist">{hint}</span>
      </span>
      <NextIcon
        size={18}
        strokeWidth={2.4}
        className="shrink-0 text-smoke"
        aria-hidden
      />
    </Link>
  );
}
