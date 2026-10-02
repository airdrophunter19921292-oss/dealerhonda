import {
  LayoutDashboard,
  Bike,
  Wallet,
  Package,
  Tag,
  Users,
  CalendarDays,
  BarChart3,
  HelpCircle,
  Settings,
  ScrollText,
  Home,
  UserCog,
  PhoneCall,
  UserCircle,
  TrendingUp,
  FileText,
  Truck,
  CreditCard,
  ClipboardList,
  MessageCircle,
  Plug,
} from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
  salesOnly?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: 'OVERVIEW',
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'DEALER',
    items: [
      { href: '/admin/products', label: 'Produk Motor', icon: Bike, adminOnly: true },
      { href: '/admin/financing', label: 'Harga & Kredit', icon: Wallet },
      { href: '/admin/inventory', label: 'Stok', icon: Package },
      { href: '/admin/promos', label: 'Promo', icon: Tag, adminOnly: true },
    ],
  },
  {
    label: 'WHATSAPP',
    items: [
      { href: '/admin/whatsapp', label: 'Inbox', icon: MessageCircle },
      { href: '/admin/whatsapp/connections', label: 'Connections', icon: Plug, adminOnly: true },
      { href: '/admin/whatsapp/templates', label: 'Templates', icon: MessageCircle, adminOnly: true },
      { href: '/admin/whatsapp/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'CRM',
    items: [
      { href: '/admin/leads', label: 'Lead Customer', icon: Users },
      { href: '/admin/follow-ups', label: 'Follow-up', icon: PhoneCall },
      { href: '/admin/visits', label: 'Jadwal Kunjungan', icon: CalendarDays },
      { href: '/admin/customers', label: 'Customer', icon: UserCircle },
    ],
  },
  {
    label: 'PENJUALAN',
    items: [
      { href: '/admin/credit-applications', label: 'Pengajuan Kredit', icon: CreditCard },
      { href: '/admin/spk', label: 'SPK / Order', icon: ClipboardList },
      { href: '/admin/documents', label: 'Dokumen', icon: FileText },
      { href: '/admin/deliveries', label: 'Pengiriman', icon: Truck },
    ],
  },
  {
    label: 'ANALYTICS',
    items: [
      { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/admin/deals', label: 'Sales Report', icon: TrendingUp },
    ],
  },
  {
    label: 'WEBSITE',
    items: [
      { href: '/admin/faqs', label: 'FAQ', icon: HelpCircle, adminOnly: true },
      { href: '/admin/seo', label: 'SEO', icon: Settings, adminOnly: true },
      { href: '/admin/settings', label: 'Pengaturan', icon: Settings, adminOnly: true },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { href: '/admin/users', label: 'Manajemen User', icon: UserCog, adminOnly: true },
      { href: '/admin/audit-log', label: 'Audit Log', icon: ScrollText, adminOnly: true },
    ],
  },
];

export function getVisibleGroups(isAdmin: boolean): NavGroup[] {
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.adminOnly || isAdmin),
    }))
    .filter((group) => group.items.length > 0);
}
