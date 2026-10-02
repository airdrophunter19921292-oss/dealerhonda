'use client';

import { useState } from 'react';
import { supabase, Profile } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle } from 'lucide-react';
import { isValidPhone, isValidEmail } from '@/lib/validation';
import { getSafeError } from '@/lib/validation';

const leadSources = [
  { value: 'website', label: 'Website' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'phone', label: 'Telepon' },
  { value: 'referral', label: 'Referral' },
  { value: 'event', label: 'Event' },
  { value: 'manual', label: 'Manual' },
  { value: 'other', label: 'Lainnya' },
];

const leadStatuses = [
  { value: 'new', label: 'Baru' },
  { value: 'contacted', label: 'Dihubungi' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'visit_scheduled', label: 'Kunjungan' },
  { value: 'test_ride', label: 'Test Ride' },
  { value: 'negotiation', label: 'Negosiasi' },
];

const priorities = [
  { value: 'low', label: 'Rendah' },
  { value: 'medium', label: 'Sedang' },
  { value: 'high', label: 'Tinggi' },
];

export function LeadForm({
  salesReps,
  onSaved,
  onCancel,
}: {
  salesReps: Profile[];
  onSaved: (leadId: string) => void;
  onCancel?: () => void;
}) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [motorName, setMotorName] = useState('');
  const [source, setSource] = useState('manual');
  const [assignedTo, setAssignedTo] = useState(isAdmin ? '' : profile?.id || '');
  const [status, setStatus] = useState('new');
  const [priority, setPriority] = useState('medium');
  const [notes, setNotes] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Nama wajib diisi';
    if (!phone.trim()) e.phone = 'Nomor WhatsApp wajib diisi';
    else if (!isValidPhone(phone)) e.phone = 'Format nomor tidak valid (contoh: 08123456789)';
    if (email && !isValidEmail(email)) e.email = 'Format email tidak valid';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('create_lead_manual', {
        p_name: name.trim(),
        p_phone: phone,
        p_email: email || null,
        p_city: city || null,
        p_motor_name: motorName || null,
        p_source: source,
        p_assigned_to: assignedTo || null,
        p_status: status,
        p_priority: priority,
        p_notes: notes || null,
        p_follow_up_at: followUpAt || null,
      });

      if (error) {
        setServerError(getSafeError(error));
        setSaving(false);
        return;
      }
      onSaved(data as string);
    } catch {
      setServerError('Gagal menyimpan lead. Silakan coba lagi.');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {serverError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-neutral-700">Nama *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama prospek" className="mt-1.5" />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
        </div>
        <div>
          <Label className="text-sm font-medium text-neutral-700">WhatsApp *</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08123456789" className="mt-1.5" />
          {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-neutral-700">Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@contoh.com" className="mt-1.5" />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
        </div>
        <div>
          <Label className="text-sm font-medium text-neutral-700">Kota</Label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Kota/Kecamatan" className="mt-1.5" />
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium text-neutral-700">Motor yang Diminati</Label>
        <Input value={motorName} onChange={(e) => setMotorName(e.target.value)} placeholder="Contoh: Honda Vario 160" className="mt-1.5" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-neutral-700">Sumber Lead</Label>
          <select value={source} onChange={(e) => setSource(e.target.value)} className="admin-select mt-1.5">
            {leadSources.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-sm font-medium text-neutral-700">Prioritas</Label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="admin-select mt-1.5">
            {priorities.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-neutral-700">Status Lead</Label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="admin-select mt-1.5">
            {leadStatuses.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-sm font-medium text-neutral-700">Sales/PIC</Label>
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            disabled={!isAdmin}
            className="admin-select mt-1.5"
          >
            <option value="">Pilih Sales</option>
            {salesReps.map((r) => (
              <option key={r.id} value={r.id}>{r.full_name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium text-neutral-700">Jadwal Follow-up Berikutnya</Label>
        <Input type="date" value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} className="mt-1.5" />
      </div>

      <div>
        <Label className="text-sm font-medium text-neutral-700">Catatan</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan tentang lead ini" rows={2} className="mt-1.5" />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={saving} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Menyimpan lead...
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Simpan Lead
            </>
          )}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Batal
          </Button>
        )}
      </div>
    </form>
  );
}
