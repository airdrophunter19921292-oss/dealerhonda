'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, WhatsAppConversation, WhatsAppMessage, WhatsAppTemplate, WhatsAppInternalNote, Customer, Lead, FollowUp, CreditApplication, Spk, Profile } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  MessageCircle, Send, Search, Loader2, Phone, User,
  ChevronRight, StickyNote, Plus, Archive, Clock,
  Circle, AlertCircle, Paperclip, Smile,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { getSafeError } from '@/lib/validation';

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  open: { label: 'Open', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  waiting_customer: { label: 'Menunggu Customer', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  waiting_sales: { label: 'Menunggu Sales', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  resolved: { label: 'Selesai', color: 'bg-neutral-100 text-neutral-600', dot: 'bg-neutral-400' },
  archived: { label: 'Arsip', color: 'bg-neutral-100 text-neutral-500', dot: 'bg-neutral-300' },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: 'text-neutral-400' },
  normal: { label: 'Normal', color: 'text-blue-500' },
  high: { label: 'High', color: 'text-orange-500' },
  urgent: { label: 'Urgent', color: 'text-red-500' },
};

const msgStatusIcons: Record<string, string> = {
  sending: '...',
  sent: '✓',
  delivered: '✓✓',
  read: '✓✓',
  failed: '!',
};

type ConversationWithAssignee = WhatsAppConversation & {
  assignee_name?: string;
};

export default function WhatsAppInboxPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<ConversationWithAssignee[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedConv, setSelectedConv] = useState<WhatsAppConversation | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [notes, setNotes] = useState<WhatsAppInternalNote[]>([]);
  const [salesReps, setSalesReps] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterView, setFilterView] = useState<'all' | 'mine' | 'unassigned'>('all');
  const [messageText, setMessageText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [sending, setSending] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [customer360, setCustomer360] = useState<{
    customer: Customer | null;
    lead: Lead | null;
    followUps: FollowUp[];
    creditApps: CreditApplication[];
    spks: Spk[];
  }>({ customer: null, lead: null, followUps: [], creditApps: [], spks: [] });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = useCallback(async () => {
    let query = supabase.from('whatsapp_conversations').select('*').order('last_message_at', { ascending: false, nullsFirst: false });
    if (filterStatus !== 'all') query = query.eq('status', filterStatus);
    if (filterView === 'mine' && profile) query = query.eq('assigned_to', profile.id);
    if (filterView === 'unassigned') query = query.is('assigned_to', null);
    if (searchQuery) query = query.or(`customer_name.ilike.%${searchQuery}%,customer_phone.ilike.%${searchQuery}%`);

    const { data, error: err } = await query;
    if (err) { setError(getSafeError(err)); return; }
    if (data) setConversations(data as WhatsAppConversation[]);
  }, [filterStatus, filterView, profile, searchQuery]);

  useEffect(() => {
    supabase.from('whatsapp_templates').select('*').eq('is_active', true).order('name')
      .then(({ data }) => { if (data) setTemplates(data as WhatsAppTemplate[]); });
    supabase.from('profiles').select('*').in('role', ['admin', 'sales']).eq('status', 'active')
      .then(({ data }) => { if (data) setSalesReps(data as Profile[]); });
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchConversations().finally(() => setLoading(false));
  }, [fetchConversations]);

  // Realtime subscription for conversation list
  useEffect(() => {
    const channel = supabase.channel('wa-conversations-list');
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversations' }, () => {
      fetchConversations();
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchConversations]);

  const selectConversation = useCallback(async (convId: string) => {
    setSelectedId(convId);
    setError(null);
    const { data: conv } = await supabase.from('whatsapp_conversations').select('*').eq('id', convId).maybeSingle();
    if (conv) {
      setSelectedConv(conv as WhatsAppConversation);
      // Mark as read
      if ((conv as WhatsAppConversation).unread_count > 0) {
        await supabase.from('whatsapp_conversations').update({ unread_count: 0 }).eq('id', convId);
      }
    }

    const { data: msgs } = await supabase.from('whatsapp_messages')
      .select('*').eq('conversation_id', convId).order('created_at', { ascending: true });
    if (msgs) setMessages(msgs as WhatsAppMessage[]);

    const { data: noteData } = await supabase.from('whatsapp_internal_notes')
      .select('*').eq('conversation_id', convId).order('created_at', { ascending: false });
    if (noteData) setNotes(noteData as WhatsAppInternalNote[]);

    // Fetch customer 360
    const c = conv as WhatsAppConversation;
    if (c.customer_id) {
      const [{ data: cust }, { data: caData }, { data: spkData }] = await Promise.all([
        supabase.from('customers').select('*').eq('id', c.customer_id).maybeSingle(),
        supabase.from('credit_applications').select('*').eq('customer_id', c.customer_id).order('created_at', { ascending: false }),
        supabase.from('spks').select('*').eq('customer_id', c.customer_id).order('created_at', { ascending: false }),
      ]);
      let fuData: FollowUp[] = [];
      if (c.lead_id) {
        const { data: fu } = await supabase.from('follow_ups').select('*').or(`lead_id.eq.${c.lead_id}`).order('created_at', { ascending: false });
        if (fu) fuData = fu as FollowUp[];
      }
      setCustomer360({
        customer: cust as Customer,
        lead: null,
        followUps: fuData,
        creditApps: (caData || []) as CreditApplication[],
        spks: (spkData || []) as Spk[],
      });
    } else if (c.lead_id) {
      const { data: lead } = await supabase.from('leads').select('*').eq('id', c.lead_id).maybeSingle();
      const { data: fu } = await supabase.from('follow_ups').select('*').or(`lead_id.eq.${c.lead_id}`).order('created_at', { ascending: false });
      setCustomer360({
        customer: null,
        lead: lead as Lead,
        followUps: (fu || []) as FollowUp[],
        creditApps: [],
        spks: [],
      });
    } else {
      setCustomer360({ customer: null, lead: null, followUps: [], creditApps: [], spks: [] });
    }
  }, []);

  // Realtime for messages
  useEffect(() => {
    if (!selectedId) return;
    const channel = supabase.channel(`wa-messages-${selectedId}`);
    channel.on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'whatsapp_messages',
      filter: `conversation_id=eq.${selectedId}`,
    }, (payload) => {
      setMessages((prev) => [...prev, payload.new as WhatsAppMessage]);
      // Mark as read if it's incoming
      if ((payload.new as WhatsAppMessage).direction === 'incoming') {
        supabase.from('whatsapp_conversations').update({ unread_count: 0 }).eq('id', selectedId);
      }
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!selectedId || !messageText.trim() || !profile) return;
    setSending(true);
    setError(null);
    const conv = selectedConv;
    const textToSend = messageText.trim();
    setMessageText('');

    // Save message to DB with status 'pending' first
    const { data: msgData, error: insertErr } = await supabase.from('whatsapp_messages').insert({
      conversation_id: selectedId,
      direction: 'outgoing',
      message_type: 'text',
      text: textToSend,
      status: 'pending',
      sender_phone: 'dealer',
      recipient_phone: conv?.customer_phone || null,
      created_by: profile.id,
    }).select('id').single();

    if (insertErr) {
      setError(getSafeError(insertErr));
      setSending(false);
      return;
    }

    // Update conversation
    await supabase.from('whatsapp_conversations').update({
      last_message_text: textToSend,
      last_message_at: new Date().toISOString(),
      last_message_direction: 'outgoing',
      status: 'waiting_customer',
      last_response_at: new Date().toISOString(),
      first_response_at: selectedConv?.first_response_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', selectedId);

    // Send through WhatsApp session server
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const phone = conv?.customer_phone?.replace(/\D/g, '');

      if (phone) {
        const sendResp = await fetch(`${supabaseUrl}/functions/v1/whatsapp-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            action: 'send',
            connection_id: conv?.connection_id || undefined,
            phone,
            text: textToSend,
          }),
        });

        if (sendResp.ok) {
          const sendData = await sendResp.json();
          // Update message status to 'sent' and set external_message_id
          if (msgData) {
            await supabase.from('whatsapp_messages').update({
              status: 'sent',
              external_message_id: sendData.message_id || null,
            }).eq('id', msgData.id);
          }
        } else {
          // Send failed — update message status
          if (msgData) {
            await supabase.from('whatsapp_messages').update({ status: 'failed' }).eq('id', msgData.id);
          }
          setError('Pesan gagal dikirim. WhatsApp mungkin tidak terhubung.');
        }
      }
    } catch {
      // Network error — mark as failed
      if (msgData) {
        await supabase.from('whatsapp_messages').update({ status: 'failed' }).eq('id', msgData.id);
      }
      setError('Gagal mengirim pesan. Periksa koneksi.');
    }

    setSending(false);
    fetchConversations();
    // Refresh messages to show updated status
    const { data: msgs } = await supabase.from('whatsapp_messages')
      .select('*').eq('conversation_id', selectedId).order('created_at', { ascending: true });
    if (msgs) setMessages(msgs as WhatsAppMessage[]);
  };

  const handleUseTemplate = (tpl: WhatsAppTemplate) => {
    let content = tpl.content;
    // Replace {{customer_name}} placeholder
    if (selectedConv?.customer_name) {
      content = content.replace(/\{\{customer_name\}\}/g, selectedConv.customer_name);
    }
    setMessageText(content);
    setShowTemplates(false);
  };

  const handleAddNote = async () => {
    if (!selectedId || !noteText.trim() || !profile) return;
    setSavingNote(true);
    const { error: noteErr } = await supabase.from('whatsapp_internal_notes').insert({
      conversation_id: selectedId,
      user_id: profile.id,
      note: noteText.trim(),
    });
    if (noteErr) { setError(getSafeError(noteErr)); setSavingNote(false); return; }
    setNoteText('');
    setSavingNote(false);
    const { data: noteData } = await supabase.from('whatsapp_internal_notes')
      .select('*').eq('conversation_id', selectedId).order('created_at', { ascending: false });
    if (noteData) setNotes(noteData as WhatsAppInternalNote[]);
  };

  const handleAssign = async (salesId: string | null) => {
    if (!selectedId) return;
    const { error: assignErr } = await supabase.from('whatsapp_conversations')
      .update({ assigned_to: salesId || null, updated_at: new Date().toISOString() })
      .eq('id', selectedId);
    if (assignErr) { setError(getSafeError(assignErr)); return; }
    if (selectedConv) setSelectedConv({ ...selectedConv, assigned_to: salesId });
    fetchConversations();
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedId) return;
    const { error: statusErr } = await supabase.from('whatsapp_conversations')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', selectedId);
    if (statusErr) { setError(getSafeError(statusErr)); return; }
    if (selectedConv) setSelectedConv({ ...selectedConv, status: newStatus });
    fetchConversations();
  };

  const handlePriorityChange = async (newPriority: string) => {
    if (!selectedId) return;
    await supabase.from('whatsapp_conversations')
      .update({ priority: newPriority, updated_at: new Date().toISOString() })
      .eq('id', selectedId);
    if (selectedConv) setSelectedConv({ ...selectedConv, priority: newPriority });
    fetchConversations();
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
    const diff = (today.getTime() - d.getTime()) / 86400000;
    if (diff < 7) return d.toLocaleDateString('id-ID', { weekday: 'short' });
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  };

  const selectedAssignee = salesReps.find((r) => r.id === selectedConv?.assigned_to);
  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-neutral-400">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Memuat WhatsApp...
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-green-600" />
          <h1 className="text-base font-bold text-neutral-900">WhatsApp Inbox</h1>
          {totalUnread > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{totalUnread}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterView}
            onChange={(e) => setFilterView(e.target.value as typeof filterView)}
            className="h-8 rounded-md border border-neutral-200 bg-white px-2 text-xs"
          >
            <option value="all">Semua</option>
            <option value="mine">Milik Saya</option>
            <option value="unassigned">Belum Dibagi</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-8 rounded-md border border-neutral-200 bg-white px-2 text-xs"
          >
            <option value="all">Semua Status</option>
            <option value="open">Open</option>
            <option value="waiting_customer">Menunggu Customer</option>
            <option value="waiting_sales">Menunggu Sales</option>
            <option value="resolved">Selesai</option>
          </select>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Column 1: Conversation List */}
        <div className="flex w-64 flex-col border-r border-neutral-200 md:w-72">
          <div className="border-b border-neutral-100 p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama atau nomor..."
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-neutral-400">
                <MessageCircle className="mb-2 h-8 w-8" />
                <p className="text-sm">Belum ada percakapan</p>
              </div>
            ) : (
              conversations.map((conv) => {
                const stCfg = statusConfig[conv.status] || statusConfig.open;
                const isSelected = conv.id === selectedId;
                return (
                  <button
                    key={conv.id}
                    onClick={() => selectConversation(conv.id)}
                    className={cn(
                      'flex w-full items-start gap-3 border-b border-neutral-50 p-3 text-left transition-colors hover:bg-neutral-50',
                      isSelected && 'bg-green-50'
                    )}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700">
                        {conv.customer_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className={cn('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white', stCfg.dot)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="truncate text-sm font-medium text-neutral-900">
                          {conv.customer_name || conv.customer_phone}
                        </p>
                        <span className="ml-1 flex-shrink-0 text-xs text-neutral-400">
                          {conv.last_message_at ? formatTime(conv.last_message_at) : ''}
                        </span>
                      </div>
                      <p className="truncate text-xs text-neutral-500">
                        {conv.last_message_text || 'Belum ada pesan'}
                      </p>
                      <div className="mt-1 flex items-center gap-1">
                        <span className={cn('rounded px-1 py-0.5 text-[10px] font-medium', stCfg.color)}>
                          {stCfg.label}
                        </span>
                        {conv.unread_count > 0 && (
                          <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Column 2: Chat */}
        <div className="flex flex-1 flex-col">
          {selectedConv ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700">
                    {selectedConv.customer_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">
                      {selectedConv.customer_name || selectedConv.customer_phone}
                    </p>
                    <p className="text-xs text-neutral-400">{selectedConv.customer_phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedConv.assigned_to || ''}
                    onChange={(e) => handleAssign(e.target.value || null)}
                    className="h-8 rounded-md border border-neutral-200 bg-white px-2 text-xs"
                  >
                    <option value="">Unassigned</option>
                    {salesReps.map((r) => (
                      <option key={r.id} value={r.id}>{r.full_name}</option>
                    ))}
                  </select>
                  <select
                    value={selectedConv.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="h-8 rounded-md border border-neutral-200 bg-white px-2 text-xs"
                  >
                    {Object.entries(statusConfig).map(([v, c]) => (
                      <option key={v} value={v}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto bg-neutral-50 p-4">
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center text-neutral-400">
                    <div>
                      <MessageCircle className="mx-auto mb-2 h-8 w-8" />
                      <p className="text-sm">Mulai percakapan</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn('flex', msg.direction === 'outgoing' ? 'justify-end' : 'justify-start')}
                      >
                        <div
                          className={cn(
                            'max-w-[75%] rounded-lg px-3 py-2 text-sm',
                            msg.direction === 'outgoing'
                              ? 'bg-green-500 text-white'
                              : 'bg-white text-neutral-800 shadow-sm'
                          )}
                        >
                          {msg.message_type === 'text' ? (
                            <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                          ) : msg.message_type === 'image' ? (
                            <div>
                              {msg.media_url && (
                                <img src={msg.media_url} alt="WhatsApp" className="mb-1 max-w-full rounded" />
                              )}
                              {msg.media_caption && <p className="whitespace-pre-wrap break-words">{msg.media_caption}</p>}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Paperclip className="h-4 w-4" />
                              <span className="text-xs">{msg.message_type}</span>
                              {msg.media_caption && <span> — {msg.media_caption}</span>}
                            </div>
                          )}
                          <div className={cn(
                            'mt-1 flex items-center justify-end gap-1 text-[10px]',
                            msg.direction === 'outgoing' ? 'text-green-100' : 'text-neutral-400'
                          )}>
                            {formatTime(msg.created_at)}
                            {msg.direction === 'outgoing' && (
                              <span>{msgStatusIcons[msg.status] || ''}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {/* Internal notes in chat view (visually distinct) */}
                    {notes.map((n) => (
                      <div key={`note-${n.id}`} className="flex justify-center">
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                          <span className="font-semibold">Catatan Internal: </span>
                          {n.note}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Quick Templates Bar */}
              {showTemplates && (
                <div className="border-t border-neutral-200 bg-white p-2">
                  <div className="flex flex-wrap gap-1">
                    {templates.map((tpl) => (
                      <button
                        key={tpl.id}
                        onClick={() => handleUseTemplate(tpl)}
                        className="rounded-lg border border-neutral-200 px-2 py-1 text-xs hover:bg-green-50"
                        title={tpl.content}
                      >
                        {tpl.shortcut ? `/${tpl.shortcut}` : tpl.name}
                      </button>
                    ))}
                    {templates.length === 0 && (
                      <p className="text-xs text-neutral-400">Belum ada template. Buat di menu Templates.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Message Input */}
              <div className="border-t border-neutral-200 p-3">
                <div className="flex items-end gap-2">
                  <button
                    onClick={() => setShowTemplates(!showTemplates)}
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100"
                    title="Quick replies"
                  >
                    <Smile className="h-5 w-5" />
                  </button>
                  <Textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Ketik pesan..."
                    rows={1}
                    className="min-h-[40px] max-h-32 flex-1 resize-none text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={sending || !messageText.trim()}
                    className="flex-shrink-0 bg-green-600 hover:bg-green-700 text-white"
                    size="icon"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-neutral-400">
              <div className="text-center">
                <MessageCircle className="mx-auto mb-3 h-12 w-12" />
                <p className="text-sm">Pilih percakapan untuk mulai chat</p>
              </div>
            </div>
          )}
        </div>

        {/* Column 3: Customer 360 */}
        <div className="hidden w-64 flex-col border-l border-neutral-200 lg:flex xl:w-72">
          {selectedConv ? (
            <div className="flex h-full flex-col overflow-y-auto">
              {/* Customer Info */}
              <div className="border-b border-neutral-100 p-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-sm font-bold text-neutral-600">
                    {selectedConv.customer_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">
                      {selectedConv.customer_name || 'Unknown'}
                    </p>
                    <p className="truncate text-xs text-neutral-400">{selectedConv.customer_phone}</p>
                  </div>
                </div>

                {/* Priority */}
                <div className="mt-3">
                  <Label className="text-xs text-neutral-500">Priority</Label>
                  <select
                    value={selectedConv.priority}
                    onChange={(e) => handlePriorityChange(e.target.value)}
                    className="mt-1 h-7 w-full rounded-md border border-neutral-200 bg-white px-2 text-xs"
                  >
                    {Object.entries(priorityConfig).map(([v, c]) => (
                      <option key={v} value={v}>{c.label}</option>
                    ))}
                  </select>
                </div>

                {/* Assignment */}
                <div className="mt-2">
                  <Label className="text-xs text-neutral-500">Sales Owner</Label>
                  <p className="mt-1 text-xs font-medium text-neutral-700">
                    {selectedAssignee?.full_name || 'Unassigned'}
                  </p>
                </div>

                {selectedConv.source && (
                  <div className="mt-2">
                    <Label className="text-xs text-neutral-500">Source</Label>
                    <p className="mt-1 text-xs text-neutral-700">{selectedConv.source}</p>
                  </div>
                )}
              </div>

              {/* CRM Links */}
              <div className="border-b border-neutral-100 p-4">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-400">CRM</h3>
                {customer360.customer ? (
                  <Link href={`/admin/customers/${customer360.customer.id}`} className="flex items-center justify-between rounded-lg bg-neutral-50 p-2 text-sm hover:bg-neutral-100">
                    <span className="flex items-center gap-2"><User className="h-4 w-4 text-neutral-400" /> Customer</span>
                    <ChevronRight className="h-3 w-3 text-neutral-300" />
                  </Link>
                ) : customer360.lead ? (
                  <Link href={`/admin/leads/${customer360.lead.id}`} className="flex items-center justify-between rounded-lg bg-neutral-50 p-2 text-sm hover:bg-neutral-100">
                    <span className="flex items-center gap-2"><User className="h-4 w-4 text-neutral-400" /> Lead</span>
                    <ChevronRight className="h-3 w-3 text-neutral-300" />
                  </Link>
                ) : (
                  <p className="text-xs text-neutral-400">Belum terhubung ke CRM</p>
                )}

                {/* Follow-ups */}
                {customer360.followUps.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-neutral-500">Follow-up ({customer360.followUps.length})</p>
                    {customer360.followUps.slice(0, 2).map((fu) => (
                      <div key={fu.id} className="mt-1 rounded-lg bg-neutral-50 p-2 text-xs">
                        <p className="font-medium text-neutral-700">{fu.type}</p>
                        <p className="text-neutral-400">{fu.scheduled_at ? formatTime(fu.scheduled_at) : ''}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Credit */}
                {customer360.creditApps.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-neutral-500">Kredit ({customer360.creditApps.length})</p>
                    {customer360.creditApps.slice(0, 2).map((ca) => (
                      <div key={ca.id} className="mt-1 rounded-lg bg-neutral-50 p-2 text-xs">
                        <p className="font-medium text-neutral-700">{ca.motor_name || '-'}</p>
                        <p className="text-neutral-400">{ca.status}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* SPK */}
                {customer360.spks.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-neutral-500">SPK ({customer360.spks.length})</p>
                    {customer360.spks.slice(0, 2).map((s) => (
                      <div key={s.id} className="mt-1 rounded-lg bg-neutral-50 p-2 text-xs">
                        <p className="font-mono font-medium text-red-600">{s.spk_number}</p>
                        <p className="text-neutral-400">{s.status}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Internal Notes */}
              <div className="flex-1 p-4">
                <h3 className="mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-neutral-400">
                  <StickyNote className="h-3 w-3" /> Catatan Internal
                </h3>
                <div className="mb-2 space-y-1">
                  {notes.length === 0 ? (
                    <p className="text-xs text-neutral-400">Belum ada catatan.</p>
                  ) : (
                    notes.slice(0, 5).map((n) => (
                      <div key={n.id} className="rounded-lg border border-amber-100 bg-amber-50 p-2 text-xs text-amber-800">
                        {n.note}
                        <p className="mt-1 text-[10px] text-amber-500">{formatTime(n.created_at)}</p>
                      </div>
                    ))
                  )}
                </div>
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Catatan internal (tidak dikirim ke customer)..."
                  rows={2}
                  className="text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddNote}
                  disabled={savingNote || !noteText.trim()}
                  className="mt-1 w-full text-xs"
                >
                  {savingNote ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Tambah Catatan
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-neutral-300">
              <User className="h-8 w-8" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
