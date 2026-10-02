import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  type: string;
  otr: number;
  image: string | null;
  popular: boolean;
  featured: boolean;
  status: string;
  stock_status: string;
  stock_quantity: number;
  last_stock_update: string | null;
  description: string | null;
  short_description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  sort_order: number;
  reservation_status: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductImage = {
  id: string;
  product_id: string;
  storage_path: string;
  public_url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductColor = {
  id: string;
  product_id: string;
  name: string;
  hex_color: string | null;
  image: string | null;
  stock: number;
  sort_order: number;
  status: string;
  created_at: string;
};

export type FinancingProvider = {
  id: string;
  name: string;
  code: string | null;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type FinancingPlan = {
  id: string;
  product_id: string;
  provider_id: string | null;
  dp: number;
  tenor35: number;
  tenor47: number;
  tenor_months: number | null;
  installment_amount: number | null;
  admin_fee: number | null;
  insurance_fee: number | null;
  provider: string | null;
  valid_from: string | null;
  valid_until: string | null;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  city: string | null;
  product_id: string | null;
  motor_name: string | null;
  dp: number | null;
  tenor: number | null;
  installment: number | null;
  message: string | null;
  source: string | null;
  campaign: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  landing_page: string | null;
  source_type: string | null;
  source_page: string | null;
  source_campaign: string | null;
  source_medium: string | null;
  source_content: string | null;
  last_touch_page: string | null;
  status: string;
  assigned_to: string | null;
  follow_up_at: string | null;
  priority: string;
  customer_id: string | null;
  converted_at: string | null;
  converted_by: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadEvent = {
  id: string;
  lead_id: string;
  user_id: string | null;
  event_type: string;
  note: string | null;
  created_at: string;
};

export type Visit = {
  id: string;
  lead_id: string | null;
  customer_name: string;
  customer_phone: string;
  product_id: string | null;
  motor_name: string | null;
  visit_date: string;
  visit_time: string;
  visit_type: string;
  notes: string | null;
  sales_person: string | null;
  sales_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type VisitHistory = {
  id: string;
  visit_id: string;
  old_date: string | null;
  old_time: string | null;
  new_date: string | null;
  new_time: string | null;
  old_status: string | null;
  new_status: string | null;
  reason: string | null;
  changed_by: string | null;
  created_at: string;
};

export type Promo = {
  id: string;
  name: string;
  description: string | null;
  banner: string | null;
  image: string | null;
  discount_amount: number | null;
  bonus: string | null;
  valid_from: string | null;
  valid_until: string | null;
  status: string;
  priority: number;
  created_at: string;
  updated_at: string;
};

export type Faq = {
  id: string;
  question: string;
  answer: string;
  category: string;
  sort_order: number;
  status: string;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type SiteSettings = {
  id: number;
  showroom_name: string | null;
  sales_name: string;
  sales_role: string;
  whatsapp_number: string;
  whatsapp_international: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  opening_hours: string | null;
  google_maps_link: string | null;
  areas: string[];
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  youtube: string | null;
  site_title: string;
  meta_description: string | null;
  og_image: string | null;
  google_verification: string | null;
  default_keywords: string[] | null;
  updated_at: string;
};

export type PriceHistory = {
  id: string;
  product_id: string;
  old_otr: number | null;
  new_otr: number;
  changed_by: string | null;
  reason: string | null;
  created_at: string;
};

export type AuditLog = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  entity: string;
  entity_type: string | null;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
};

export type AnalyticsEvent = {
  id: string;
  event_type: string;
  source: string | null;
  product_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type FollowUp = {
  id: string;
  lead_id: string;
  customer_id: string | null;
  user_id: string | null;
  type: string;
  result: string;
  note: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Notification = {
  id: string;
  user_id: string | null;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  related_entity: string | null;
  related_id: string | null;
  is_read: boolean;
  created_at: string;
};

export type Deal = {
  id: string;
  lead_id: string;
  product_id: string | null;
  sales_id: string | null;
  deal_date: string;
  deal_value: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  phone_alt: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  customer_type: string;
  product_id: string | null;
  motor_name: string | null;
  motor_type: string | null;
  source: string;
  sales_id: string | null;
  status: string;
  notes: string | null;
  lead_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FinanceProgram = {
  id: string;
  provider_id: string | null;
  name: string;
  code: string | null;
  tenor_months: number;
  min_dp_percent: number | null;
  rate: number | null;
  admin_fee: number;
  insurance_fee: number;
  promo: string | null;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CreditApplication = {
  id: string;
  customer_id: string;
  product_id: string | null;
  finance_provider_id: string | null;
  finance_program_id: string | null;
  spk_id: string | null;
  motor_name: string | null;
  motor_type: string | null;
  otr_price: number;
  dp_amount: number;
  tenor_months: number;
  estimated_installment: number;
  admin_fee: number;
  insurance_fee: number;
  promo_discount: number;
  finance_name: string | null;
  finance_code: string | null;
  occupation: string | null;
  monthly_income: number | null;
  residence_status: string | null;
  employment_years: number | null;
  spouse_name: string | null;
  spouse_income: number | null;
  guarantor_name: string | null;
  guarantor_phone: string | null;
  status: string;
  payment_type: string;
  notes: string | null;
  sales_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejected_reason: string | null;
  disbursed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Spk = {
  id: string;
  spk_number: string;
  spk_date: string;
  customer_id: string;
  credit_application_id: string | null;
  product_id: string | null;
  sales_id: string | null;
  created_by: string | null;
  motor_name: string | null;
  motor_type: string | null;
  color: string | null;
  otr_price: number;
  payment_type: string;
  finance_name: string | null;
  dp_amount: number;
  tenor_months: number;
  installment_amount: number;
  admin_fee: number;
  insurance_fee: number;
  promo_discount: number;
  status: string;
  notes: string | null;
  unit_reserved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerDocument = {
  id: string;
  customer_id: string;
  credit_application_id: string | null;
  spk_id: string | null;
  category: string;
  document_type: string;
  label: string;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  status: string;
  is_required: boolean;
  rejection_reason: string | null;
  verified_by: string | null;
  verified_at: string | null;
  uploaded_by: string | null;
  uploaded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Delivery = {
  id: string;
  spk_id: string;
  customer_id: string;
  product_id: string | null;
  sales_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  motor_name: string | null;
  motor_type: string | null;
  spk_number: string | null;
  delivery_address: string | null;
  delivery_date: string | null;
  delivery_time: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  vehicle_plate: string | null;
  notes: string | null;
  checklist: Record<string, boolean>;
  status: string;
  delivered_at: string | null;
  delivered_by: string | null;
  delivery_proof_path: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type WhatsAppConversation = {
  id: string;
  customer_id: string | null;
  lead_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_phone_raw: string | null;
  assigned_to: string | null;
  status: string;
  priority: string;
  source: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  last_message_direction: string | null;
  unread_count: number;
  last_response_at: string | null;
  first_response_at: string | null;
  sla_due_at: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  response_time_seconds: number | null;
  resolution_time_seconds: number | null;
  sla_status: string;
  connection_id: string | null;
  created_at: string;
  updated_at: string;
};

export type WhatsAppMessage = {
  id: string;
  conversation_id: string;
  external_message_id: string | null;
  direction: string;
  message_type: string;
  text: string | null;
  media_url: string | null;
  media_caption: string | null;
  status: string;
  sender_phone: string | null;
  recipient_phone: string | null;
  template_id: string | null;
  created_by: string | null;
  created_at: string;
};

export type WhatsAppTemplate = {
  id: string;
  name: string;
  content: string;
  category: string;
  shortcut: string | null;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type WhatsAppInternalNote = {
  id: string;
  conversation_id: string;
  user_id: string | null;
  note: string;
  created_at: string;
};

export type WhatsAppConnection = {
  id: string;
  business_name: string;
  branch: string | null;
  display_name: string;
  phone_number: string | null;
  phone_number_id: string | null;
  waba_id: string | null;
  business_account_id: string | null;
  provider: string;
  status: string;
  webhook_status: string;
  api_status: string;
  webhook_url: string | null;
  webhook_verified_at: string | null;
  last_health_check: string | null;
  last_message_at: string | null;
  is_default: boolean;
  metadata: Record<string, unknown>;
  created_by: string | null;
  session_id: string | null;
  last_connected_at: string | null;
  last_disconnected_at: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WhatsAppQRSession = {
  id: string;
  connection_id: string;
  qr_data: string;
  status: string;
  expires_at: string;
  created_at: string;
};

export type WhatsAppConnectionLog = {
  id: string;
  connection_id: string | null;
  action: string;
  result: string;
  details: Record<string, unknown>;
  user_id: string | null;
  created_at: string;
};

export type InventoryUnit = {
  id: string;
  product_id: string;
  product_color_id: string | null;
  unit_code: string | null;
  engine_number: string | null;
  frame_number: string | null;
  year: number | null;
  status: string;
  location: string | null;
  purchase_date: string | null;
  reserved_at: string | null;
  reserved_by_spk_id: string | null;
  sold_at: string | null;
  delivered_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
