'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth-provider';
import { Button } from '@/components/ui/button';
import { Menu, Bell, LogOut, User, Settings, ChevronDown } from 'lucide-react';
import { AdminMobileNav } from './admin-mobile-nav';
import { supabase, Notification } from '@/lib/supabase-client';
import Link from 'next/link';
import { timeAgo } from './admin-ui';
import { cn } from '@/lib/utils';

export function AdminTopbar() {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const displayName = profile?.full_name || profile?.email?.split('@')[0] || 'User';
  const roleLabel = profile?.role === 'admin' ? 'Admin' : 'Sales';

  const fetchNotifs = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) {
      setNotifications(data as Notification[]);
      setUnreadCount(data.filter((n) => !n.is_read).length);
    }
  }, [profile?.id]);

  // Initial fetch
  useEffect(() => {
    fetchNotifs();
  }, [fetchNotifs]);

  // Realtime subscription — INSERT new notifications for this user
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(`notifications:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications((prev) => {
            // Guard against duplicate delivery
            if (prev.some((n) => n.id === newNotif.id)) return prev;
            return [newNotif, ...prev].slice(0, 20);
          });
          setUnreadCount((c) => c + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          const updated = payload.new as Notification;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n))
          );
          setUnreadCount((prev) =>
            notifications.filter((n) => !n.is_read).length
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recompute unread count whenever notifications list changes
  useEffect(() => {
    setUnreadCount(notifications.filter((n) => !n.is_read).length);
  }, [notifications]);

  // Click-outside handler
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markOneRead = async (notifId: string) => {
    const notif = notifications.find((n) => n.id === notifId);
    if (!notif || notif.is_read) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notifId);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
    );
  };

  const markAllRead = async () => {
    if (!profile?.id) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', profile.id)
      .eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const notifTypeColors: Record<string, string> = {
    info: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    new_lead: 'bg-red-600',
  };

  return (
    <>
      <header className="flex h-16 items-center justify-between border-b border-neutral-200 bg-white px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            className="rounded-md p-2 text-neutral-600 hover:bg-neutral-100 md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-neutral-900">
              Selamat datang, {displayName.split(' ')[0]}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Notifications */}
          <div ref={notifRef} className="relative">
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className="relative rounded-lg p-2 text-neutral-600 transition-colors hover:bg-neutral-100"
              aria-label="Notifikasi"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-12 z-50 w-80 rounded-xl border border-neutral-200 bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
                  <span className="text-sm font-bold text-neutral-900">
                    Notifikasi
                    {unreadCount > 0 && (
                      <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white">
                        {unreadCount}
                      </span>
                    )}
                  </span>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Tandai semua dibaca
                    </button>
                  )}
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="py-10 text-center text-sm text-neutral-400">
                      Tidak ada notifikasi
                    </p>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className="relative">
                        <Link
                          href={n.link || '#'}
                          onClick={() => {
                            setNotifOpen(false);
                            markOneRead(n.id);
                          }}
                          className={cn(
                            'flex gap-3 border-b border-neutral-50 px-4 py-3 transition-colors hover:bg-neutral-50',
                            !n.is_read && 'bg-red-50/50'
                          )}
                        >
                          <span
                            className={cn(
                              'mt-1.5 h-2 w-2 flex-shrink-0 rounded-full',
                              notifTypeColors[n.type] || 'bg-neutral-400'
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium text-neutral-900 leading-snug">
                                {n.title}
                              </p>
                              {!n.is_read && (
                                <span className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-red-500" />
                              )}
                            </div>
                            {n.body && (
                              <p className="mt-0.5 text-xs text-neutral-500 line-clamp-2">
                                {n.body}
                              </p>
                            )}
                            <p className="mt-1 text-xs text-neutral-400">
                              {timeAgo(n.created_at)}
                            </p>
                          </div>
                        </Link>
                        {!n.is_read && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              markOneRead(n.id);
                            }}
                            className="absolute right-2 top-3 rounded px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                            title="Tandai dibaca"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {notifications.length > 0 && (
                  <div className="border-t border-neutral-100 px-4 py-2">
                    <Link
                      href="/admin/leads"
                      onClick={() => setNotifOpen(false)}
                      className="block text-center text-xs font-medium text-red-600 hover:underline"
                    >
                      Lihat semua lead
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Profile dropdown */}
          <div ref={profileRef} className="relative flex items-center gap-2 border-l border-neutral-200 pl-3">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-neutral-100"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-medium leading-tight text-neutral-900">{displayName}</p>
                <p className="text-xs leading-tight text-neutral-400">{roleLabel}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-neutral-400" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-neutral-200 bg-white shadow-lg">
                <div className="border-b border-neutral-100 px-4 py-3">
                  <p className="text-sm font-semibold text-neutral-900">{displayName}</p>
                  <p className="text-xs text-neutral-400">{profile?.email}</p>
                  <span className="mt-1.5 inline-flex rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                    {roleLabel}
                  </span>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => setProfileOpen(false)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                  >
                    <User className="h-4 w-4 text-neutral-400" />
                    Profil Saya
                  </button>
                  <button
                    onClick={() => setProfileOpen(false)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                  >
                    <Settings className="h-4 w-4 text-neutral-400" />
                    Pengaturan Akun
                  </button>
                </div>
                <div className="border-t border-neutral-100 py-1">
                  <button
                    onClick={() => { setProfileOpen(false); signOut(); }}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Keluar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {mobileOpen && <AdminMobileNav onClose={() => setMobileOpen(false)} />}
    </>
  );
}
