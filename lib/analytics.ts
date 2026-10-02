'use client';

import { supabase } from '@/lib/supabase-client';

export type AnalyticsEventType =
  | 'view_motor'
  | 'click_whatsapp'
  | 'open_simulator'
  | 'submit_simulator'
  | 'submit_lead'
  | 'schedule_visit';

export type AnalyticsSource =
  | 'homepage'
  | 'catalog'
  | 'motor_detail'
  | 'simulator'
  | 'landing_pekalongan'
  | 'landing_pemalang'
  | 'landing_batang';

export function trackEvent(
  eventType: AnalyticsEventType,
  source: AnalyticsSource,
  metadata?: Record<string, unknown>
) {
  try {
    supabase.from('analytics_events').insert({
      event_type: eventType,
      source,
      metadata: metadata || null,
    }).then(({ error }) => {
      if (error) console.warn('Analytics track failed:', error.message);
    });
  } catch (e) {
    // Silent fail - analytics should never break the UI
  }
}

export function trackLead(
  source: AnalyticsSource,
  motorSlug?: string,
  metadata?: Record<string, unknown>
) {
  trackEvent('submit_lead', source, { motor_slug: motorSlug, ...metadata });
}
