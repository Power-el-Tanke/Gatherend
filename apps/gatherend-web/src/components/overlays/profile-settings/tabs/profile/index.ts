// Re-export all profile sub-components
export { AvatarSection } from "./avatar-section";
export { UsernameSection } from "./username-section";
export { UsernameColorSection } from "./username-color-section";
export {
  AboutMeSection,
  BadgeSection,
  ProfileTagsSection,
  LanguagesSection,
  AccountInfoSection,
} from "./details-sections";

// Export types
export type {
  UsernameColor,
  ExtendedProfile,
  ProfileSectionProps,
  WithTranslations,
  AvatarSectionProps,
  UsernameSectionProps,
  UsernameColorSectionProps,
  AboutMeSectionProps,
  BadgeSectionProps,
  ProfileTagsSectionProps,
  LanguagesSectionProps,
  AccountInfoSectionProps,
} from "./types";

// Export hooks
export * from "./hooks";
