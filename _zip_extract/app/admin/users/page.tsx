'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, Profile } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, UserCog, Shield, ShieldCheck, ShieldX, Mail, Phone, Loader2 } from 'lucide-react';
import { getSafeError } from '@/lib/validation';
import { PageHeader, LoadingState, EmptyState } from '@/components/admin/admin-ui';

export default function AdminUsersPage() {
  const { profile: currentUser } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      setUsers(data as Profile[]);
    } else {
      setError(getSafeError(error));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const { error } = await supabase.rpc('update_profile_role_status', {
      p_profile_id: id,
      p_role: users.find((u) => u.id === id)?.role || 'sales',
      p_status: newStatus,
    });
    if (error) {
      setError(getSafeError(error));
    } else {
      fetchUsers();
    }
  };

  const changeRole = async (id: string, newRole: string) => {
    const currentStatus = users.find((u) => u.id === id)?.status || 'active';
    const { error } = await supabase.rpc('update_profile_role_status', {
      p_profile_id: id,
      p_role: newRole,
      p_status: currentStatus,
    });
    if (error) {
      setError(getSafeError(error));
    } else {
      fetchUsers();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UserCog}
        title="Manajemen User"
        description="Kelola akun admin dan sales."
        actions={
          <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setShowForm(true)}>
            <Plus className="mr-1 h-4 w-4" /> Tambah Sales/Admin
          </Button>
        }
      />

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <LoadingState label="Memuat data user..." />
      ) : users.length === 0 ? (
        <EmptyState icon={UserCog} title="Belum ada user" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telepon</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name || '-'}</TableCell>
                  <TableCell className="text-sm text-neutral-600">
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3 text-neutral-400" />
                      {user.email || '-'}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-neutral-600">
                    {user.phone ? (
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-neutral-400" />
                        {user.phone}
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <select
                      value={user.role}
                      onChange={(e) => changeRole(user.id, e.target.value)}
                      disabled={user.id === currentUser?.id}
                      className="h-8 rounded-md border border-neutral-200 bg-white px-2 text-xs font-medium"
                    >
                      <option value="admin">Admin</option>
                      <option value="sales">Sales</option>
                    </select>
                  </TableCell>
                  <TableCell>
                    {user.status === 'active' ? (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                        <ShieldCheck className="mr-1 h-3 w-3" /> Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <ShieldX className="mr-1 h-3 w-3" /> Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleStatus(user.id, user.status)}
                      disabled={user.id === currentUser?.id}
                    >
                      {user.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-2">
          <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
          <p className="text-xs text-blue-700">
            Akun baru yang dibuat akan memiliki status <strong>inactive</strong> dan role <strong>sales</strong> secara default.
            Aktifkan akun dan ubah role jika diperlukan. Pendaftaran publik tidak tersedia.
          </p>
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Buat Akun Baru</DialogTitle>
          </DialogHeader>
          <CreateUserForm onSaved={() => { setShowForm(false); fetchUsers(); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateUserForm({ onSaved }: { onSaved: () => void }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('sales');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session?.access_token}`,
        },
        body: JSON.stringify({ email, password, fullName, phone, role }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Gagal membuat akun. Coba lagi.');
        setSaving(false);
        return;
      }

      setSaving(false);
      onSaved();
    } catch {
      setError('Gagal membuat akun. Periksa koneksi dan coba lagi.');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <label className="admin-label">Nama Lengkap</label>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required className="mt-1.5" />
      </div>
      <div>
        <label className="admin-label">Email</label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1.5" />
      </div>
      <div>
        <label className="admin-label">Telepon</label>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxx" className="mt-1.5" />
      </div>
      <div>
        <label className="admin-label">Password</label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="mt-1.5" />
      </div>
      <div>
        <label className="admin-label">Role</label>
        <select value={role} onChange={(e) => setRole(e.target.value)} className="admin-select mt-1.5">
          <option value="sales">Sales</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={saving} className="w-full bg-red-600 hover:bg-red-700 text-white">
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Membuat akun...
          </>
        ) : (
          'Buat Akun'
        )}
      </Button>
    </form>
  );
}
