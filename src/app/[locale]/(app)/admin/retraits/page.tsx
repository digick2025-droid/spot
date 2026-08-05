import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { BackIcon, MobileMoneyIcon } from "@/components/icons";
import { requireAdmin } from "@/lib/auth/dal";
import {
  listAdminWithdrawals,
  type AdminWithdrawal,
} from "@/lib/db/admin-withdrawals";
import { formatEventDate, formatPriceXaf } from "@/lib/format";
import { SettleForm } from "./settle-form";

/**
 * Les retraits à régler.
 *
 * Cette page est la seule de l'administration à écrire, et c'est assumé :
 * le modèle de retrait retenu suppose un geste humain — SPOT envoie
 * l'argent depuis son compte Mobile Money, puis vient le noter ici. Sans
 * cet écran, une demande resterait ouverte indéfiniment et bloquerait le
 * solde de l'organisateur.
 *
 * Elle vit à part de la console à sept onglets, qui reste en lecture
 * seule : mélanger un tableau qu'on lit et un tableau qui agit rendrait
 * l'un et l'autre plus difficiles à faire évoluer.
 */
export default async function AdminWithdrawalsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }

  await requireAdmin();
  const activeLocale = (await getLocale()) as Locale;
  const t = await getTranslations("money");

  const withdrawals = await listAdminWithdrawals();
  const open = withdrawals.filter((w) => w.status === "requested");
  const settled = withdrawals.filter((w) => w.status !== "requested");

  return (
    <main className="theme-paper flex-1 bg-paper text-ink">
      <div className="mx-auto w-full max-w-4xl px-5 pb-10 pt-6 sm:px-6">
        <Link
          href="/admin"
          className="press inline-flex items-center gap-1.5 text-[13px] font-semibold text-smoke hover:text-brand"
        >
          <BackIcon size={15} strokeWidth={2.2} aria-hidden />
          {t("backToAdmin")}
        </Link>

        <h1 className="font-display mt-4 flex items-center gap-2 text-[22px] font-extrabold uppercase">
          <MobileMoneyIcon size={20} strokeWidth={2.2} aria-hidden />
          {t("adminTitle")}
        </h1>
        <p className="mt-2 max-w-[70ch] text-[13px] text-smoke">
          {t("adminHint")}
        </p>

        <h2 className="font-display mt-8 text-[17px] font-extrabold">
          {t("adminOpen", { count: open.length })}
        </h2>

        {open.length === 0 ? (
          <p className="sheet mt-4 rounded-card p-8 text-center text-[13px] text-smoke">
            {t("adminNothingOpen")}
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {open.map((withdrawal) => (
              <li key={withdrawal.id} className="sheet rounded-card p-4">
                <WithdrawalHead withdrawal={withdrawal} locale={activeLocale} />
                <div className="mt-4">
                  <SettleForm withdrawalId={withdrawal.id} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {settled.length > 0 && (
          <>
            <h2 className="font-display mt-10 text-[17px] font-extrabold">
              {t("adminHistory")}
            </h2>
            <ul className="mt-4 flex flex-col gap-2">
              {settled.map((withdrawal) => (
                <li key={withdrawal.id} className="sheet rounded-card p-4">
                  <WithdrawalHead withdrawal={withdrawal} locale={activeLocale} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}

const STATUS_KEY: Record<AdminWithdrawal["status"], string> = {
  requested: "statusRequested",
  paid: "statusPaid",
  rejected: "statusRejected",
};

const STATUS_STYLE: Record<AdminWithdrawal["status"], string> = {
  requested: "text-warning",
  paid: "text-success",
  rejected: "text-danger",
};

/**
 * L'en-tête d'une demande : à qui, combien, sur quel numéro.
 *
 * Le numéro est affiché en entier, à dessein : c'est ce que l'admin
 * recopie dans son application Mobile Money. Le masquer obligerait à
 * aller le chercher ailleurs, et une somme envoyée au mauvais numéro ne
 * revient pas.
 */
async function WithdrawalHead({
  withdrawal,
  locale,
}: {
  withdrawal: AdminWithdrawal;
  locale: Locale;
}) {
  const t = await getTranslations("money");

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="font-mono text-[12px] text-smoke">
        {withdrawal.reference}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-bold">
          {withdrawal.beneficiary}
        </span>
        <span className="block truncate text-[12px] text-smoke">
          {t(withdrawal.kind === "organizer" ? "kindOrganizer" : "kindCreator")} ·{" "}
          {withdrawal.target}
        </span>
      </span>
      <span className="text-right">
        <span className="font-display block text-[17px] font-extrabold">
          {formatPriceXaf(withdrawal.amountXaf)}
        </span>
        <span className="block text-[12px] text-smoke">
          {withdrawal.phone} ·{" "}
          {t(withdrawal.channel === "mtn_momo" ? "mtn" : "orange")}
        </span>
      </span>
      <span
        className={`text-[12px] font-bold ${STATUS_STYLE[withdrawal.status]}`}
      >
        {t(STATUS_KEY[withdrawal.status])}
      </span>
      <span className="w-full text-[11px] text-smoke">
        {formatEventDate(withdrawal.settledAt ?? withdrawal.createdAt, locale)}
      </span>
    </div>
  );
}
