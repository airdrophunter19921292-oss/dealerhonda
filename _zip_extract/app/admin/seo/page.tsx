'use client';

import { useEffect, useState } from 'react';
import { supabase, SiteSettings } from '@/lib/supabase-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Settings, Save, CheckCircle2 } from 'lucide-react';

export default function AdminSeoPage() {
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
        site_title: settings.site_title,
        meta_description: settings.meta_description,
        og_image: settings.og_image,
        google_verification: settings.google_verification,
        default_keywords: settings.default_keywords,
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
        <h1 className="text-2xl font-bold text-neutral-900">SEO Settings</h1>
        <p className="mt-1 text-sm text-neutral-500">Kelola SEO dasar website</p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" />
          Pengaturan SEO berhasil disimpan.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6">
        <div>
          <label className="text-sm font-medium">Site Title</label>
          <Input
            value={settings.site_title || ''}
            onChange={(e) => setSettings({ ...settings, site_title: e.target.value })}
            className="mt-1.5"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Meta Description</label>
          <Textarea
            value={settings.meta_description || ''}
            onChange={(e) => setSettings({ ...settings, meta_description: e.target.value })}
            rows={3}
            className="mt-1.5"
          />
        </div>
        <div>
          <label className="text-sm font-medium">OG Image URL</label>
          <Input
            value={settings.og_image || ''}
            onChange={(e) => setSettings({ ...settings, og_image: e.target.value })}
            placeholder="https://..."
            className="mt-1.5"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Google Verification Code</label>
          <Input
            value={settings.google_verification || ''}
            onChange={(e) => setSettings({ ...settings, google_verification: e.target.value })}
            placeholder="Contoh: google-site-verification=..."
            className="mt-1.5"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Default Keywords (pisahkan dengan koma)</label>
          <Input
            value={(settings.default_keywords || []).join(', ')}
            onChange={(e) => setSettings({ ...settings, default_keywords: e.target.value.split(',').map((k) => k.trim()).filter(Boolean) })}
            className="mt-1.5"
          />
        </div>
        <Button type="submit" disabled={saving} className="bg-red-600 hover:bg-red-700 text-white">
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Menyimpan...' : 'Simpan'}
        </Button>
      </form>
    </div>
  );
}
