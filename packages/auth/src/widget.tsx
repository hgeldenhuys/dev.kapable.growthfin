/**
 * @signaldb/auth/widget - Embeddable Auth Widget
 *
 * Drop-in React component that renders themed login/signup forms inline.
 * Fetches theme config on mount, renders styled form using CSS-in-JS.
 *
 * @example
 * ```tsx
 * import { SignalDBAuth } from '@signaldb-live/auth/widget';
 *
 * function App() {
 *   return (
 *     <SignalDBAuth
 *       orgSlug="myorg"
 *       projectSlug="myproject"
 *       mode="login"
 *       onSuccess={(result) => console.log('Authenticated!', result)}
 *     />
 *   );
 * }
 * ```
 */

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from 'react';

import {
  AuthClient,
  createAuthClient,
  type AuthClientConfig,
  type AuthResult,
  AuthClientError,
} from './index';

import type { ThemeConfig, ThemeColors } from './widget-types';

// ============================================================
// Widget Props
// ============================================================

export interface SignalDBAuthProps extends AuthClientConfig {
  /** Auth mode */
  mode?: 'login' | 'signup';
  /** Called on successful authentication */
  onSuccess?: (result: AuthResult) => void;
  /** Called on error */
  onError?: (error: Error) => void;
  /** Override the theme config (skip fetching) */
  theme?: Partial<ThemeConfig>;
  /** Additional className for the root wrapper */
  className?: string;
  /** Additional style for the root wrapper */
  style?: CSSProperties;
  /** Hide the mode toggle link at bottom */
  hideToggle?: boolean;
  /** Custom footer content */
  footer?: ReactNode;
}

// ============================================================
// Default theme colors (matches server DEFAULT_THEME_CONFIG)
// ============================================================

const DEFAULT_COLORS: ThemeColors = {
  primary: '#2563eb',
  background: '#f9fafb',
  surface: '#ffffff',
  text: '#111827',
  textSecondary: '#6b7280',
  accent: '#2563eb',
  error: '#dc2626',
  border: '#d1d5db',
  inputBg: '#ffffff',
};

// ============================================================
// Widget Component
// ============================================================

export function SignalDBAuth({
  orgSlug,
  projectSlug,
  baseUrl,
  mode: initialMode = 'login',
  onSuccess,
  onError,
  theme: themeOverride,
  className,
  style,
  hideToggle,
  footer,
}: SignalDBAuthProps) {
  const client = useMemo(
    () => createAuthClient({ orgSlug, projectSlug, baseUrl }),
    [orgSlug, projectSlug, baseUrl]
  );

  const [mode, setMode] = useState(initialMode);
  const [theme, setTheme] = useState<Partial<ThemeConfig>>(themeOverride || {});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // Fetch theme on mount (unless overridden)
  useEffect(() => {
    if (themeOverride) return;
    client.getTheme().then(config => {
      if (config && typeof config === 'object') {
        setTheme(config as Partial<ThemeConfig>);
      }
    }).catch(() => { /* ignore, use defaults */ });
  }, [client, themeOverride]);

  const colors = useMemo(() => ({
    ...DEFAULT_COLORS,
    ...(theme.colors || {}),
  }), [theme.colors]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      let result: AuthResult;
      if (mode === 'signup') {
        result = await client.signup(email, password, name || undefined);
      } else {
        result = await client.login(email, password);
      }

      onSuccess?.(result);
    } catch (err) {
      const msg = err instanceof AuthClientError
        ? err.message
        : err instanceof Error ? err.message : 'An error occurred';
      setError(msg);
      onError?.(err instanceof Error ? err : new Error(msg));
    } finally {
      setIsLoading(false);
    }
  }, [mode, email, password, name, client, onSuccess, onError]);

  // Dynamic styles from theme
  const s = useMemo(() => buildStyles(colors, theme), [colors, theme]);

  const showNameField = theme.fields?.showNameField !== false;
  const nameRequired = theme.fields?.nameFieldRequired ?? false;
  const content = mode === 'login' ? theme.content?.login : theme.content?.signup;
  const heading = content?.heading || (mode === 'login' ? 'Sign In' : 'Create Account');
  const buttonText = content?.buttonText || (mode === 'login' ? 'Sign In' : 'Create Account');

  return (
    <div className={className} style={{ ...s.root, ...style }}>
      <div style={s.card}>
        <h2 style={s.heading}>{heading}</h2>
        {content?.subtitle && <p style={s.subtitle}>{content.subtitle}</p>}

        {error && <div style={s.error}>{error}</div>}
        {success && <div style={s.success}>{success}</div>}

        <form onSubmit={handleSubmit} style={s.form}>
          {mode === 'signup' && showNameField && (
            <div>
              <label style={s.label}>
                Name{!nameRequired && <span style={s.optional}> (optional)</span>}
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required={nameRequired}
                placeholder="Your name"
                style={s.input}
              />
            </div>
          )}
          <div>
            <label style={s.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              style={s.input}
            />
          </div>
          <div>
            <label style={s.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={s.input}
            />
          </div>
          <button type="submit" disabled={isLoading} style={s.button}>
            {isLoading ? 'Loading...' : buttonText}
          </button>
        </form>

        {!hideToggle && (
          <p style={s.toggle}>
            {mode === 'login' ? (
              <>Don't have an account?{' '}
                <button onClick={() => setMode('signup')} style={s.link}>Sign up</button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button onClick={() => setMode('login')} style={s.link}>Sign in</button>
              </>
            )}
          </p>
        )}

        {footer}

        {theme.content?.footerText && (
          <p style={s.footer}>{theme.content.footerText}</p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Style builder (converts theme config to CSSProperties)
// ============================================================

function buildStyles(colors: ThemeColors, theme: Partial<ThemeConfig>) {
  const fontFamily = theme.typography?.fontFamily || 'system-ui, -apple-system, sans-serif';
  const fontSize = theme.typography?.baseFontSize || '14px';
  const headingSize = theme.typography?.headingFontSize || '24px';
  const headingWeight = theme.typography?.headingFontWeight || '700';
  const radius = theme.layout?.cardBorderRadius || '12px';
  const padding = theme.layout?.cardPadding || '32px';

  return {
    root: {
      fontFamily,
      fontSize,
      color: colors.text,
      lineHeight: '1.5',
    } as CSSProperties,

    card: {
      background: colors.surface,
      borderRadius: radius,
      padding,
      maxWidth: theme.layout?.cardWidth || '448px',
      width: '100%',
      boxSizing: 'border-box' as const,
    } as CSSProperties,

    heading: {
      fontFamily: theme.typography?.headingFontFamily || fontFamily,
      fontSize: headingSize,
      fontWeight: headingWeight,
      color: colors.text,
      marginBottom: '24px',
      textAlign: (theme.layout?.logoPosition || 'center') as 'center' | 'left',
    } as CSSProperties,

    subtitle: {
      color: colors.textSecondary,
      fontSize,
      marginBottom: '16px',
      textAlign: (theme.layout?.logoPosition || 'center') as 'center' | 'left',
    } as CSSProperties,

    form: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '16px',
    } as CSSProperties,

    label: {
      display: 'block',
      fontSize: '14px',
      fontWeight: '500',
      color: colors.text,
      marginBottom: '4px',
    } as CSSProperties,

    optional: {
      fontWeight: '400',
      color: colors.textSecondary,
    } as CSSProperties,

    input: {
      width: '100%',
      padding: '8px 12px',
      border: `1px solid ${colors.border}`,
      borderRadius: '8px',
      background: colors.inputBg,
      color: colors.text,
      fontFamily,
      fontSize,
      outline: 'none',
      boxSizing: 'border-box' as const,
    } as CSSProperties,

    button: {
      width: '100%',
      padding: '10px 16px',
      background: colors.primary,
      color: '#ffffff',
      border: 'none',
      borderRadius: '8px',
      fontWeight: '500',
      fontSize,
      cursor: 'pointer',
    } as CSSProperties,

    error: {
      padding: '12px',
      background: `${colors.error}1a`,
      border: `1px solid ${colors.error}4d`,
      color: colors.error,
      borderRadius: '8px',
      fontSize: '14px',
      marginBottom: '8px',
    } as CSSProperties,

    success: {
      padding: '12px',
      background: '#0596691a',
      border: '1px solid #0596694d',
      color: '#059669',
      borderRadius: '8px',
      fontSize: '14px',
      marginBottom: '8px',
    } as CSSProperties,

    toggle: {
      textAlign: 'center' as const,
      fontSize: '14px',
      color: colors.textSecondary,
      marginTop: '16px',
    } as CSSProperties,

    link: {
      color: colors.primary,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      textDecoration: 'none',
      fontWeight: '500',
      fontSize: '14px',
      padding: 0,
    } as CSSProperties,

    footer: {
      textAlign: 'center' as const,
      fontSize: '12px',
      color: colors.textSecondary,
      marginTop: '16px',
    } as CSSProperties,
  };
}

// Re-export types for widget consumers
export type { ThemeConfig, ThemeColors } from './widget-types';
export type { AuthResult, AuthClientConfig } from './index';
