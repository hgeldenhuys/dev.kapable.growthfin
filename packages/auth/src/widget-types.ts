/**
 * Theme Config Types (client-side subset)
 *
 * These mirror the server-side types in apps/auth/src/theme/types.ts
 * without any server dependencies.
 */

export interface ThemeConfig {
  template: 'centered-card' | 'split-screen' | 'full-width' | 'minimal';
  colorMode: 'light' | 'dark' | 'auto';
  colors: ThemeColors;
  darkColors?: Partial<ThemeColors>;
  typography: ThemeTypography;
  layout: ThemeLayout;
  content: ThemeContent;
  fields: ThemeFields;
  customCss?: string;
}

export interface ThemeColors {
  primary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  accent: string;
  error: string;
  border: string;
  inputBg: string;
}

export interface ThemeTypography {
  fontFamily: string;
  headingFontFamily?: string;
  baseFontSize: string;
  headingFontSize: string;
  fontWeight: string;
  headingFontWeight: string;
}

export interface ThemeLayout {
  cardWidth: string;
  cardBorderRadius: string;
  cardShadow: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  cardPadding: string;
  logoSize: string;
  logoPosition: 'center' | 'left';
  backgroundImageUrl?: string;
  splitImageUrl?: string;
}

export interface ThemeContent {
  login: { heading?: string; subtitle?: string; buttonText?: string };
  signup: { heading?: string; subtitle?: string; buttonText?: string };
  reset: { heading?: string; subtitle?: string; buttonText?: string };
  footerText?: string;
  termsUrl?: string;
  privacyUrl?: string;
}

export interface ThemeFields {
  showNameField: boolean;
  nameFieldRequired: boolean;
  oauthButtonStyle: 'icon' | 'full' | 'outline';
  oauthButtonOrder?: string[];
}
