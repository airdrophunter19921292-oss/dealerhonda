'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, Faq } from '@/lib/supabase-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, HelpCircle, ArrowUp, ArrowDown } from 'lucide-react';

export default function AdminFaqsPage() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Faq | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fetchFaqs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('faqs')
      .select('*')
      .order('sort_order', { ascending: true });
    if (!error && data) setFaqs(data as Faq[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFaqs();
  }, [fetchFaqs]);

  const handleDelete = async (id: string) => {
    await supabase.from('faqs').delete().eq('id', id);
    fetchFaqs();
  };

  const handleToggleStatus = async (faq: Faq) => {
    const newStatus = faq.status === 'active' ? 'inactive' : 'active';
    await supabase.from('faqs').update({ status: newStatus }).eq('id', faq.id);
    fetchFaqs();
  };

  const handleReorder = async (faq: Faq, direction: 'up' | 'down') => {
    const sorted = [...faqs].sort((a, b) => a.sort_order - b.sort_order);
    const index = sorted.findIndex((f) => f.id === faq.id);
    if (direction === 'up' && index > 0) {
      const target = sorted[index - 1];
      await Promise.all([
        supabase.from('faqs').update({ sort_order: target.sort_order }).eq('id', faq.id),
        supabase.from('faqs').update({ sort_order: faq.sort_order }).eq('id', target.id),
      ]);
    } else if (direction === 'down' && index < sorted.length - 1) {
      const target = sorted[index + 1];
      await Promise.all([
        supabase.from('faqs').update({ sort_order: target.sort_order }).eq('id', faq.id),
        supabase.from('faqs').update({ sort_order: faq.sort_order }).eq('id', target.id),
      ]);
    }
    fetchFaqs();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">FAQ</h1>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setEditing(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Tambah FAQ
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit FAQ' : 'Tambah FAQ'}</DialogTitle>
            </DialogHeader>
            <FaqForm
              faq={editing}
              maxOrder={faqs.length}
              onSaved={() => {
                setShowForm(false);
                fetchFaqs();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center text-neutral-400">Memuat...</div>
      ) : faqs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 py-16 text-center">
          <HelpCircle className="mx-auto mb-3 h-10 w-10 text-neutral-300" />
          <p className="text-sm text-neutral-500">Belum ada FAQ.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <div key={faq.id} className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-neutral-900">{faq.question}</p>
                    <Badge variant={faq.status === 'active' ? 'default' : 'secondary'}>
                      {faq.status === 'active' ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-neutral-600">{faq.answer}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <Button variant="ghost" size="sm" disabled={index === 0} onClick={() => handleReorder(faq, 'up')}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" disabled={index === faqs.length - 1} onClick={() => handleReorder(faq, 'down')}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(faq);
                      setShowForm(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(faq)}>
                    {faq.status === 'active' ? 'Sembunyikan' : 'Tampilkan'}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Hapus FAQ?</AlertDialogTitle>
                        <AlertDialogDescription>FAQ akan dihapus permanen.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(faq.id)}>Ya, Hapus</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FaqForm({ faq, maxOrder, onSaved }: { faq: Faq | null; maxOrder: number; onSaved: () => void }) {
  const [question, setQuestion] = useState(faq?.question || '');
  const [answer, setAnswer] = useState(faq?.answer || '');
  const [status, setStatus] = useState(faq?.status || 'active');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      question,
      answer,
      status,
      sort_order: faq?.sort_order ?? maxOrder + 1,
    };

    let result;
    if (faq) {
      result = await supabase.from('faqs').update(payload).eq('id', faq.id);
    } else {
      result = await supabase.from('faqs').insert(payload);
    }

    setSaving(false);
    if (result.error) {
      setError(result.error.message);
    } else {
      onSaved();
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Pertanyaan</label>
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} required className="mt-1.5" />
      </div>
      <div>
        <label className="text-sm font-medium">Jawaban</label>
        <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} required rows={4} className="mt-1.5" />
      </div>
      <div>
        <label className="text-sm font-medium">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={saving} className="w-full bg-red-600 hover:bg-red-700 text-white">
        {saving ? 'Menyimpan...' : 'Simpan'}
      </Button>
    </form>
  );
}
