import type { LocalizedText } from "@/types/apps";

export function localized(text: LocalizedText, lang: "fr" | "en"): string {
  return lang === "fr" ? text.fr : text.en;
}
