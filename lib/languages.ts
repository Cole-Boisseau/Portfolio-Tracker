export const supportedLanguages = [
  { code: "en", locale: "en-US", nativeName: "English" },
  { code: "es", locale: "es-ES", nativeName: "Español" },
  { code: "fr", locale: "fr-FR", nativeName: "Français" },
  { code: "pt", locale: "pt-BR", nativeName: "Português" },
  { code: "zh-CN", locale: "zh-CN", nativeName: "简体中文" },
  { code: "de", locale: "de-DE", nativeName: "Deutsch" },
  { code: "ja", locale: "ja-JP", nativeName: "日本語" }
] as const;

export type LanguageCode = (typeof supportedLanguages)[number]["code"];

export function isLanguageCode(value: unknown): value is LanguageCode {
  return supportedLanguages.some((language) => language.code === value);
}

export function languageLocale(code: LanguageCode) {
  return supportedLanguages.find((language) => language.code === code)?.locale ?? "en-US";
}
