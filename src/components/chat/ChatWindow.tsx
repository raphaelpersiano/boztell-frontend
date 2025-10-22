'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Phone, Video, Info, Paperclip, Send, Smile, MapPin, User, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ApiService } from '@/lib/api';
import { Message } from '@/types';
import { useSocket } from '@/hooks/useSocket';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';
import { QuickRoomAssignment } from './QuickRoomAssignment';

interface ChatWindowProps {
  roomId: string;
  userId: string;
  customerPhone?: string;
  onShowLeadPopup?: () => void;
  onClose?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  roomId,
  userId,
  customerPhone,
  onShowLeadPopup,
  onClose,
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [confirmedOptimisticIds, setConfirmedOptimisticIds] = useState<Set<string>>(new Set());
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Socket.IO connection
  const { socket, isConnected } = useSocket();
  
  // Real-time messages from Socket.IO
  const { messages, isTyping, loading, setMessages } = useRealtimeMessages({
    socket,
    roomId,
    isConnected,
  });

  // Merge real and optimistic messages (WhatsApp-like behavior)
  const allMessages = React.useMemo(() => {
    const merged = [...messages];
    
    // Add optimistic messages that haven't appeared in real messages yet
    optimisticMessages.forEach(optMsg => {
      const existsInReal = messages.some(realMsg => {
        // Match by content and user
        if (optMsg.content_type === 'text' && realMsg.content_type === 'text') {
          const contentMatch = realMsg.content_text?.trim() === optMsg.content_text?.trim();
          const userMatch = realMsg.user_id === optMsg.user_id;
          const timeDiff = Math.abs(
            new Date(realMsg.created_at).getTime() - new Date(optMsg.created_at).getTime()
          );
          return contentMatch && userMatch && timeDiff < 60000; // 60 second tolerance
        }
        return false;
      });
      
      if (!existsInReal) {
        merged.push(optMsg);
      }
    });
    
    return merged.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [messages, optimisticMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages.length]);

  // Cleanup optimistic messages that are now in real messages
  useEffect(() => {
    if (optimisticMessages.length === 0 || messages.length === 0) return;
    
    const toRemove: string[] = [];
    
    optimisticMessages.forEach(optMsg => {
      const foundInReal = messages.some(realMsg => {
        if (optMsg.content_type === 'text' && realMsg.content_type === 'text') {
          const contentMatch = realMsg.content_text?.trim() === optMsg.content_text?.trim();
          const userMatch = realMsg.user_id === optMsg.user_id;
          const timeDiff = Math.abs(
            new Date(realMsg.created_at).getTime() - new Date(optMsg.created_at).getTime()
          );
          return contentMatch && userMatch && timeDiff < 60000;
        }
        return false;
      });
      
      if (foundInReal) {
        toRemove.push(optMsg.id);
      }
    });
    
    if (toRemove.length > 0) {
      setOptimisticMessages(prev => prev.filter(msg => !toRemove.includes(msg.id)));
      setConfirmedOptimisticIds(prev => {
        const next = new Set(prev);
        toRemove.forEach(id => next.delete(id));
        return next;
      });
    }
  }, [messages, optimisticMessages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || sending) return;

    if (!customerPhone) {
      alert('Cannot send message: Customer phone number not available');
      return;
    }

    const messageText = inputMessage.trim();
    const tempId = `temp-${Date.now()}`;
    
    // Create optimistic message (WhatsApp-like instant feedback)
    const optimisticMessage: Message = {
      id: tempId,
      room_id: roomId,
      content_type: 'text',
      content_text: messageText,
      media_type: null,
      media_id: null,
      gcs_filename: null,
      gcs_url: null,
      file_size: null,
      mime_type: null,
      original_filename: null,
      wa_message_id: null,
      status: 'sent',
      status_timestamp: null,
      metadata: null,
      reply_to_wa_message_id: null,
      reaction_emoji: null,
      reaction_to_wa_message_id: null,
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Add optimistic message immediately
    setOptimisticMessages(prev => [...prev, optimisticMessage]);
    setInputMessage('');
    setSending(true);

    try {
      await ApiService.sendMessage({
        to: customerPhone,
        text: messageText,
        user_id: userId,
      });
      
      // Mark as confirmed (turn blue checkmark)
      setConfirmedOptimisticIds(prev => new Set(prev).add(tempId));
    } catch (error: any) {
      console.error('Send message error:', error);
      
      // Remove optimistic message on error
      setOptimisticMessages(prev => prev.filter(m => m.id !== tempId));
      
      if (error.message?.includes('fetch') || error.message?.includes('network')) {
        alert('Cannot send message: Backend API is not running');
      } else {
        alert(`Failed to send message: ${error.message || 'Unknown error'}`);
      }
      
      setInputMessage(messageText);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getMessageStatusIcon = (message: Message): string => {
    const isOptimistic = message.id.startsWith('temp-');
    const isConfirmed = isOptimistic && confirmedOptimisticIds.has(message.id);
    
    if (isOptimistic && !isConfirmed) {
      return '🕒'; // Clock for pending
    }
    
    switch (message.status) {
      case 'sent': return '✓';
      case 'delivered': return '✓✓';
      case 'read': return '✓✓';
      default: return '';
    }
  };

  const renderMessage = (message: Message, index: number) => {
    const isFromCustomer = !message.user_id;
    const isOptimistic = message.id.startsWith('temp-');
    const isConfirmed = isOptimistic && confirmedOptimisticIds.has(message.id);
    
    // Date separator
    const showDate = index === 0 || 
      new Date(message.created_at).toDateString() !== 
      new Date(allMessages[index - 1].created_at).toDateString();

    return (
      <React.Fragment key={message.id}>
        {showDate && (
          <div className="flex justify-center my-4">
            <div className="bg-gray-200 text-gray-700 text-xs px-3 py-1 rounded-full">
              {new Date(message.created_at).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </div>
          </div>
        )}

        <div className={`flex ${isFromCustomer ? 'justify-start' : 'justify-end'} mb-2`}>
          <div className={`max-w-[70%] rounded-lg px-4 py-2 ${
            isFromCustomer 
              ? 'bg-white' 
              : isConfirmed 
                ? 'bg-blue-600 text-white' 
                : 'bg-blue-400 text-white'
          }`}>
            {message.content_type === 'text' && (
              <p className="text-sm whitespace-pre-wrap break-words">
                {message.content_text}
              </p>
            )}
            
            <div className="flex items-center justify-end space-x-1 mt-1">
              <span className={`text-xs ${isFromCustomer ? 'text-gray-500' : 'text-white opacity-70'}`}>
                {new Date(message.created_at).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
              {!isFromCustomer && (
                <span className={`text-xs ${isConfirmed ? 'text-blue-200' : 'text-white'}`}>
                  {getMessageStatusIcon(message)}
                </span>
              )}
            </div>
          </div>
        </div>
      </React.Fragment>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
            <User className="h-6 w-6 text-gray-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{customerPhone || 'Customer'}</h3>
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span className="text-xs text-gray-500">
                {isConnected ? 'Connected' : 'Connecting...'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <QuickRoomAssignment 
            roomId={roomId}
            onAssignmentChange={() => {
              console.log('Assignment changed');
            }}
          />
          
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading && allMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Loading messages...</p>
          </div>
        ) : allMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">No messages yet</p>
          </div>
        ) : (
          <>
            {allMessages.map(renderMessage)}
            
            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start mb-2">
                <div className="bg-white rounded-lg px-4 py-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-4 py-3">
        <div className="flex items-end space-x-2">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            disabled={sending || !isConnected}
            className="flex-1 resize-none border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            rows={1}
            style={{
              minHeight: '40px',
              maxHeight: '120px',
            }}
          />

          <Button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || sending || !isConnected}
            className="bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
