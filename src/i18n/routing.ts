import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "en"],
  defaultLocale: "fr",
  // "/" sert le français ; "/en" sert l'anglais
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
