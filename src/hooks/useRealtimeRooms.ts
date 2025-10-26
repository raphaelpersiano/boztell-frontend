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
    name: string;
    phone: string;
    leads_status: string;
    contact_status: string;
  };
  participants?: Array<{
    user_id: string;
    name: string;
    role: string;
  }>;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
  is_assigned?: boolean; // Backend field: true if room has assigned agents
}

interface UseRealtimeRoomsProps {
  socket: Socket | null;
  isConnected: boolean;
  userId?: string;
  userRole?: string;
}

export function useRealtimeRooms({ socket, isConnected, userId, userRole }: UseRealtimeRoomsProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ Fetch all rooms from REST API
  const fetchRooms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📚 Fetching room list...', { 
        userId, 
        userRole,
        hasUserId: !!userId,
        willFilter: userRole === 'agent' && !!userId
      });
      
      // Build URL with query params for agent filtering
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      let url = `${baseUrl}/rooms`;
      
      // For agents, add user_id to filter their assigned rooms
      // Admin/Supervisor: GET /rooms (all rooms)
      // Agent: GET /rooms?user_id=<agent_uuid> (only assigned rooms)
      if (userRole === 'agent' && userId) {
        url += `?user_id=${userId}`;
        console.log('🔍 Agent mode: Filtering rooms by user_id');
      } else {
        console.log('👥 Admin/Supervisor mode: Fetching all rooms');
      }
      
      console.log('📡 Fetching from:', url);
      
      const response = await fetch(url);
      
      console.log('📡 Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Backend error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        
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
      setError(error instanceof Error ? error.message : 'Failed to load rooms');
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, [userId, userRole]);

  // Load rooms on mount
  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // ✅ Socket.IO for real-time room updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    console.log('📨 Listening for room updates...');

    // ✅ NEW ROOM EVENT - Customer baru ngechat!
    // Backend emit ke SEMUA users (admin/supervisor bisa assign)
    // Agent: Hanya show jika mereka di-assign ke room
    socket.on('new_room', (newRoom: {
      id: string;
      phone: string;
      title: string;
      leads_id?: string;
      created_at: string;
      updated_at: string;
    }) => {
      console.log('🆕 NEW ROOM CREATED - Customer baru ngechat!', {
        roomId: newRoom.id,
        phone: newRoom.phone,
        title: newRoom.title,
        timestamp: newRoom.created_at,
        currentUserRole: userRole,
      });
      
      // ✅ BEST PRACTICE: Hybrid approach
      // - Admin/Supervisor: Show semua new rooms (biar bisa assign)
      // - Agent: SKIP dulu, tunggu agent_assigned event atau refetch
      if (userRole === 'agent') {
        console.log('ℹ️ Agent mode: Room tidak otomatis ditambah (tunggu assignment)');
        console.log('💡 Hint: Supervisor harus assign agent ke room ini dulu');
        return; // SKIP - Agent akan dapat room via refetch atau agent_assigned event
      }
      
      // Transform to Room format
      const roomData: Room = {
        room_id: newRoom.id,
        room_phone: newRoom.phone,
        room_title: newRoom.title,
        room_created_at: newRoom.created_at,
        room_updated_at: newRoom.updated_at,
        last_message: undefined,
        last_message_at: newRoom.created_at,
        unread_count: 0,
        is_assigned: false, // New room is always unassigned initially
      };
      
      setRooms(prev => {
        // Check if room already exists
        const exists = prev.some(r => r.room_id === newRoom.id);
        if (exists) {
          console.log('⚠️ Room already exists, skipping');
          return prev;
        }
        
        console.log('✅ Adding new room to TOP of list (Admin/Supervisor can assign agents)');
        // Add to TOP of list (paling atas seperti WhatsApp)
        return [roomData, ...prev];
      });
      
      // Show browser notification (only for admin/supervisor)
      if (typeof window !== 'undefined' && Notification.permission === 'granted') {
        new Notification('💬 New Chat', {
          body: `New chat from ${newRoom.title || newRoom.phone}`,
          icon: '/logo.png',
          tag: newRoom.id,
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

    // ✅ NEW MESSAGE EVENT - Update room preview
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
        // Update room preview
        const updated = prev.map(room => {
          if (room.room_id === message.room_id) {
            return {
              ...room,
              last_message: message.content_text || '[Media]',
              last_message_at: message.created_at,
              // Increment unread count if from customer (user_id = null)
              unread_count: message.user_id === null 
                ? (room.unread_count || 0) + 1 
                : room.unread_count,
            };
          }
          return room;
        });
        
        // Sort by latest message (WhatsApp-like behavior)
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
      
      // ✅ If THIS agent was assigned, add room to their list
      if (userRole === 'agent' && data.agent_id === userId) {
        console.log('🎯 This agent was assigned! Adding room to list...');
        
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
        
        // Show notification for agent
        if (typeof window !== 'undefined' && Notification.permission === 'granted') {
          new Notification('🎯 New Assignment', {
            body: `You've been assigned to chat with ${data.room?.title || data.room?.phone || 'customer'}`,
            icon: '/logo.png',
            tag: data.room_id,
          });
        }
      } else {
        // Not this agent, just update participants and is_assigned for admin/supervisor view
        setRooms(prev => prev.map(room => {
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
        }));
      }
    });

    // ✅ AGENT UNASSIGNMENT EVENT
    // When agent unassigned from room, remove room from their list (agents only)
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
      
      // ✅ If THIS agent was unassigned, remove room from their list
      if (userRole === 'agent' && data.agent_id === userId) {
        console.log('🚫 This agent was unassigned! Removing room from list...');
        
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
      socket.off('new_room');
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
    refetch: fetchRooms,
    markRoomAsRead,
  };
}
