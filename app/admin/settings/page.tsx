'use client';

import { useEffect, useState } from 'react';
import { supabase, SiteSettings } from '@/lib/supabase-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Save, CheckCircle2, Store } from 'lucide-react';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (!error && data) setSettings(data as SiteSettings);
      setLoading(false);
    }
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase
      .from('site_settings')
      .update({
        showroom_name: settings.showroom_name,
        sales_name: settings.sales_name,
        sales_role: settings.sales_role,
        whatsapp_number: settings.whatsapp_number,
        whatsapp_international: settings.whatsapp_international,
        phone: settings.phone,
        email: settings.email,
        address: settings.address,
        google_maps_link: settings.google_maps_link,
        opening_hours: settings.opening_hours,
        areas: settings.areas,
        instagram: settings.instagram,
        facebook: settings.facebook,
        tiktok: settings.tiktok,
        youtube: settings.youtube,
      })
      .eq('id', 1);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  if (loading) return <div className="text-center text-neutral-400">Memuat...</div>;
  if (!settings) return <div className="text-center text-neutral-400">Gagal memuat pengaturan.</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Pengaturan Bisnis</h1>
        <p className="mt-1 text-sm text-neutral-500">Kelola informasi bisnis dan kontak</p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" />
          Pengaturan berhasil disimpan.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6">
        <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
          <Store className="h-5 w-5 text-red-600" />
          <h2 className="text-sm font-bold text-neutral-900">Informasi Showroom</h2>
        </div>
        <div>
          <label className="text-sm font-medium">Nama Showroom</label>
          <Input
            value={settings.showroom_name || ''}
            onChange={(e) => setSettings({ ...settings, showroom_name: e.target.value })}
            className="mt-1.5"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Alamat</label>
          <Textarea
            value={settings.address || ''}
            onChange={(e) => setSettings({ ...settings, address: e.target.value })}
            rows={2}
            className="mt-1.5"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Google Maps Link</label>
          <Input
            value={settings.google_maps_link || ''}
            onChange={(e) => setSettings({ ...settings, google_maps_link: e.target.value })}
            placeholder="https://maps.google.com/..."
            className="mt-1.5"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Area Layanan (pisahkan dengan koma)</label>
          <Input
            value={settings.areas.join(', ')}
            onChange={(e) => setSettings({ ...settings, areas: e.target.value.split(',').map((a) => a.trim()).filter(Boolean) })}
            className="mt-1.5"
          />
        </div>

        <div className="flex items-center gap-2 border-b border-neutral-100 pb-3 pt-2">
          <h2 className="text-sm font-bold text-neutral-900">Kontak Sales</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Nama Sales</label>
            <Input
              value={settings.sales_name || ''}
              onChange={(e) => setSettings({ ...settings, sales_name: e.target.value })}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Role</label>
            <Input
              value={settings.sales_role || ''}
              onChange={(e) => setSettings({ ...settings, sales_role: e.target.value })}
              className="mt-1.5"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">No. WhatsApp ( lokal)</label>
            <Input
              value={settings.whatsapp_number || ''}
              onChange={(e) => setSettings({ ...settings, whatsapp_number: e.target.value })}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="text-sm font-medium">No. WhatsApp (Internasional)</label>
            <Input
              value={settings.whatsapp_international || ''}
              onChange={(e) => setSettings({ ...settings, whatsapp_international: e.target.value })}
              placeholder="628xxx"
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Telepon</label>
            <Input value={settings.phone || ''} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} className="mt-1.5" />
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <Input value={settings.email || ''} onChange={(e) => setSettings({ ...settings, email: e.target.value })} className="mt-1.5" />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Jam Buka</label>
          <Input value={settings.opening_hours || ''} onChange={(e) => setSettings({ ...settings, opening_hours: e.target.value })} placeholder="Senin-Sabtu 08:00-17:00" className="mt-1.5" />
        </div>

        <div className="flex items-center gap-2 border-b border-neutral-100 pb-3 pt-2">
          <h2 className="text-sm font-bold text-neutral-900">Social Media</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Instagram</label>
            <Input
              value={settings.instagram || ''}
              onChange={(e) => setSettings({ ...settings, instagram: e.target.value })}
              placeholder="https://instagram.com/..."
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Facebook</label>
            <Input
              value={settings.facebook || ''}
              onChange={(e) => setSettings({ ...settings, facebook: e.target.value })}
              placeholder="https://facebook.com/..."
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="text-sm font-medium">TikTok</label>
            <Input
              value={settings.tiktok || ''}
              onChange={(e) => setSettings({ ...settings, tiktok: e.target.value })}
              placeholder="https://tiktok.com/@..."
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="text-sm font-medium">YouTube</label>
            <Input
              value={settings.youtube || ''}
              onChange={(e) => setSettings({ ...settings, youtube: e.target.value })}
              placeholder="https://youtube.com/@..."
              className="mt-1.5"
            />
          </div>
        </div>

        <Button type="submit" disabled={saving} className="w-full bg-red-600 hover:bg-red-700 text-white">
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </Button>
      </form>
    </div>
  );
}
