import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Room, Message, Lead, MessageStatusHistory, RoomParticipant } from '@/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Hook untuk subscribe ke rooms dengan realtime updates
 * Auto-sort berdasarkan last message timestamp (WhatsApp-like behavior)
 */
export function useRooms(userId: string, userRole: 'admin' | 'supervisor' | 'agent') {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchRooms = useCallback(async () => {
    try {
      setLoading(true);
      
      let roomIds: string[] = [];

      // Filter based on role
      if (userRole === 'agent') {
        // Agents only see rooms they're participants in
        const { data: participantRooms } = await supabase
          .from('room_participants')
          .select('room_id')
          .eq('user_id', userId);
        
        roomIds = participantRooms?.map((p: any) => p.room_id) || [];
        
        if (roomIds.length === 0) {
          setRooms([]);
          setLoading(false);
          return;
        }
      }

      let query = supabase
        .from('rooms')
        .select('*')
        .order('updated_at', { ascending: false });

      if (userRole === 'agent' && roomIds.length > 0) {
        query = query.in('id', roomIds);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Process rooms to get last message and unread count
      const processedRooms = await Promise.all((data || []).map(async (room: any) => {
        // Get lead info
        let lead = null;
        if (room.leads_id) {
          const { data: leadData } = await supabase
            .from('leads')
            .select('*')
            .eq('id', room.leads_id)
            .single();
          lead = leadData;
        }

        // Get last message
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('*')
          .eq('room_id', room.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Get unread count (messages that are not 'read' and from customer)
        const { count: unreadCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('room_id', room.id)
          .is('user_id', null) // from customer
          .neq('status', 'read');

        return {
          ...room,
          lead,
          last_message: lastMsg,
          unread_count: unreadCount || 0,
        };
      }));

      // Sort by last message timestamp (most recent first)
      processedRooms.sort((a: any, b: any) => {
        const aTime = a.last_message?.created_at || a.updated_at;
        const bTime = b.last_message?.created_at || b.updated_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      setRooms(processedRooms as Room[]);
      setError(null);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching rooms:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, userRole]);

  useEffect(() => {
    fetchRooms();

    // Subscribe to realtime changes
    const channel: RealtimeChannel = supabase
      .channel('rooms-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms' },
        (payload) => {
          console.log('Room change received!', payload);
          fetchRooms(); // Refetch to get updated data with joins
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          console.log('New message received!', payload);
          fetchRooms(); // Refetch to update last message and sort
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          console.log('Message updated!', payload);
          fetchRooms(); // Refetch to update message status
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRooms]);

  return { rooms, loading, error, refetch: fetchRooms };
}

/**
 * Hook untuk subscribe ke messages dalam sebuah room
 */
export function useMessages(roomId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!roomId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data, error: fetchError } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

      setMessages(data || []);
      setError(null);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchMessages();

    if (!roomId) return;

    // Subscribe to realtime messages for this room
    const channel: RealtimeChannel = supabase
      .channel(`messages-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          console.log('Message change in room:', payload);
          
          if (payload.eventType === 'INSERT') {
            setMessages((prev) => [...prev, payload.new as Message]);
          } else if (payload.eventType === 'UPDATE') {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === payload.new.id ? (payload.new as Message) : msg
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) =>
              prev.filter((msg) => msg.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, fetchMessages]);

  return { messages, loading, error, refetch: fetchMessages };
}

/**
 * Hook untuk subscribe ke message status history
 */
export function useMessageStatus(messageId: string | null) {
  const [statusHistory, setStatusHistory] = useState<MessageStatusHistory[]>([]);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!messageId) {
      setStatusHistory([]);
      setCurrentStatus(null);
      setLoading(false);
      return;
    }

    const fetchStatus = async () => {
      const { data } = await supabase
        .from('message_status_history')
        .select('*')
        .eq('message_id', messageId)
        .order('timestamp', { ascending: true });

      if (data && data.length > 0) {
        setStatusHistory(data as MessageStatusHistory[]);
        setCurrentStatus((data[data.length - 1] as any)?.status || null);
      }
      setLoading(false);
    };

    fetchStatus();

    // Subscribe to status changes
    const channel = supabase
      .channel(`status-${messageId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_status_history',
          filter: `message_id=eq.${messageId}`,
        },
        (payload) => {
          const newStatus = payload.new as MessageStatusHistory;
          setStatusHistory((prev) => [...prev, newStatus]);
          setCurrentStatus(newStatus.status);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [messageId]);

  return { statusHistory, currentStatus, loading };
}

/**
 * Hook untuk subscribe ke lead data
 */
export function useLead(leadId: string | null) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!leadId) {
      setLead(null);
      setLoading(false);
      return;
    }

    const fetchLead = async () => {
      try {
        setLoading(true);
        const { data, error: fetchError } = await supabase
          .from('leads')
          .select('*')
          .eq('id', leadId)
          .single();

        if (fetchError) throw fetchError;

        setLead(data);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching lead:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLead();

    // Subscribe to lead changes
    const channel = supabase
      .channel(`lead-${leadId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'leads',
          filter: `id=eq.${leadId}`,
        },
        (payload) => {
          setLead(payload.new as Lead);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leadId]);

  return { lead, loading, error };
}

/**
 * Hook untuk check apakah user bisa akses room (based on role & participants)
 */
export function useRoomAccess(roomId: string | null, userId: string, userRole: 'admin' | 'supervisor' | 'agent') {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) {
      setHasAccess(false);
      setLoading(false);
      return;
    }

    const checkAccess = async () => {
      // Admin and Supervisor have access to all rooms
      if (userRole === 'admin' || userRole === 'supervisor') {
        setHasAccess(true);
        setLoading(false);
        return;
      }

      // Agent: check if they're a participant
      const { data } = await supabase
        .from('room_participants')
        .select('*')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .single();

      setHasAccess(!!data);
      setLoading(false);
    };

    checkAccess();
  }, [roomId, userId, userRole]);

  return { hasAccess, loading };
}
