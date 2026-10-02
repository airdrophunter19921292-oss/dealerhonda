'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, WhatsAppTemplate } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Plus, Pencil, Trash2, MessageCircle } from 'lucide-react';
import { getSafeError } from '@/lib/validation';

const categoryLabels: Record<string, string> = {
  greeting: 'Sapaan', pricing: 'Harga', credit: 'Kredit',
  follow_up: 'Follow-up', location: 'Lokasi', test_ride: 'Test Ride', other: 'Lainnya',
};

export default function WhatsAppTemplatesPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editTpl, setEditTpl] = useState<WhatsAppTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase.from('whatsapp_templates')
      .select('*').order('category').order('name');
    if (err) { setError(getSafeError(err)); }
    if (data) setTemplates(data as WhatsAppTemplate[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus template ini?')) return;
    const { error: delErr } = await supabase.from('whatsapp_templates').delete().eq('id', id);
    if (delErr) { setError(getSafeError(delErr)); return; }
    fetchData();
  };

  const handleToggle = async (tpl: WhatsAppTemplate) => {
    await supabase.from('whatsapp_templates').update({ is_active: !tpl.is_active }).eq('id', tpl.id);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-neutral-400">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Memuat templates...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-96 items-center justify-center text-neutral-400">
        <p>Hanya admin yang dapat mengelola templates.</p>
      </div>
    );
  }

  const grouped = templates.reduce<Record<string, WhatsAppTemplate[]>>((acc, tpl) => {
    const cat = tpl.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tpl);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">WhatsApp Templates</h1>
          <p className="mt-1 text-sm text-neutral-500">Quick reply templates untuk sales</p>
        </div>
        <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => { setEditTpl(null); setShowForm(true); }}>
          <Plus className="mr-1 h-4 w-4" /> Template Baru
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-200 bg-white py-16 text-neutral-400">
          <MessageCircle className="mb-3 h-10 w-10" />
          <p className="text-sm">Belum ada template. Buat template pertama Anda.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="rounded-xl border border-neutral-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-bold text-neutral-900">{categoryLabels[cat] || cat}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((tpl) => (
                  <div key={tpl.id} className={`rounded-lg border p-4 ${tpl.is_active ? 'border-neutral-200' : 'border-neutral-100 opacity-60'}`}>
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-neutral-900">{tpl.name}</p>
                        {tpl.shortcut && (
                          <span className="mt-0.5 inline-block rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-mono font-medium text-green-700">
                            /{tpl.shortcut}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-shrink-0 gap-1">
                        <button onClick={() => { setEditTpl(tpl); setShowForm(true); }} className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(tpl.id)} className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs text-neutral-600">{tpl.content}</p>
                    <button
                      onClick={() => handleToggle(tpl)}
                      className={`mt-2 text-xs font-medium ${tpl.is_active ? 'text-green-600' : 'text-neutral-400'}`}
                    >
                      {tpl.is_active ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editTpl ? 'Edit Template' : 'Template Baru'}</DialogTitle></DialogHeader>
          <TemplateForm
            editTpl={editTpl}
            userId={profile?.id}
            onSaved={() => { setShowForm(false); fetchData(); }}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateForm({ editTpl, userId, onSaved, onCancel }: {
  editTpl: WhatsAppTemplate | null;
  userId: string | undefined;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(editTpl?.name || '');
  const [content, setContent] = useState(editTpl?.content || '');
  const [category, setCategory] = useState(editTpl?.category || 'greeting');
  const [shortcut, setShortcut] = useState(editTpl?.shortcut || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim(),
      content: content.trim(),
      category,
      shortcut: shortcut.trim() || null,
      created_by: userId,
    };
    const { error: saveErr } = editTpl
      ? await supabase.from('whatsapp_templates').update(payload).eq('id', editTpl.id)
      : await supabase.from('whatsapp_templates').insert(payload);
    if (saveErr) { setError(getSafeError(saveErr)); setSaving(false); return; }
    setSaving(false);
    onSaved();
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}
      <div>
        <Label className="text-sm font-medium">Nama Template</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="contoh: Harga Vario" required className="mt-1.5" />
      </div>
      <div>
        <Label className="text-sm font-medium">Shortcut</Label>
        <Input value={shortcut} onChange={(e) => setShortcut(e.target.value.replace(/[^a-z0-9_]/g, ''))} placeholder="contoh: harga" className="mt-1.5" />
        <p className="mt-1 text-xs text-neutral-400">Gunakan /shortcut untuk quick reply</p>
      </div>
      <div>
        <Label className="text-sm font-medium">Kategori</Label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="admin-select mt-1.5">
          {Object.entries(categoryLabels).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>
      <div>
        <Label className="text-sm font-medium">Isi Pesan</Label>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} required className="mt-1.5" placeholder="Halo {{customer_name}}, ..." />
        <p className="mt-1 text-xs text-neutral-400">Gunakan {'{{customer_name}}'} untuk placeholder nama customer</p>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>Batal</Button>
      </div>
    </form>
  );
}
