'use client';

import { useEffect, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';

export interface Room {
  room_id: string;
  room_phone: string;
  room_title: string;
  room_created_at: string;
  room_updated_at: string;
  room_leads_id?: string | null; // Direct leads_id from rooms table
  leads_info?: {
    id: string;
    utm_id?: string | null;
    name: string;
    phone: string;
    outstanding?: number;
    loan_type?: string;
    leads_status: string;
    contact_status: string;
  } | null;
  participants?: Array<{
    user_id: string;
    name: string;
    role: string;
  }>;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
  is_assigned?: boolean; // Backend field: true if room has assigned agents
  participant_count?: number; // Backend field: count of participants in room
  participant_joined_at?: string; // Backend field: when user joined room
}

interface UseRealtimeRoomsProps {
  socket: Socket | null;
  isConnected: boolean;
  userId?: string;
  userRole?: string;
}

export function useRealtimeRooms({ socket, isConnected, userId, userRole }: UseRealtimeRoomsProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true); // Start with true, waiting for userId
  const [error, setError] = useState<string | null>(null);

  // ✅ Fetch all rooms from REST API with retry logic
  const fetchRooms = useCallback(async (retryCount = 0) => {
    // Early return if userId not ready (avoid unnecessary API call)
    if (!userId || !userRole) {
      console.log('⏸️ fetchRooms called but userId/userRole not ready yet, skipping...');
      setLoading(true); // Keep showing loading state
      return;
    }
    
    const MAX_RETRIES = 2;
    const RETRY_DELAY = 1500; // 1.5 seconds between retries
    
    try {
      setLoading(true);
      setError(null);
      
      if (retryCount > 0) {
        console.log(`🔄 Retry attempt ${retryCount}/${MAX_RETRIES}...`);
      }
      
      console.log('📚 Fetching room list...', { 
        userId, 
        userRole,
        hasUserId: !!userId,
        willFilter: userRole === 'agent' && !!userId,
        retryCount
      });
      
      // Build URL with query params - ALWAYS include user_id
      // Backend will handle role-based filtering (admin gets all, agent gets assigned only)
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      
      const url = `${baseUrl}/rooms?user_id=${userId}`;
      
      console.log('� Fetching rooms with user_id:', {
        userId,
        userRole,
        url,
        note: 'Backend will filter based on role'
      });
      
      const response = await fetch(url);
      
      console.log('📡 Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        
        // Only log as error if it's the final attempt
        if (retryCount >= MAX_RETRIES || response.status !== 500) {
          console.error('❌ Backend error response:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText,
            retryCount,
            willRetry: response.status === 500 && retryCount < MAX_RETRIES
          });
        } else {
          console.warn('⚠️ Backend error, will retry:', {
            status: response.status,
            retryCount,
            nextRetryIn: `${RETRY_DELAY * (retryCount + 1)}ms`
          });
        }
        
        // ✅ RETRY LOGIC: If 500 error and not max retries, try again
        if (response.status === 500 && retryCount < MAX_RETRIES) {
          console.log(`⏳ Backend error 500 - Will retry in ${RETRY_DELAY}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
          
          // Recursive retry
          return fetchRooms(retryCount + 1);
        }
        
        throw new Error(
          `Backend Error ${response.status}: ${response.statusText}\n\n` +
          `Response: ${errorText}\n\n` +
          `URL: ${url}\n\n` +
          `Troubleshooting:\n` +
          `- Check if backend is running on localhost:8080\n` +
          `- Check backend logs for SQL/database errors\n` +
          `- Verify room_participants table has data for this user`
        );
      }
      
      const data = await response.json();
      console.log('📊 Rooms response:', {
        success: data.success,
        roomCount: data.data?.rooms?.length || 0,
        hasData: !!data.data,
        totalCount: data.data?.total_count
      });
      
      if (data.success && data.data?.rooms) {
        const roomCount = data.data.rooms.length;
        console.log(`✅ Loaded ${roomCount} rooms`);
        
        if (roomCount === 0) {
          console.warn('⚠️ No rooms found!', {
            userRole,
            userId,
            hint: userRole === 'agent' 
              ? 'Agent might not be assigned to any rooms. Check room_participants table.'
              : 'No rooms exist in database yet.'
          });
        }
        
        // Sort by latest activity
        const sortedRooms = data.data.rooms.sort((a: Room, b: Room) => {
          const dateA = new Date(a.last_message_at || a.room_updated_at).getTime();
          const dateB = new Date(b.last_message_at || b.room_updated_at).getTime();
          return dateB - dateA;
        });
        
        setRooms(sortedRooms);
      } else {
        console.warn('⚠️ Unexpected response format:', data);
        setRooms([]);
      }
    } catch (error) {
      console.error('❌ Failed to fetch rooms:', error);
      
      // More user-friendly error message
      let errorMessage = 'Failed to load rooms';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Add helpful hint for 500 errors after retries
        if (error.message.includes('500') && retryCount >= MAX_RETRIES) {
          errorMessage += '\n\n💡 Tip: Backend may need more time to sync. Please try again in a few seconds.';
        }
      }
      
      setError(errorMessage);
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, [userId, userRole]);

  // Load rooms when userId becomes available (after login or from localStorage)
  useEffect(() => {
    if (!userId || !userRole) {
      console.log('⏳ Waiting for userId and userRole...', { userId, userRole });
      setLoading(true); // Keep loading until userId is ready
      setError(null);
      return;
    }
    
    console.log('✅ userId and userRole ready, fetching rooms...', { userId, userRole });
    fetchRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, userRole]); // Trigger when userId/userRole changes (after login)

  // ✅ Socket.IO for real-time room updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    console.log('📨 Listening for room updates...');

    // ✅ NEW ROOM COMPLETE EVENT - Customer baru ngechat dengan FULL DATA!
    // Backend emit ke SEMUA users (admin/supervisor bisa assign)
    // Agent: Hanya show jika mereka di-assign ke room
    // Data sudah lengkap: room + first message + leads info (NO RACE CONDITION!)
    socket.on('new_room_complete', (newRoom: {
      room_id: string;
      room_phone: string;
      room_title: string;
      room_created_at: string;
      room_updated_at: string;
      leads_id?: string | null;
      leads_info?: {
        id: string;
        utm_id?: string | null;
        name: string;
        phone: string;
        outstanding?: number;
        loan_type?: string;
        leads_status: string;
        contact_status: string;
      } | null;
      last_message?: {
        id: string;
        content_text: string;
        content_type: string;
        created_at: string;
        user_id: string | null;
        wa_message_id: string;
      };
      last_message_text?: string;
      last_message_timestamp?: string;
      last_message_type?: string;
      unread_count?: number;
      message_count?: number;
      participants?: Array<{
        id: string;
        user_id: string;
        user_name: string;
        user_email: string;
        user_role: string;
        joined_at: string;
      }>;
    }) => {
      console.log('🆕 NEW ROOM COMPLETE - Customer baru ngechat dengan FULL DATA!', {
        roomId: newRoom.room_id,
        phone: newRoom.room_phone,
        title: newRoom.room_title,
        leadsName: newRoom.leads_info?.name,
        lastMessage: newRoom.last_message_text,
        hasCompleteData: !!(newRoom.leads_info && newRoom.last_message),
        timestamp: newRoom.room_created_at,
        currentUserRole: userRole,
      });
      
      // ✅ NEW LOGIC: Backend already filters events by user role
      // If agent receives this event, it means they are assigned to this room
      // No need to check userRole here - trust backend filtering
      console.log('✅ Received new_room_complete event (backend already filtered by role)');
      
      // ✅ Transform to Room format (data already complete from backend!)
      const roomData: Room = {
        room_id: newRoom.room_id,
        room_phone: newRoom.room_phone,
        room_title: newRoom.room_title,
        room_created_at: newRoom.room_created_at,
        room_updated_at: newRoom.room_updated_at,
        room_leads_id: newRoom.leads_id,
        leads_info: newRoom.leads_info,
        last_message: newRoom.last_message_text,
        last_message_at: newRoom.last_message_timestamp || newRoom.room_created_at,
        unread_count: newRoom.unread_count || 1,
        is_assigned: false, // New room is always unassigned initially
        participants: newRoom.participants?.map(p => ({
          user_id: p.user_id,
          name: p.user_name,
          role: p.user_role,
        })) || [],
      };
      
      setRooms(prev => {
        // Check if room already exists (prevent duplicates)
        const exists = prev.some(r => r.room_id === newRoom.room_id);
        if (exists) {
          console.log('⚠️ Room already exists, updating with complete data');
          // Update existing room with complete data
          return prev.map(r => r.room_id === newRoom.room_id ? roomData : r);
        }
        
        console.log('✅ Adding NEW COMPLETE room to TOP of list (Admin/Supervisor can assign agents)');
        // Add to TOP of list (paling atas seperti WhatsApp)
        return [roomData, ...prev];
      });
      
      // Show browser notification (only for admin/supervisor)
      if (typeof window !== 'undefined' && Notification.permission === 'granted') {
        const customerName = newRoom.leads_info?.name || newRoom.room_title || newRoom.room_phone;
        new Notification('💬 New Chat', {
          body: `New message from ${customerName}`,
          icon: '/logo.png',
          tag: newRoom.room_id,
        });
      }
      
      // Play notification sound
      try {
        const audio = new Audio('/sounds/new-chat.mp3');
        audio.play().catch(e => console.log('🔇 Sound play failed:', e));
      } catch (e) {
        console.log('🔇 Sound not available');
      }
    });

    // ✅ NEW MESSAGE EVENT - Update room preview for existing rooms
    // Note: For NEW rooms, use new_room_complete event instead
    socket.on('new_message', (message: {
      id: string;
      room_id: string;
      user_id: string | null;
      content_type: string;
      content_text?: string;
      created_at: string;
    }) => {
      console.log('📩 New message in room:', message.room_id);
      
      setRooms(prev => {
        // Check if room exists in current list
        const roomExists = prev.some(room => room.room_id === message.room_id);
        
        if (!roomExists) {
          console.warn('⚠️ Message for UNKNOWN room - Should have received new_room_complete first!', {
            roomId: message.room_id,
            messageText: message.content_text,
            hint: 'Backend should emit new_room_complete before new_message for new rooms'
          });
          
          // Edge case: Room might be filtered out (e.g., agent not assigned yet)
          // Just log and ignore - room will appear when agent is assigned
          return prev;
        }
        
        // ✅ Update room preview with latest message
        const updated = prev.map(room => {
          if (room.room_id === message.room_id) {
            return {
              ...room,
              last_message: message.content_text || '[Media]',
              last_message_at: message.created_at,
              room_updated_at: message.created_at,
              // Increment unread count if from customer (user_id = null)
              unread_count: message.user_id === null 
                ? (room.unread_count || 0) + 1 
                : room.unread_count,
            };
          }
          return room;
        });
        
        // ✅ Sort by latest message (WhatsApp-like behavior)
        return updated.sort((a, b) => {
          const dateA = new Date(a.last_message_at || a.room_updated_at).getTime();
          const dateB = new Date(b.last_message_at || b.room_updated_at).getTime();
          return dateB - dateA;
        });
      });
    });

    // ✅ AGENT ASSIGNMENT EVENT
    // When agent assigned to room, add room to their list (if not already there)
    socket.on('agent_assigned', (data: {
      room_id: string;
      agent_id: string;
      agent_name: string;
      assigned_at: string;
      room?: {
        id: string;
        phone: string;
        title: string;
        created_at: string;
        updated_at: string;
      };
    }) => {
      console.log('👤 Agent assigned to room:', {
        roomId: data.room_id,
        agentId: data.agent_id,
        agentName: data.agent_name,
        currentUserId: userId,
        isCurrentUser: data.agent_id === userId,
      });
      
      // ✅ NEW LOGIC: Backend already filters who receives this event
      // If user receives this event, it means they should see this room update
      // Update room participants regardless of role
      console.log('🔄 Updating room participants after agent assignment');
      
      setRooms(prev => {
          // Check if room already exists
          const exists = prev.some(r => r.room_id === data.room_id);
          
          if (exists) {
            console.log('ℹ️ Room already in list, updating participants and is_assigned');
            // Just update participants and is_assigned
            return prev.map(room => {
              if (room.room_id === data.room_id) {
                const participants = room.participants || [];
                const agentExists = participants.some(p => p.user_id === data.agent_id);
                
                if (!agentExists) {
                  return {
                    ...room,
                    is_assigned: true,
                    participants: [
                      ...participants,
                      {
                        user_id: data.agent_id,
                        name: data.agent_name,
                        role: 'agent',
                      }
                    ],
                  };
                }
                // Agent already exists, just update is_assigned
                return {
                  ...room,
                  is_assigned: true,
                };
              }
              return room;
            });
          }
          
          // Room not in list, need to fetch from backend or use provided data
          if (data.room) {
            console.log('✅ Adding newly assigned room to agent list');
            const newRoom: Room = {
              room_id: data.room.id,
              room_phone: data.room.phone,
              room_title: data.room.title,
              room_created_at: data.room.created_at,
              room_updated_at: data.room.updated_at,
              is_assigned: true, // Room is assigned (agent just got assigned)
              participants: [{
                user_id: data.agent_id,
                name: data.agent_name,
                role: 'agent',
              }],
              last_message: undefined,
              last_message_at: data.room.created_at,
              unread_count: 0,
            };
            
            // Add to top (newly assigned rooms should be visible)
            return [newRoom, ...prev];
          } else {
            // Room data not provided, refetch from API
            console.log('⚠️ Room data not provided, triggering refetch...');
            // Trigger refetch after small delay
            setTimeout(() => {
              fetchRooms();
            }, 500);
          }
          
          return prev;
        });
        
        // Show notification if this user was assigned
        if (data.agent_id === userId && typeof window !== 'undefined' && Notification.permission === 'granted') {
          new Notification('🎯 New Assignment', {
            body: `You've been assigned to chat with ${data.room?.title || data.room?.phone || 'customer'}`,
            icon: '/logo.png',
            tag: data.room_id,
          });
        }
    });

    // ✅ AGENT UNASSIGNMENT EVENT
    // Backend already filters who receives this event based on role
    socket.on('agent_unassigned', (data: {
      room_id: string;
      agent_id: string;
    }) => {
      console.log('👤 Agent unassigned from room:', {
        roomId: data.room_id,
        agentId: data.agent_id,
        currentUserId: userId,
        isCurrentUser: data.agent_id === userId,
      });
      
      // ✅ If THIS user was unassigned, remove room from their list
      if (data.agent_id === userId) {
        console.log('🚫 This user was unassigned! Removing room from list...');
        
        setRooms(prev => prev.filter(room => room.room_id !== data.room_id));
        
        // Show notification
        if (typeof window !== 'undefined' && Notification.permission === 'granted') {
          new Notification('🚫 Unassigned', {
            body: 'You\'ve been removed from a chat',
            icon: '/logo.png',
            tag: data.room_id,
          });
        }
      } else {
        // Not this agent, just update participants and is_assigned for admin/supervisor view
        setRooms(prev => prev.map(room => {
          if (room.room_id === data.room_id) {
            const updatedParticipants = (room.participants || []).filter(p => p.user_id !== data.agent_id);
            return {
              ...room,
              is_assigned: updatedParticipants.length > 0,
              participants: updatedParticipants,
            };
          }
          return room;
        }));
      }
    });

    // Cleanup
    return () => {
      socket.off('new_room_complete');
      socket.off('new_message');
      socket.off('agent_assigned');
      socket.off('agent_unassigned');
    };
  }, [socket, isConnected]);

  // Reset unread count for a room
  const markRoomAsRead = useCallback((roomId: string) => {
    setRooms(prev => prev.map(room => 
      room.room_id === roomId 
        ? { ...room, unread_count: 0 }
        : room
    ));
  }, []);

  return {
    rooms,
    loading,
    error,
    refetch: () => fetchRooms(0), // Reset retry count when manually refetching
    markRoomAsRead,
  };
}
