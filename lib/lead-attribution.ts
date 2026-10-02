/**
 * Dynamic lead attribution system.
 *
 * Captures first-touch attribution from UTM parameters, page context, route, and referrer.
 * Attribution is immutable once captured — we never overwrite the original source.
 * Last-touch data (landing_page, last_touch_page) is stored separately.
 */

export type SourceType =
  | 'website'
  | 'landing_page'
  | 'whatsapp'
  | 'social'
  | 'paid'
  | 'walk_in'
  | 'phone'
  | 'referral'
  | 'event'
  | 'manual'
  | 'other';

export type SourcePage =
  | 'homepage'
  | 'pekalongan'
  | 'pemalang'
  | 'batang'
  | 'credit_simulator'
  | 'vehicle_detail'
  | 'catalog'
  | 'simulasi_kredit'
  | 'contact'
  | 'other';

export interface LeadAttribution {
  source: string;
  source_type: SourceType | null;
  source_page: SourcePage | null;
  source_campaign: string | null;
  source_medium: string | null;
  source_content: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  landing_page: string | null;
  last_touch_page: string | null;
  campaign: string | null;
}

export interface AttributionContext {
  /** Explicit page context passed by the component (highest priority) */
  pageContext?: SourcePage;
  /** Explicit source type override (e.g. 'whatsapp' for WhatsApp links) */
  sourceTypeOverride?: SourceType;
  /** Explicit campaign info */
  campaignName?: string;
  medium?: string;
}

const STORAGE_KEY = 'lead_first_touch';
const STORAGE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface StoredAttribution {
  data: LeadAttribution;
  timestamp: number;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function detectSourcePageFromPath(pathname: string): SourcePage {
  if (pathname === '/' || pathname === '') return 'homepage';
  if (pathname.startsWith('/honda-pekalongan')) return 'pekalongan';
  if (pathname.startsWith('/honda-pemalang')) return 'pemalang';
  if (pathname.startsWith('/honda-batang')) return 'batang';
  if (pathname.startsWith('/simulasi-kredit')) return 'credit_simulator';
  if (pathname.startsWith('/motor/')) return 'vehicle_detail';
  if (pathname === '/kontak' || pathname.startsWith('/kontak')) return 'contact';
  return 'other';
}

function detectSourceTypeFromUTM(utm: {
  source: string | null;
  medium: string | null;
}): SourceType | null {
  const src = utm.source?.toLowerCase() || '';
  const med = utm.medium?.toLowerCase() || '';

  if (src === 'facebook' || src === 'instagram' || src === 'tiktok' || src === 'twitter' || src === 'linkedin') {
    return 'social';
  }
  if (med === 'cpc' || med === 'paid' || med === 'ppc' || med === 'paid_social' || src === 'google_ads' || src === 'facebook_ads') {
    return 'paid';
  }
  if (src === 'whatsapp' || med === 'whatsapp') {
    return 'whatsapp';
  }
  if (med === 'organic' || med === 'referral') {
    return 'referral';
  }
  return null;
}

function detectSourceMediumFromUTM(utmSource: string | null, utmMedium: string | null): string | null {
  const src = utmSource?.toLowerCase() || '';
  const med = utmMedium?.toLowerCase() || '';
  if (med) return med;
  if (src === 'facebook') return 'facebook';
  if (src === 'instagram') return 'instagram';
  if (src === 'tiktok') return 'tiktok';
  if (src === 'whatsapp') return 'whatsapp';
  return null;
}

function detectSocialMedium(utmSource: string | null, referrer: string | null): string | null {
  const src = utmSource?.toLowerCase() || '';
  const ref = referrer?.toLowerCase() || '';

  if (src === 'facebook' || ref.includes('facebook')) return 'facebook';
  if (src === 'instagram' || ref.includes('instagram')) return 'instagram';
  if (src === 'tiktok' || ref.includes('tiktok')) return 'tiktok';
  if (src === 'twitter' || ref.includes('twitter') || ref.includes('x.com')) return 'twitter';
  if (src === 'linkedin' || ref.includes('linkedin')) return 'linkedin';
  return null;
}

function detectSourceFromReferrer(referrer: string | null): { source_type: SourceType | null; source_medium: string | null } {
  if (!referrer) return { source_type: null, source_medium: null };
  const ref = referrer.toLowerCase();
  if (ref.includes('facebook')) return { source_type: 'social', source_medium: 'facebook' };
  if (ref.includes('instagram')) return { source_type: 'social', source_medium: 'instagram' };
  if (ref.includes('tiktok')) return { source_type: 'social', source_medium: 'tiktok' };
  if (ref.includes('twitter') || ref.includes('x.com')) return { source_type: 'social', source_medium: 'twitter' };
  if (ref.includes('linkedin')) return { source_type: 'social', source_medium: 'linkedin' };
  if (ref.includes('google') || ref.includes('bing') || ref.includes('yahoo')) return { source_type: 'referral', source_medium: 'organic' };
  if (ref.includes('whatsapp')) return { source_type: 'whatsapp', source_medium: 'whatsapp' };
  return { source_type: null, source_medium: null };
}

/**
 * Capture first-touch attribution from the current URL and referrer.
 * Stores in sessionStorage so it persists across page navigation but not across sessions.
 * Once captured, the first-touch data is immutable — subsequent calls won't overwrite it.
 */
export function captureFirstTouch(ctx?: AttributionContext): LeadAttribution {
  if (!isBrowser()) {
    return buildAttribution(null, null, ctx);
  }

  // Check for existing stored attribution
  const existing = getStoredAttribution();
  if (existing) {
    // Update last_touch_page but keep first-touch immutable
    const updated: LeadAttribution = {
      ...existing,
      last_touch_page: detectSourcePageFromPath(window.location.pathname),
    };
    storeAttribution(updated);
    return updated;
  }

  // First visit — capture attribution
  const searchParams = new URLSearchParams(window.location.search);
  const utmSource = searchParams.get('utm_source');
  const utmMedium = searchParams.get('utm_medium');
  const utmCampaign = searchParams.get('utm_campaign');
  const utmContent = searchParams.get('utm_content');
  const utmTerm = searchParams.get('utm_term');
  const referrer = document.referrer || null;
  const pathname = window.location.pathname;

  const attribution = buildAttributionFromCurrent(
    pathname,
    { utmSource, utmMedium, utmCampaign, utmContent, utmTerm, referrer },
    ctx
  );

  storeAttribution(attribution);
  return attribution;
}

function buildAttributionFromCurrent(
  pathname: string,
  utm: {
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmContent: string | null;
    utmTerm: string | null;
    referrer: string | null;
  },
  ctx?: AttributionContext
): LeadAttribution {
  const pageFromPath = detectSourcePageFromPath(pathname);
  const sourcePage = ctx?.pageContext || pageFromPath;

  // Determine source_type by priority:
  // 1. Explicit override
  // 2. UTM-based detection
  // 3. Referrer-based detection
  // 4. Route-based fallback
  let sourceType: SourceType | null = ctx?.sourceTypeOverride || null;

  const utmSourceType = detectSourceTypeFromUTM({ source: utm.utmSource, medium: utm.utmMedium });
  if (!sourceType) sourceType = utmSourceType;

  const referrerDetection = detectSourceFromReferrer(utm.referrer);
  if (!sourceType) sourceType = referrerDetection.source_type;

  // If still no source_type, infer from page
  if (!sourceType) {
    if (sourcePage === 'pekalongan' || sourcePage === 'pemalang' || sourcePage === 'batang') {
      sourceType = 'landing_page';
    } else {
      sourceType = 'website';
    }
  }

  // Determine source_medium
  let sourceMedium = ctx?.medium || detectSourceMediumFromUTM(utm.utmSource, utm.utmMedium);
  if (!sourceMedium && sourceType === 'social') {
    sourceMedium = detectSocialMedium(utm.utmSource, utm.referrer);
  }
  if (!sourceMedium && referrerDetection.source_medium) {
    sourceMedium = referrerDetection.source_medium;
  }

  // Determine campaign
  const sourceCampaign = ctx?.campaignName || utm.utmCampaign || null;

  // Determine source_content
  const sourceContent = utm.utmContent || null;

  // Determine the `source` field (backward-compatible legacy field)
  let source: string;
  if (sourceType === 'social') {
    source = sourceMedium || 'social';
  } else if (sourceType === 'paid') {
    source = 'paid';
  } else if (sourceType === 'whatsapp') {
    source = 'whatsapp';
  } else if (sourceType === 'landing_page') {
    source = `landing_${sourcePage}`;
  } else if (sourcePage === 'credit_simulator') {
    source = 'simulator';
  } else if (sourcePage === 'vehicle_detail') {
    source = 'motor_detail';
  } else if (sourcePage === 'catalog') {
    source = 'catalog';
  } else if (sourcePage === 'homepage') {
    source = 'homepage';
  } else {
    source = sourceType;
  }

  return {
    source,
    source_type: sourceType,
    source_page: sourcePage,
    source_campaign: sourceCampaign,
    source_medium: sourceMedium,
    source_content: sourceContent,
    utm_source: utm.utmSource,
    utm_medium: utm.utmMedium,
    utm_campaign: utm.utmCampaign,
    utm_content: utm.utmContent,
    utm_term: utm.utmTerm,
    landing_page: sourcePage,
    last_touch_page: sourcePage,
    campaign: sourceCampaign,
  };
}

function buildAttribution(pathname: string | null, referrer: string | null, ctx?: AttributionContext): LeadAttribution {
  if (!isBrowser()) {
    const page = ctx?.pageContext || 'homepage';
    return {
      source: 'homepage',
      source_type: ctx?.sourceTypeOverride || 'website',
      source_page: page,
      source_campaign: ctx?.campaignName || null,
      source_medium: ctx?.medium || null,
      source_content: null,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_content: null,
      utm_term: null,
      landing_page: page,
      last_touch_page: page,
      campaign: ctx?.campaignName || null,
    };
  }
  return buildAttributionFromCurrent(
    pathname || window.location.pathname,
    { utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null, referrer },
    ctx
  );
}

function getStoredAttribution(): LeadAttribution | null {
  if (!isBrowser()) return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: StoredAttribution = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > STORAGE_EXPIRY_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function storeAttribution(data: LeadAttribution): void {
  if (!isBrowser()) return;
  try {
    const stored: StoredAttribution = { data, timestamp: Date.now() };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // sessionStorage might be unavailable (private mode)
  }
}

/**
 * Get the current attribution for lead submission.
 * Merges first-touch (immutable, from sessionStorage) with last-touch (current page).
 */
export function getAttribution(ctx?: AttributionContext): LeadAttribution {
  if (!isBrowser()) {
    return buildAttribution(null, null, ctx);
  }

  const stored = getStoredAttribution();
  if (stored) {
    // Return first-touch with updated last_touch_page
    return {
      ...stored,
      last_touch_page: detectSourcePageFromPath(window.location.pathname),
    };
  }

  // No stored first-touch — capture now
  return captureFirstTouch(ctx);
}

/**
 * Reset attribution (useful for testing or after a lead is submitted).
 */
export function resetAttribution(): void {
  if (!isBrowser()) return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}


