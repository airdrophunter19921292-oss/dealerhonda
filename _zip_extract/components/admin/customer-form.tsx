'use client';

import { useState } from 'react';
import { supabase, Profile, Product } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { normalizePhone, isValidPhone, isValidEmail } from '@/lib/validation';
import { getSafeError } from '@/lib/validation';
import Link from 'next/link';
import { Customer } from '@/lib/supabase-client';

const sourceOptions = [
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'website', label: 'Website' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'event', label: 'Event' },
  { value: 'referral', label: 'Referral' },
  { value: 'phone', label: 'Telepon' },
  { value: 'other', label: 'Lainnya' },
];

type DuplicateInfo = {
  id: string;
  name: string;
  status: string;
  phone: string;
  created_at: string;
};

export function CustomerForm({
  salesReps,
  products,
  editCustomer,
  onSaved,
  onCancel,
}: {
  salesReps: Profile[];
  products: Product[];
  editCustomer?: Customer | null;
  onSaved: (customerId: string) => void;
  onCancel?: () => void;
}) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [name, setName] = useState(editCustomer?.name || '');
  const [phone, setPhone] = useState(editCustomer?.phone || '');
  const [phoneAlt, setPhoneAlt] = useState(editCustomer?.phone_alt || '');
  const [email, setEmail] = useState(editCustomer?.email || '');
  const [address, setAddress] = useState(editCustomer?.address || '');
  const [city, setCity] = useState(editCustomer?.city || '');
  const [province, setProvince] = useState(editCustomer?.province || '');
  const [postalCode, setPostalCode] = useState(editCustomer?.postal_code || '');
  const [customerType, setCustomerType] = useState(editCustomer?.customer_type || 'individual');
  const [motorName, setMotorName] = useState(editCustomer?.motor_name || '');
  const [motorType, setMotorType] = useState(editCustomer?.motor_type || '');
  const [source, setSource] = useState(editCustomer?.source || 'walk_in');
  const [salesId, setSalesId] = useState(editCustomer?.sales_id || (isAdmin ? '' : profile?.id || ''));
  const [status, setStatus] = useState(editCustomer?.status || 'active');
  const [notes, setNotes] = useState(editCustomer?.notes || '');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null);

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
    setDuplicate(null);
    if (!validate()) return;

    setSaving(true);
    try {
      if (editCustomer) {
        const { error: updateError } = await supabase.rpc('update_customer', {
          p_customer_id: editCustomer.id,
          p_name: name.trim(),
          p_phone: phone,
          p_phone_alt: phoneAlt || null,
          p_email: email || null,
          p_address: address || null,
          p_city: city || null,
          p_province: province || null,
          p_postal_code: postalCode || null,
          p_customer_type: customerType,
          p_motor_name: motorName || null,
          p_motor_type: motorType || null,
          p_source: source,
          p_sales_id: salesId || null,
          p_status: status,
          p_notes: notes || null,
        });

        if (updateError) {
          const msg = updateError.message || '';
          if (msg.includes('DUPLICATE_PHONE')) {
            setServerError('Customer dengan nomor ini sudah terdaftar.');
          } else if (msg.includes('DUPLICATE_EMAIL')) {
            setServerError('Customer dengan email ini sudah terdaftar.');
          } else {
            setServerError(getSafeError(updateError));
          }
          setSaving(false);
          return;
        }
        onSaved(editCustomer.id);
      } else {
        const { data, error: createError } = await supabase.rpc('create_customer', {
          p_name: name.trim(),
          p_phone: phone,
          p_phone_alt: phoneAlt || null,
          p_email: email || null,
          p_address: address || null,
          p_city: city || null,
          p_province: province || null,
          p_postal_code: postalCode || null,
          p_customer_type: customerType,
          p_motor_name: motorName || null,
          p_motor_type: motorType || null,
          p_source: source,
          p_sales_id: salesId || null,
          p_status: status,
          p_notes: notes || null,
        });

        if (createError) {
          const msg = createError.message || '';
          if (msg.includes('DUPLICATE_CUSTOMER')) {
            const parts = msg.split('|');
            setDuplicate({
              id: parts[1] || '',
              name: parts[2] || '',
              status: parts[3] || '',
              phone: normalizePhone(phone),
              created_at: '',
            });
            setSaving(false);
            return;
          }
          setServerError(getSafeError(createError));
          setSaving(false);
          return;
        }
        onSaved(data as string);
      }
    } catch {
      setServerError('Gagal menyimpan customer. Silakan coba lagi.');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {duplicate && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">Customer dengan nomor ini sudah terdaftar</p>
              <div className="mt-2 space-y-1 text-sm text-amber-700">
                <p><strong>Nama:</strong> {duplicate.name}</p>
                <p><strong>Status:</strong> {duplicate.status}</p>
              </div>
              <Link href={`/admin/customers/${duplicate.id}`} className="mt-2 inline-block">
                <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100">
                  Lihat Customer
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {serverError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-neutral-700">Nama Lengkap *</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama lengkap customer"
            className="mt-1.5"
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
        </div>
        <div>
          <Label className="text-sm font-medium text-neutral-700">Jenis Customer *</Label>
          <select
            value={customerType}
            onChange={(e) => setCustomerType(e.target.value)}
            className="admin-select mt-1.5"
          >
            <option value="individual">Individu</option>
            <option value="company">Perusahaan</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-neutral-700">Nomor WhatsApp *</Label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="08123456789 atau +628123456789"
            className="mt-1.5"
          />
          {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
        </div>
        <div>
          <Label className="text-sm font-medium text-neutral-700">Nomor Telepon</Label>
          <Input
            value={phoneAlt}
            onChange={(e) => setPhoneAlt(e.target.value)}
            placeholder="Nomor telepon rumah/kantor (opsional)"
            className="mt-1.5"
          />
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium text-neutral-700">Email</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@contoh.com (opsional)"
          className="mt-1.5"
        />
        {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
      </div>

      <div>
        <Label className="text-sm font-medium text-neutral-700">Alamat</Label>
        <Textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Alamat lengkap (opsional)"
          rows={2}
          className="mt-1.5"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label className="text-sm font-medium text-neutral-700">Kota</Label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Kota" className="mt-1.5" />
        </div>
        <div>
          <Label className="text-sm font-medium text-neutral-700">Provinsi</Label>
          <Input value={province} onChange={(e) => setProvince(e.target.value)} placeholder="Provinsi" className="mt-1.5" />
        </div>
        <div>
          <Label className="text-sm font-medium text-neutral-700">Kode Pos</Label>
          <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="Kode pos" className="mt-1.5" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-neutral-700">Motor yang Diminati</Label>
          <Input value={motorName} onChange={(e) => setMotorName(e.target.value)} placeholder="Contoh: Honda Vario 160" className="mt-1.5" />
        </div>
        <div>
          <Label className="text-sm font-medium text-neutral-700">Tipe/Model</Label>
          <Input value={motorType} onChange={(e) => setMotorType(e.target.value)} placeholder="Contoh: CBS ISS" className="mt-1.5" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-neutral-700">Sumber Customer</Label>
          <select value={source} onChange={(e) => setSource(e.target.value)} className="admin-select mt-1.5">
            {sourceOptions.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-sm font-medium text-neutral-700">Sales/PIC</Label>
          <select
            value={salesId}
            onChange={(e) => setSalesId(e.target.value)}
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
        <Label className="text-sm font-medium text-neutral-700">Status Customer</Label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="admin-select mt-1.5">
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
        </select>
      </div>

      <div>
        <Label className="text-sm font-medium text-neutral-700">Catatan</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Catatan tambahan tentang customer ini (opsional)"
          rows={2}
          className="mt-1.5"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={saving} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {editCustomer ? 'Menyimpan perubahan...' : 'Menyimpan customer...'}
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              {editCustomer ? 'Simpan Perubahan' : 'Simpan Customer'}
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
