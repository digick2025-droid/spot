import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatEventDateShort, formatPriceXaf } from "@/lib/format";
import { posterUrl } from "@/lib/posters";
import { lowestPrice, type EventSummary } from "@/lib/db/events";

const FALLBACK_GRADIENT = "linear-gradient(135deg,#FF6B35,#C2410C)";

/**
 * La carte d'un événement, tenue comme une pochette d'album.
 *
 * L'affiche est carrée et domine la carte ; le texte se range dessous,
 * dans l'ordre où on le cherche — quand, quoi, où, combien. Derrière,
 * le halo reprend la couleur de l'événement et déborde de la carte :
 * c'est ce qui distingue une soirée d'une autre dans une grille, avant
 * même d'avoir lu le titre.
 */
export async function EventCard({ event }: { event: EventSummary }) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("events");
  const from = lowestPrice(event);
  const poster = posterUrl(event.poster_path);
  const gradient = event.gradient ?? FALLBACK_GRADIENT;

  return (
    <Link
      href={`/evenements/${event.slug}`}
      className="press group relative flex flex-col"
    >
      {/* Le halo vit hors de la carte : celle-ci masque son débordement
          pour arrondir l'affiche, et l'y enfermer le découperait net. */}
      <span
        aria-hidden
        className="halo inset-x-2 top-3 h-1/2 opacity-0 transition-opacity duration-500 group-hover:opacity-55"
        style={{ "--halo": gradient } as React.CSSProperties}
      />

      <div className="sheen relative flex flex-1 flex-col overflow-hidden rounded-card bg-surface">
        {/* L'affiche, quand elle existe ; sinon le dégradé et l'emoji, qui
            restent le repli de toutes les fiches créées sans image. */}
        <div
          className="relative flex aspect-square items-center justify-center overflow-hidden text-4xl"
          style={{ background: gradient }}
          aria-hidden
        >
          {poster ? (
            <Image
              src={poster}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, 280px"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            (event.glyph ?? "🎟")
          )}
        </div>

        <div className="flex flex-1 flex-col p-3.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-bright">
            {formatEventDateShort(event.starts_at, locale)}
          </div>

          <h3 className="font-display mt-1.5 line-clamp-2 text-[15px] font-extrabold leading-snug">
            {event.title}
          </h3>

          <p className="mt-1 line-clamp-1 text-[12px] text-mist">
            {event.city} · {event.venue}
          </p>

          <div className="mt-auto flex items-baseline justify-between gap-2 pt-3">
            <span className="text-[13px] font-bold">
              {Number.isFinite(from)
                ? t("fromPrice", { price: formatPriceXaf(from) })
                : t("freeEntry")}
            </span>
            <span className="truncate text-[11px] text-smoke">
              {event.organizers.name}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
