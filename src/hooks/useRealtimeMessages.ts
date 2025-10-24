'use client';

import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { Message } from '@/types';
import { ApiService } from '@/lib/api';

interface UseRealtimeMessagesProps {
  socket: Socket | null;
  roomId: string;
  isConnected: boolean;
}

export function useRealtimeMessages({ socket, roomId, isConnected }: UseRealtimeMessagesProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  // ✅ STEP 1: Fetch historical messages from REST API (CRITICAL!)
  useEffect(() => {
    if (!roomId) return;

    const fetchHistoricalMessages = async () => {
      try {
        setLoading(true);
        console.log('📚 Fetching historical messages for room:', roomId);
        
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/messages/room/${roomId}?limit=${LIMIT}&order=desc`
        );
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('🔍 Backend response:', data);
        console.log('🔍 Response structure:', {
          success: data.success,
          hasMessages: !!data.messages,
          messageCount: data.messages?.length || 0,
          firstMessage: data.messages?.[0],
        });
        
        if (data.success && data.messages) {
          // Reverse because order=desc (newest first from API)
          const historicalMessages = data.messages.reverse();
          console.log(`✅ Loaded ${historicalMessages.length} historical messages`);
          
          // 🔍 DEBUG: Log message types
          const typeCounts = historicalMessages.reduce((acc: any, msg: Message) => {
            const type = msg.content_type || 'unknown';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          }, {});
          console.log('📊 Message types loaded:', typeCounts);
          
          // 🔍 DEBUG: Log media messages specifically
          const mediaMessages = historicalMessages.filter((msg: Message) => 
            ['image', 'video', 'audio', 'voice', 'document', 'media'].includes(msg.content_type || '')
          );
          console.log(`📷 Media messages: ${mediaMessages.length}`, mediaMessages);
          
          setMessages(historicalMessages);
          setHasMore(data.has_more || false);
          setOffset(historicalMessages.length);
        } else {
          console.warn('⚠️ No messages in response or success=false');
          setMessages([]);
        }
      } catch (error) {
        console.error('❌ Failed to fetch historical messages:', error);
        // Set empty array but don't block UI
        setMessages([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHistoricalMessages();
  }, [roomId]);

  // ✅ STEP 2: Socket.IO for real-time updates AFTER historical data loaded
  useEffect(() => {
    if (!socket || !isConnected || !roomId) return;

    console.log('📨 Joining room for real-time updates:', roomId);
    
    // Join room
    socket.emit('join_room', roomId);
    
    // 🔍 DEBUG: Confirm room joined (if backend emits this)
    socket.on('room_joined', (data) => {
      console.log('✅ Room joined confirmation:', data);
    });

    // ✅ CRITICAL: Listen for new messages globally (handles both room-specific and broadcast events)
    const handleNewMessage = (message: Message) => {
      // ✅ Validate message structure
      if (!message) {
        console.error('❌ Received null/undefined message');
        return;
      }
      
      if (!message.id) {
        console.error('❌ Received message without id:', message);
        return;
      }
      
      if (!message.room_id) {
        console.error('❌ Received message without room_id:', message);
        return;
      }
      
      console.log('📩 New message received via Socket.IO:', {
        messageId: message.id,
        roomId: message.room_id,
        currentRoom: roomId,
        contentPreview: message.content_text?.substring(0, 50),
        fullMessage: message, // 🔍 DEBUG: Log full message
      });
      
      // Only add if belongs to current room
      if (message.room_id === roomId) {
        console.log('✅ Message belongs to current room, adding to state');
        setMessages(prev => {
          // Avoid duplicates
          const exists = prev.some(m => 
            m.id === message.id || 
            (m.wa_message_id && m.wa_message_id === message.wa_message_id)
          );
          
          if (exists) {
            console.log('⚠️ Message already exists, skipping');
            return prev;
          }
          
          console.log('✅ Adding new message to state');
          return [...prev, message].sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });
      } else {
        console.log('ℹ️ Message for different room, ignoring');
      }
    };

    // Listen for new messages (GLOBAL broadcast from backend)
    socket.on('new_message', handleNewMessage);
    
    // ALSO listen for room-specific messages (room:new_message)
    // Backend emits both for backward compatibility
    socket.on(`room:new_message`, handleNewMessage);

    // Listen for message status updates
    socket.on('message_status_update', (statusUpdate: {
      wa_message_id: string;
      status: 'sent' | 'delivered' | 'read' | 'failed';
      status_timestamp: string;
      room_id: string;
    }) => {
      console.log('📊 Status update:', statusUpdate);
      
      if (statusUpdate.room_id === roomId) {
        setMessages(prev => prev.map(msg => 
          msg.wa_message_id === statusUpdate.wa_message_id
            ? { ...msg, status: statusUpdate.status, status_timestamp: statusUpdate.status_timestamp }
            : msg
        ));
      }
    });

    // Listen for typing indicator
    socket.on('typing_indicator', (data: {
      room_id: string;
      is_typing: boolean;
      user: string;
    }) => {
      if (data.room_id === roomId) {
        setIsTyping(data.is_typing);
        
        // Auto-hide typing after 3 seconds
        if (data.is_typing) {
          setTimeout(() => setIsTyping(false), 3000);
        }
      }
    });

    // Cleanup on unmount or room change
    return () => {
      console.log('📤 Leaving room:', roomId);
      socket.emit('leave_room', roomId);
      socket.off('new_message', handleNewMessage);
      socket.off('room:new_message', handleNewMessage);
      socket.off('room_joined');
      socket.off('message_status_update');
      socket.off('typing_indicator');
    };
  }, [socket, roomId, isConnected]);

  // Load more older messages (pagination)
  const loadMoreMessages = async () => {
    if (!hasMore || loading) return;

    try {
      setLoading(true);
      console.log(`📚 Loading more messages (offset: ${offset})...`);
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/messages/room/${roomId}?limit=${LIMIT}&offset=${offset}&order=desc`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.messages && data.messages.length > 0) {
        const olderMessages = data.messages.reverse();
        console.log(`✅ Loaded ${olderMessages.length} more messages`);
        
        setMessages(prev => {
          // Prepend older messages (avoid duplicates)
          const newMessages = olderMessages.filter(
            (newMsg: Message) => !prev.some(existingMsg => existingMsg.id === newMsg.id)
          );
          return [...newMessages, ...prev];
        });
        
        setHasMore(data.has_more || false);
        setOffset(prev => prev + olderMessages.length);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('❌ Failed to load more messages:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    messages,
    isTyping,
    loading,
    hasMore,
    setMessages, // Allow external updates (for optimistic UI)
    loadMoreMessages,
  };
}
