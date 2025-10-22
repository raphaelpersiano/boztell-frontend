'use client';

import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { Message } from '@/types';

interface UseRealtimeMessagesProps {
  socket: Socket | null;
  roomId: string;
  isConnected: boolean;
}

export function useRealtimeMessages({ socket, roomId, isConnected }: UseRealtimeMessagesProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!socket || !isConnected || !roomId) return;

    console.log('📨 Joining room:', roomId);
    
    // Join room
    socket.emit('join_room', roomId);

    // Listen for new messages
    socket.on('new_message', (message: Message) => {
      console.log('📩 New message received:', message);
      
      setMessages(prev => {
        // Avoid duplicates
        const exists = prev.some(m => m.id === message.id || m.wa_message_id === message.wa_message_id);
        if (exists) return prev;
        
        return [...prev, message].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });
    });

    // Listen for message status updates
    socket.on('message_status_update', (statusUpdate: {
      wa_message_id: string;
      status: 'sent' | 'delivered' | 'read' | 'failed';
      status_timestamp: string;
      room_id: string;
    }) => {
      console.log('📊 Status update:', statusUpdate);
      
      setMessages(prev => prev.map(msg => 
        msg.wa_message_id === statusUpdate.wa_message_id
          ? { ...msg, status: statusUpdate.status, status_timestamp: statusUpdate.status_timestamp }
          : msg
      ));
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

    setLoading(false);

    // Cleanup on unmount or room change
    return () => {
      console.log('📤 Leaving room:', roomId);
      socket.emit('leave_room', roomId);
      socket.off('new_message');
      socket.off('message_status_update');
      socket.off('typing_indicator');
    };
  }, [socket, roomId, isConnected]);

  return {
    messages,
    isTyping,
    loading,
    setMessages, // Allow external updates (for optimistic UI)
  };
}
