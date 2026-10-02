import { supabase } from '@/lib/supabase-client';
import { motorData, Motor, FinancingOption, motorCategories } from '@/lib/motor-data';

export type DbProduct = {
  id: string;
  slug: string;
  name: string;
  category: string;
  otr: number;
  image: string | null;
  popular: boolean;
  status: string;
  stock_status: string;
  stock_quantity: number;
  description: string | null;
  sort_order: number;
};

export type DbFinancingPlan = {
  id: string;
  product_id: string;
  dp: number;
  tenor35: number;
  tenor47: number;
  provider: string | null;
  valid_from: string | null;
  valid_until: string | null;
  status: string;
  sort_order: number;
};

export type DbFaq = {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
  status: string;
};

export type DbSiteSettings = {
  showroom_name: string | null;
  sales_name: string;
  sales_role: string;
  whatsapp_number: string;
  whatsapp_international: string;
  address: string | null;
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
};

function isFinancingExpired(validUntil: string | null): boolean {
  if (!validUntil) return false;
  return new Date(validUntil) < new Date(new Date().toDateString());
}

function mapProductWithFinancing(
  product: DbProduct,
  plans: DbFinancingPlan[]
): Motor {
  const activePlans = plans
    .filter((p) => p.product_id === product.id && p.status === 'active' && !isFinancingExpired(p.valid_until))
    .sort((a, b) => a.sort_order - b.sort_order);

  const financing: FinancingOption[] = activePlans.map((p) => ({
    dp: p.dp,
    tenor35: p.tenor35,
    tenor47: p.tenor47,
  }));

  const fallbackMotor = motorData.find((m) => m.id === product.slug);

  return {
    id: product.slug,
    name: product.name,
    category: product.category as Motor['category'],
    otr: product.otr,
    image: product.image || fallbackMotor?.image || 'https://images.pexels.com/photos/2830762/pexels-photo-2830762.jpeg?auto=compress&cs=tinysrgb&w=800',
    popular: product.popular,
    financing: financing.length > 0 ? financing : fallbackMotor?.financing || [],
  };
}

export async function getProducts(): Promise<Motor[]> {
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .eq('status', 'active')
    .order('sort_order', { ascending: true });

  if (error || !products || products.length === 0) {
    return motorData;
  }

  const { data: plans } = await supabase
    .from('financing_plans')
    .select('*')
    .eq('status', 'active')
    .order('sort_order', { ascending: true });

  return (products as DbProduct[]).map((p) =>
    mapProductWithFinancing(p, (plans as DbFinancingPlan[]) || [])
  );
}

export async function getProductBySlug(slug: string): Promise<Motor | null> {
  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !product) {
    const fallback = motorData.find((m) => m.id === slug);
    return fallback || null;
  }

  const { data: plans } = await supabase
    .from('financing_plans')
    .select('*')
    .eq('product_id', (product as DbProduct).id)
    .eq('status', 'active')
    .order('sort_order', { ascending: true });

  return mapProductWithFinancing(product as DbProduct, (plans as DbFinancingPlan[]) || []);
}

export async function getFaqs(): Promise<{ q: string; a: string }[]> {
  const { data, error } = await supabase
    .from('faqs')
    .select('*')
    .eq('status', 'active')
    .order('sort_order', { ascending: true });

  if (error || !data || data.length === 0) {
    return [];
  }

  return (data as DbFaq[]).map((f) => ({ q: f.question, a: f.answer }));
}

export async function getSiteSettings(): Promise<DbSiteSettings | null> {
  const { data, error } = await supabase
    .from('site_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error || !data) return null;
  return data as DbSiteSettings;
}

export { motorCategories };
