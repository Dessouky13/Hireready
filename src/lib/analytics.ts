// Analytics wrapper — swap PostHog for any provider without changing call sites
// Set VITE_POSTHOG_KEY in .env to enable

declare global {
  interface Window {
    posthog?: {
      capture: (event: string, props?: Record<string, unknown>) => void;
      identify: (id: string, traits?: Record<string, unknown>) => void;
    };
  }
}

export const track = (event: string, props?: Record<string, unknown>) => {
  try {
    window.posthog?.capture(event, props);
  } catch {
    // Never let analytics break the app
  }
};

export const identify = (userId: string, traits?: Record<string, unknown>) => {
  try {
    window.posthog?.identify(userId, traits);
  } catch {
    // Never let analytics break the app
  }
};

// Key events to track throughout the app
export const Events = {
  INTERVIEW_STARTED: "interview_started",
  INTERVIEW_COMPLETED: "interview_completed",
  INTERVIEW_ABANDONED: "interview_abandoned",
  REPORT_VIEWED: "report_viewed",
  REPORT_PRINTED: "report_printed",
  CREDITS_PAGE_VIEWED: "credits_page_viewed",
  SIGNUP_COMPLETED: "signup_completed",
} as const;
