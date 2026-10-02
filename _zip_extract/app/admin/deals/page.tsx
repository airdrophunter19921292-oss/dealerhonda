'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, Deal, Lead, Product, Profile } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-provider';
import { PageHeader, LoadingState, EmptyState, MetricCard, formatDate } from '@/components/admin/admin-ui';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  TrendingUp, CheckCircle, XCircle, Plus, Trophy, Wallet,
} from 'lucide-react';

type DealWithRelations = Deal & {
  leads?: Pick<Lead, 'id' | 'name' | 'phone' | 'motor_name' | 'product_id'>;
  products?: Pick<Product, 'id' | 'name'>;
  profiles?: Pick<Profile, 'id' | 'full_name'>;
};

export default function DealsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<DealWithRelations[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [stats, setStats] = useState({ won: 0, lost: 0, totalValue: 0 });

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('deals').select('*,leads(id,name,phone,motor_name,product_id),products(id,name),profiles(id,full_name)');
    if (!isAdmin && profile?.id) {
      query = query.eq('sales_id', profile.id);
    }
    const { data } = await query.order('deal_date', { ascending: false });
    const dealList = (data || []) as DealWithRelations[];
    setDeals(dealList);
    setStats({
      won: dealList.filter((d) => d.status === 'won').length,
      lost: dealList.filter((d) => d.status === 'lost').length,
      totalValue: dealList.filter((d) => d.status === 'won').reduce((s, d) => s + (d.deal_value || 0), 0),
    });
    setLoading(false);
  }, [isAdmin, profile?.id]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={TrendingUp}
        title="Sales Report"
        description="Catatan deal dan hasil penjualan."
        actions={
          <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setShowForm(true)}>
            <Plus className="mr-1 h-4 w-4" /> Tambah Deal
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <MetricCard label="Deal Won" value={stats.won} icon={CheckCircle} color="green" />
        <MetricCard label="Deal Lost" value={stats.lost} icon={XCircle} color="neutral" />
        <MetricCard label="Total Nilai Deal" value={`Rp ${(stats.totalValue / 1000000).toFixed(1)}M`} icon={Wallet} color="blue" />
      </div>

      {loading ? (
        <LoadingState label="Memuat deals..." />
      ) : deals.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Belum ada deal"
          description="Deal akan tercatat saat lead berubah menjadi won atau lost."
          action={<Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setShowForm(true)}><Plus className="mr-1 h-4 w-4" /> Tambah Deal</Button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Motor</TableHead>
                <TableHead>Sales</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Nilai</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Catatan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium text-neutral-900">{d.leads?.name || '-'}</TableCell>
                  <TableCell className="text-sm text-neutral-600">{d.products?.name || d.leads?.motor_name || '-'}</TableCell>
                  <TableCell className="text-sm text-neutral-600">{d.profiles?.full_name || '-'}</TableCell>
                  <TableCell className="text-sm text-neutral-600">{formatDate(d.deal_date)}</TableCell>
                  <TableCell className="text-sm font-medium text-neutral-900">
                    {d.deal_value ? `Rp ${d.deal_value.toLocaleString('id-ID')}` : '-'}
                  </TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${d.status === 'won' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {d.status === 'won' ? 'Won' : 'Lost'}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-neutral-500">{d.notes || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah Deal</DialogTitle>
          </DialogHeader>
          <DealForm onSaved={() => { setShowForm(false); fetchDeals(); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DealForm({ onSaved }: { onSaved: () => void }) {
  const { profile } = useAuth();
  const [leadId, setLeadId] = useState('');
  const [status, setStatus] = useState('won');
  const [dealValue, setDealValue] = useState('');
  const [dealDate, setDealDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    supabase.from('leads').select('*').in('status', ['negotiation', 'deal', 'lost']).order('updated_at', { ascending: false }).limit(50)
      .then(({ data }) => { if (data) setLeads(data as Lead[]); });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadId) return;
    setSaving(true);
    const selectedLead = leads.find((l) => l.id === leadId);
    await supabase.from('deals').insert({
      lead_id: leadId,
      product_id: selectedLead?.product_id || null,
      sales_id: profile?.id,
      deal_date: dealDate,
      deal_value: dealValue ? parseInt(dealValue) : 0,
      status,
      notes: notes || null,
    });
    setSaving(false);
    onSaved();
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <label className="admin-label">Lead *</label>
        <select value={leadId} onChange={(e) => setLeadId(e.target.value)} required className="admin-select mt-1.5">
          <option value="">Pilih Lead...</option>
          {leads.map((l) => (
            <option key={l.id} value={l.id}>{l.name} - {l.motor_name || '-'}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="admin-label">Status *</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="admin-select mt-1.5">
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>
        </div>
        <div>
          <label className="admin-label">Tanggal *</label>
          <Input type="date" value={dealDate} onChange={(e) => setDealDate(e.target.value)} required className="mt-1.5" />
        </div>
      </div>
      <div>
        <label className="admin-label">Nilai Deal (Rp)</label>
        <Input type="number" value={dealValue} onChange={(e) => setDealValue(e.target.value)} placeholder="0" className="mt-1.5" />
      </div>
      <div>
        <label className="admin-label">Catatan</label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1.5" />
      </div>
      <Button type="submit" disabled={saving || !leadId} className="w-full bg-red-600 hover:bg-red-700 text-white">
        {saving ? 'Menyimpan...' : 'Simpan Deal'}
      </Button>
    </form>
  );
}
