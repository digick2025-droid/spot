"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  removeCreatorSocial,
  saveCreatorSocial,
} from "@/lib/db/creator-profile-actions";
import { initialCreatorProfileState } from "@/lib/db/creator-profile-state";
import { SOCIAL_NETWORKS, type CreatorSocial } from "@/lib/db/creator-networks";
import { AudienceIcon, DeleteIcon } from "@/components/icons";

/**
 * L'audience déclarée, réseau par réseau.
 *
 * DÉCLARÉE : SPOT n'interroge aucune API de réseau social. L'écran le
 * dit, et le dira tant que ce sera vrai — un organisateur qui choisit un
 * creator sur la foi de ces chiffres doit savoir d'où ils viennent.
 *
 * Un seul formulaire pour ajouter comme pour corriger : le même réseau
 * saisi deux fois écrase la ligne précédente (contrainte d'unicité par
 * couple creator/réseau), ce qui évite un mode « édition » séparé.
 */
export function CreatorSocialsForm({ socials }: { socials: CreatorSocial[] }) {
  const t = useTranslations("creatorProfile");
  const [state, action, pending] = useActionState(
    saveCreatorSocial,
    initialCreatorProfileState
  );

  return (
    <div className="mt-5">
      {socials.length > 0 && (
        <ul className="flex flex-col gap-2">
          {socials.map((social) => (
            <li
              key={social.network}
              className="flex items-center gap-3 rounded-2xl bg-ink px-4 py-3 ring-1 ring-inset ring-white/[0.06]"
            >
              <span className="font-display w-24 shrink-0 text-[13px] font-extrabold">
                {t(`networks.${social.network}`)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-mist">
                @{social.handle}
              </span>
              <span className="font-display flex items-center gap-1.5 text-[14px] font-extrabold">
                <AudienceIcon size={14} strokeWidth={2.2} aria-hidden />
                {social.followersCount.toLocaleString("fr-FR")}
              </span>
              <form action={removeCreatorSocial}>
                <input type="hidden" name="network" value={social.network} />
                <button
                  type="submit"
                  aria-label={t("removeNetwork")}
                  className="press rounded-full p-2 text-smoke hover:text-danger"
                >
                  <DeleteIcon size={15} strokeWidth={2.2} aria-hidden />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="mt-4 flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto]">
          <label className="flex flex-col gap-2">
            <span className="text-[12px] text-mist">{t("networkLabel")}</span>
            <select
              name="network"
              required
              className="rounded-2xl bg-ink px-4 py-3.5 text-[15px] text-white ring-1 ring-inset ring-white/10 focus:outline-none focus:ring-brand"
            >
              {SOCIAL_NETWORKS.map((network) => (
                <option key={network} value={network}>
                  {t(`networks.${network}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[12px] text-mist">{t("socialHandleLabel")}</span>
            <input
              name="handle"
              required
              maxLength={60}
              placeholder="mon_compte"
              className="rounded-2xl bg-ink px-4 py-3.5 text-[15px] text-white ring-1 ring-inset ring-white/10 placeholder:text-smoke focus:outline-none focus:ring-brand"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[12px] text-mist">{t("followersLabel")}</span>
            <input
              name="followers"
              type="number"
              inputMode="numeric"
              min={0}
              max={500000000}
              defaultValue={0}
              className="rounded-2xl bg-ink px-4 py-3.5 text-[15px] text-white ring-1 ring-inset ring-white/10 focus:outline-none focus:ring-brand sm:w-36"
            />
          </label>
        </div>

        {state.error && (
          <p
            role="alert"
            className="rounded-xl bg-danger/10 px-4 py-3 text-[13px] text-danger ring-1 ring-inset ring-danger/40"
          >
            {state.error}
          </p>
        )}
        {state.notice && (
          <p
            role="status"
            className="rounded-xl bg-success/10 px-4 py-3 text-[13px] text-success ring-1 ring-inset ring-success/40"
          >
            {state.notice}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="press grad-night font-display self-start rounded-2xl px-5 py-3 text-[14px] font-extrabold text-white disabled:opacity-60"
        >
          {pending ? t("saving") : t("addNetwork")}
        </button>
      </form>
    </div>
  );
}
