import posthog from 'posthog-js';

let isInitialized = false;

export function initPostHog() {
  if (typeof window !== 'undefined' && !isInitialized) {
    // Use a demo/test API key for now - replace with actual key in production
    posthog.init('phc_demo_key', {
      api_host: 'https://app.posthog.com',
      loaded: (posthog) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('PostHog initialized');
        }
      },
      autocapture: false, // We'll manually capture events
      capture_pageview: false, // We'll manually capture page views
    });
    isInitialized = true;
  }
}

export function trackEvent(eventName: string, properties?: Record<string, any>) {
  if (typeof window !== 'undefined') {
    posthog.capture(eventName, properties);
  }
}

export function trackPageView(page: string) {
  if (typeof window !== 'undefined') {
    posthog.capture('$pageview', { page });
  }
}

export { posthog };
