'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Paperclip, 
  Smile, 
  MoreVertical, 
  Phone, 
  Video, 
  Info,
  Image as ImageIcon,
  FileText,
  MapPin,
  Users,
  X,
  Upload
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useMessages, useLead } from '@/hooks/useSupabaseRealtime';
import { supabase } from '@/lib/supabase';
import { ApiService } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';
import type { Message } from '@/types';

interface ChatWindowWithRealtimeProps {
  roomId: string;
  userId: string;
  customerPhone?: string;  // Optional: customer phone for sending messages
  onShowLeadPopup?: () => void;
  onClose?: () => void;
}

export const ChatWindowWithRealtime: React.FC<ChatWindowWithRealtimeProps> = ({
  roomId,
  userId,
  customerPhone,
  onShowLeadPopup,
  onClose,
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [roomPhone, setRoomPhone] = useState<string | null>(customerPhone || null);
  const [roomLeadsId, setRoomLeadsId] = useState<string | null>(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [mediaCaption, setMediaCaption] = useState('');
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  // Track optimistic messages that have been confirmed by API success
  const [confirmedOptimisticIds, setConfirmedOptimisticIds] = useState<Set<string>>(new Set());
  // Map clientId -> optimistic message id for template flows
  const templateClientMapRef = useRef<Record<string, string>>({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cleanupTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Use realtime hooks
  const { messages, loading: messagesLoading } = useMessages(roomId);
  const { lead, loading: leadLoading } = useLead(roomLeadsId);

  // SMART MERGE: Combine real and optimistic messages WITHOUT duplicates
  // Real WhatsApp behavior: optimistic message updates to real, no flicker
  const allMessages = React.useMemo(() => {
    // Start with all real messages
    const merged = [...messages];
    
    // Add optimistic messages that haven't been saved yet
  optimisticMessages.forEach(optMsg => {
      // Check if this optimistic message already exists in real messages
      const existsInReal = messages.some(realMsg => {
        // Match by content and timestamp (within 5 seconds)
        if (optMsg.content_type === 'text' && realMsg.content_type === 'text') {
          const contentMatch = realMsg.content_text?.trim() === optMsg.content_text?.trim();
          const userMatch = realMsg.user_id === optMsg.user_id;
          const timeDiff = Math.abs(
            new Date(realMsg.created_at).getTime() - new Date(optMsg.created_at).getTime()
          );
          // Allow wider tolerance (60s) to be resilient to server time differences
          return contentMatch && userMatch && timeDiff < 60000;
        }
        
        // Match media by filename
        if (optMsg.content_type === 'media' && realMsg.content_type === 'media') {
          return realMsg.original_filename === optMsg.original_filename && 
                 realMsg.user_id === optMsg.user_id;
        }
        
        return false;
      });
      
      // Only add if NOT in real messages yet
      if (!existsInReal) {
        merged.push(optMsg);
      }
    });
    
    // Sort by timestamp
    return merged.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [messages, optimisticMessages]);

  // Helper to create optimistic message object
  const buildOptimisticMessage = (
    id: string,
    text: string,
    extra?: Partial<Message>
  ): Message => ({
    id,
    room_id: roomId,
    content_type: 'text',
    content_text: text,
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
    metadata: { source: 'template', ...(extra?.metadata as any) },
    reply_to_wa_message_id: null,
    reaction_emoji: null,
    reaction_to_wa_message_id: null,
    user_id: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...extra,
  });

  // Listen to template send lifecycle events for optimistic UI
  useEffect(() => {
    const handleInit = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        clientId: string;
        to: string;
        templateName: string;
        languageCode: string;
        parameters?: string[];
        user_id?: string;
      };

      // Only act if the phone matches current room
      const phoneToSend = roomPhone || customerPhone;
      if (!phoneToSend || detail.to !== phoneToSend) return;

      const content = `🧩 Template: ${detail.templateName}\nLang: ${detail.languageCode}` +
        (detail.parameters?.length ? `\nParams: ${detail.parameters.join(', ')}` : '');
      const tempId = `temp-${detail.clientId}`;
      templateClientMapRef.current[detail.clientId] = tempId;

      const optimistic = buildOptimisticMessage(tempId, content);
      setOptimisticMessages(prev => [...prev, optimistic]);
    };

    const handleConfirmed = (e: Event) => {
      const { clientId, to } = (e as CustomEvent).detail as { clientId: string; to: string };
      const phoneToSend = roomPhone || customerPhone;
      if (!phoneToSend || to !== phoneToSend) return;
      const tempId = templateClientMapRef.current[clientId];
      if (tempId) {
        setConfirmedOptimisticIds(prev => new Set(prev).add(tempId));
      }
    };

    const handleFailed = (e: Event) => {
      const { clientId, to } = (e as CustomEvent).detail as { clientId: string; to: string };
      const phoneToSend = roomPhone || customerPhone;
      if (!phoneToSend || to !== phoneToSend) return;
      const tempId = templateClientMapRef.current[clientId];
      if (tempId) {
        setOptimisticMessages(prev => prev.filter(m => m.id !== tempId));
        delete templateClientMapRef.current[clientId];
      }
    };

    window.addEventListener('boztell:outgoing-template', handleInit as EventListener);
    window.addEventListener('boztell:outgoing-template:confirmed', handleConfirmed as EventListener);
    window.addEventListener('boztell:outgoing-template:failed', handleFailed as EventListener);

    return () => {
      window.removeEventListener('boztell:outgoing-template', handleInit as EventListener);
      window.removeEventListener('boztell:outgoing-template:confirmed', handleConfirmed as EventListener);
      window.removeEventListener('boztell:outgoing-template:failed', handleFailed as EventListener);
    };
  }, [roomPhone, customerPhone, userId, roomId]);

  // Auto-cleanup: Remove optimistic messages that are now in real messages
  useEffect(() => {
    if (optimisticMessages.length === 0 || messages.length === 0) return;
    
    const toRemove: string[] = [];
    
    optimisticMessages.forEach(optMsg => {
      const foundInReal = messages.some(realMsg => {
        // Same matching logic as above
        if (optMsg.content_type === 'text' && realMsg.content_type === 'text') {
          const contentMatch = realMsg.content_text?.trim() === optMsg.content_text?.trim();
          const userMatch = realMsg.user_id === optMsg.user_id;
          const timeDiff = Math.abs(
            new Date(realMsg.created_at).getTime() - new Date(optMsg.created_at).getTime()
          );
          // Allow wider tolerance (60s) to be resilient to server time differences
          return contentMatch && userMatch && timeDiff < 60000;
        }
        
        if (optMsg.content_type === 'media' && realMsg.content_type === 'media') {
          return realMsg.original_filename === optMsg.original_filename && 
                 realMsg.user_id === optMsg.user_id;
        }
        
        return false;
      });
      
      if (foundInReal) {
        toRemove.push(optMsg.id);
      }
    });
    
    if (toRemove.length > 0) {
      setOptimisticMessages(prev => prev.filter(msg => !toRemove.includes(msg.id)));
      // Also clear confirmed flags for removed optimistic messages to avoid memory growth
      setConfirmedOptimisticIds(prev => {
        const next = new Set(prev);
        toRemove.forEach(id => next.delete(id));
        return next;
      });
    }
  }, [messages, optimisticMessages]);

  // Fetch room data to get phone number and leads_id
  useEffect(() => {
    const fetchRoomData = async () => {
      try {
        const { data } = await supabase
          .from('rooms')
          .select('phone, leads_id')
          .eq('id', roomId)
          .single();
        
  const roomData = data as { phone: string | null; leads_id: string | null } | null;
        if (roomData?.leads_id) {
          setRoomLeadsId(roomData.leads_id);
        }
        
        // Set phone number
        if (roomData?.phone) {
          setRoomPhone(roomData.phone);
        } else if (roomData?.leads_id) {
          // Try to get phone from lead
          const { data: leadData } = await supabase
            .from('leads')
            .select('phone')
            .eq('id', roomData.leads_id)
            .single();
          
          const lead = leadData as { phone: string | null } | null;
          
          if (lead?.phone) {
            setRoomPhone(lead.phone);
          }
        }
      } catch (error) {
        console.error('Error fetching room data:', error);
      }
    };

    if (roomId) {
      fetchRoomData();
    }
  }, [roomId]);
  
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages.length]); // Scroll when message count changes

  // Mark room as read when opened (optional, non-blocking)
  useEffect(() => {
    ApiService.markRoomAsRead(roomId).catch((error) => {
      console.warn('Could not mark room as read (API not available):', error.message);
      // This is non-critical, continue without blocking
    });
  }, [roomId]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || sending) return;

    // Check if we have phone number
    const phoneToSend = roomPhone || customerPhone;
    if (!phoneToSend) {
      alert('Cannot send message: Customer phone number not available');
      return;
    }

    const messageText = inputMessage.trim();
    const tempId = `temp-${Date.now()}`;
    
    // Create optimistic message
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
      // Use new backend API format
      await ApiService.sendMessage({
        to: phoneToSend,          // Phone number
        text: messageText,        // Message text
        user_id: userId,          // Agent ID
      });
      // Mark this optimistic bubble as confirmed (turn dark blue immediately)
      setConfirmedOptimisticIds(prev => new Set(prev).add(tempId));
      
      // Don't remove optimistic message here!
      // It will stay until real message arrives from Supabase realtime
      // The real message will replace it automatically
    } catch (error: any) {
      console.error('Send message error:', error);
      
      // Only remove optimistic message on ERROR
      setOptimisticMessages(prev => prev.filter(m => m.id !== tempId));
      
      // Check if it's API connectivity issue
      if (error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('connect')) {
        alert('Cannot send message: Backend API is not running. Please start the Express.js backend server at localhost:8080');
      } else {
        alert(`Failed to send message: ${error.message || 'Unknown error'}`);
      }
      
      setInputMessage(messageText); // Restore message on error
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

  // File upload handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
    
    setShowAttachmentMenu(false);
  };

  const handleSendMedia = async () => {
    if (!selectedFile || sending) return;

    const phoneToSend = roomPhone || customerPhone;
    if (!phoneToSend) {
      alert('Cannot send media: Customer phone number not available');
      return;
    }

    const tempId = `temp-${Date.now()}`;
    
    // Determine media type
    let mediaType: 'image' | 'video' | 'audio' | 'document' = 'document';
    if (selectedFile.type.startsWith('image/')) mediaType = 'image';
    else if (selectedFile.type.startsWith('video/')) mediaType = 'video';
    else if (selectedFile.type.startsWith('audio/')) mediaType = 'audio';

    // Create optimistic message for media
    const optimisticMessage: Message = {
      id: tempId,
      room_id: roomId,
      content_type: 'media',
      content_text: mediaCaption || null,
      media_type: mediaType,
      media_id: null,
      gcs_filename: null,
      gcs_url: filePreview || null, // Use local preview as temporary URL
      file_size: selectedFile.size,
      mime_type: selectedFile.type,
      original_filename: selectedFile.name,
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
    
    setSending(true);

    try {
      await ApiService.sendMediaCombined({
        media: selectedFile,
        to: phoneToSend,
        caption: mediaCaption || undefined,
        user_id: userId,
      });
      // Turn optimistic media bubble dark immediately
      setConfirmedOptimisticIds(prev => new Set(prev).add(tempId));

      // Clear file selection state
      setSelectedFile(null);
      setFilePreview(null);
      setMediaCaption('');
      
      // Don't remove optimistic message - it will be replaced by real message from Supabase
    } catch (error: any) {
      console.error('Send media error:', error);
      
      // Remove optimistic message on error
      setOptimisticMessages(prev => prev.filter(m => m.id !== tempId));
      
      alert(`Failed to send media: ${error.message || 'Unknown error'}`);
    } finally {
      setSending(false);
    }
  };

  const handleCancelMedia = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setMediaCaption('');
  };

  // Contact send handler
  const handleSendContact = async (contactData: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
  }) => {
    const phoneToSend = roomPhone || customerPhone;
    if (!phoneToSend) {
      alert('Cannot send contact: Customer phone number not available');
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const contactText = `📇 Contact: ${contactData.firstName} ${contactData.lastName}\n📞 ${contactData.phone}${contactData.email ? `\n📧 ${contactData.email}` : ''}`;

    // Create optimistic message for contact
    const optimisticMessage: Message = {
      id: tempId,
      room_id: roomId,
      content_type: 'contact',
      content_text: contactText,
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

    setSending(true);

    try {
      await ApiService.sendContacts({
        to: phoneToSend,
        contacts: [{
          name: {
            first_name: contactData.firstName,
            last_name: contactData.lastName,
          },
          phones: [{ phone: contactData.phone, type: 'MOBILE' }],
          ...(contactData.email && {
            emails: [{ email: contactData.email, type: 'WORK' }]
          })
        }],
        user_id: userId,
      });

      setShowContactModal(false);
  // Turn optimistic contact bubble dark immediately
  setConfirmedOptimisticIds(prev => new Set(prev).add(tempId));
      
      // Don't remove optimistic message - it will be replaced by real message from Supabase
    } catch (error: any) {
      console.error('Send contact error:', error);
      
      // Remove optimistic message on error
      setOptimisticMessages(prev => prev.filter(m => m.id !== tempId));
      
      alert(`Failed to send contact: ${error.message || 'Unknown error'}`);
    } finally {
      setSending(false);
    }
  };

  // Location send handler
  const handleSendLocation = async (locationData: {
    latitude: string;
    longitude: string;
    name?: string;
    address?: string;
  }) => {
    const phoneToSend = roomPhone || customerPhone;
    if (!phoneToSend) {
      alert('Cannot send location: Customer phone number not available');
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const locationText = `📍 Location: ${locationData.name || 'Location'}\n📮 ${locationData.address || `${locationData.latitude}, ${locationData.longitude}`}`;

    // Create optimistic message for location
    const optimisticMessage: Message = {
      id: tempId,
      room_id: roomId,
      content_type: 'location',
      content_text: locationText,
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

    setSending(true);

    try {
      await ApiService.sendLocation({
        to: phoneToSend,
        location: {
          latitude: parseFloat(locationData.latitude),
          longitude: parseFloat(locationData.longitude),
          name: locationData.name,
          address: locationData.address,
        },
        user_id: userId,
      });

      setShowLocationModal(false);
  // Turn optimistic location bubble dark immediately
  setConfirmedOptimisticIds(prev => new Set(prev).add(tempId));
      
      // Don't remove optimistic message - it will be replaced by real message from Supabase
    } catch (error: any) {
      console.error('Send location error:', error);
      
      // Remove optimistic message on error
      setOptimisticMessages(prev => prev.filter(m => m.id !== tempId));
      
      alert(`Failed to send location: ${error.message || 'Unknown error'}`);
    } finally {
      setSending(false);
    }
  };

  // Emoji/reaction handler
  const handleSendReaction = async (messageId: string, emoji: string) => {
    const phoneToSend = roomPhone || customerPhone;
    if (!phoneToSend) return;

    try {
      await ApiService.sendReaction({
        to: phoneToSend,
        message_id: messageId,
        emoji: emoji,
        user_id: userId,
      });
    } catch (error: any) {
      console.error('Send reaction error:', error);
      alert(`Failed to send reaction: ${error.message || 'Unknown error'}`);
    }
  };

  const getMessageStatusIcon = (status: string | null | undefined): string => {
    switch (status) {
      case 'sent': return '✓';
      case 'delivered': return '✓✓';
      case 'read': return '✓✓';
      default: return '';
    }
  };

  const renderMessage = (message: Message, index: number) => {
    const isFromCustomer = !message.user_id;
    const isOptimistic = message.id.startsWith('temp-');
    const isConfirmedOptimistic = isOptimistic && confirmedOptimisticIds.has(message.id);
    const showDate = index === 0 || 
      new Date(message.created_at).toDateString() !== 
      new Date(allMessages[index - 1].created_at).toDateString();

    return (
      <React.Fragment key={message.id}>
        {/* Date separator */}
        {showDate && (
          <div className="flex justify-center my-4">
            <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
              {new Date(message.created_at).toLocaleDateString('id-ID', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>
        )}

        {/* Message bubble */}
        <div className={`flex ${isFromCustomer ? 'justify-start' : 'justify-end'} mb-2`}>
          <div
            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg transition-all duration-300 ${
              isFromCustomer
                ? 'bg-white text-gray-900'
                : isOptimistic && !isConfirmedOptimistic
                ? 'bg-blue-400 text-white opacity-70 scale-95'  // Slightly smaller + translucent
                : 'bg-blue-500 text-white opacity-100 scale-100' // Full size + opaque
            }`}
          >
            {/* Media messages */}
            {message.media_type && message.gcs_url && (
              <div className="mb-2">
                {message.media_type === 'image' && (
                  <img
                    src={message.gcs_url}
                    alt="Media"
                    className="rounded-lg max-w-full h-auto"
                  />
                )}
                {message.media_type === 'video' && (
                  <video
                    src={message.gcs_url}
                    controls
                    className="rounded-lg max-w-full h-auto"
                  />
                )}
                {message.media_type === 'audio' && (
                  <audio src={message.gcs_url} controls className="max-w-full" />
                )}
                {message.media_type === 'document' && (
                  <a
                    href={message.gcs_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 text-blue-600 hover:underline"
                  >
                    <Paperclip className="h-4 w-4" />
                    <span>{message.original_filename || 'Document'}</span>
                  </a>
                )}
              </div>
            )}

            {/* Text content */}
            {message.content_text && (
              <p className="text-sm whitespace-pre-wrap break-words">
                {message.content_text}
              </p>
            )}

            {/* Reaction */}
            {message.reaction_emoji && (
              <div className="mt-1">
                <span className="text-lg">{message.reaction_emoji}</span>
              </div>
            )}

            {/* Timestamp and status */}
            <div className="flex items-center justify-end space-x-1 mt-1">
              <span className={`text-xs ${isFromCustomer ? 'text-gray-500' : 'text-blue-100'}`}>
                {new Date(message.created_at).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              {!isFromCustomer && (
                <span className={`text-xs ${message.status === 'read' ? 'text-blue-2 00' : 'text-blue-100'}`}>
                  {isOptimistic ? (isConfirmedOptimistic ? getMessageStatusIcon('sent') : '🕐') : getMessageStatusIcon(message.status)}
                </span>
              )}
            </div>
          </div>
        </div>
      </React.Fragment>
    );
  };

  const customerName = lead?.name || 'Customer';
  const customerPhoneDisplay = lead?.phone || roomPhone || 'Unknown';

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
            <span className="text-gray-600 font-semibold text-sm">
              {customerName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{customerName}</h3>
            <p className="text-xs text-gray-500">{customerPhoneDisplay}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm">
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Video className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onShowLeadPopup}>
            <Info className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messagesLoading && allMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-500">Loading messages...</p>
            </div>
          </div>
        ) : allMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-gray-500 mb-2">No messages yet</p>
              <p className="text-sm text-gray-400">Send a message to start the conversation</p>
            </div>
          </div>
        ) : (
          <>
            {allMessages.map((message, index) => renderMessage(message, index))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Lead info banner (if no lead connected) */}
      {!lead && !leadLoading && (
        <div className="bg-yellow-50 border-t border-yellow-200 px-4 py-2 flex items-center justify-between">
          <p className="text-sm text-yellow-800">
            No lead connected to this conversation
          </p>
          <Button size="sm" variant="secondary" onClick={onShowLeadPopup}>
            Connect Lead
          </Button>
        </div>
      )}

      {/* Media Preview Modal */}
      {selectedFile && (
        <div className="absolute inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">Send Media</h3>
              <Button variant="ghost" size="sm" onClick={handleCancelMedia}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="p-4">
              {filePreview ? (
                <img src={filePreview} alt="Preview" className="max-w-full rounded-lg mb-4" />
              ) : (
                <div className="bg-gray-100 p-8 rounded-lg text-center mb-4">
                  <FileText className="h-16 w-16 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">{selectedFile.name}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              )}
              
              <Input
                type="text"
                placeholder="Add a caption (optional)..."
                value={mediaCaption}
                onChange={(e) => setMediaCaption(e.target.value)}
                className="mb-4"
              />
              
              <div className="flex space-x-2">
                <Button 
                  variant="secondary" 
                  onClick={handleCancelMedia}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  variant="primary" 
                  onClick={handleSendMedia}
                  disabled={sending}
                  className="flex-1"
                >
                  {sending ? 'Sending...' : 'Send'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contact Modal */}
      {showContactModal && (
        <ContactModal
          onClose={() => setShowContactModal(false)}
          onSend={handleSendContact}
          sending={sending}
        />
      )}

      {/* Location Modal */}
      {showLocationModal && (
        <LocationModal
          onClose={() => setShowLocationModal(false)}
          onSend={handleSendLocation}
          sending={sending}
        />
      )}

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-4 py-3">
        {/* Attachment Menu */}
        {showAttachmentMenu && (
          <div className="mb-3 flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAttachmentMenu(false);
                fileInputRef.current?.click();
              }}
              className="flex items-center space-x-2"
            >
              <ImageIcon className="h-4 w-4" />
              <span>Image/Video</span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAttachmentMenu(false);
                fileInputRef.current?.click();
              }}
              className="flex items-center space-x-2"
            >
              <FileText className="h-4 w-4" />
              <span>Document</span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAttachmentMenu(false);
                setShowContactModal(true);
              }}
              className="flex items-center space-x-2"
            >
              <Users className="h-4 w-4" />
              <span>Contact</span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAttachmentMenu(false);
                setShowLocationModal(true);
              }}
              className="flex items-center space-x-2"
            >
              <MapPin className="h-4 w-4" />
              <span>Location</span>
            </Button>
          </div>
        )}

        {/* Emoji Picker (Simple) */}
        {showEmojiPicker && (
          <div className="mb-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex flex-wrap gap-2">
              {['👍', '❤️', '😊', '😂', '😮', '😢', '🔥', '👏', '🎉', '✅'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    setInputMessage(inputMessage + emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="text-2xl hover:bg-gray-200 p-2 rounded transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <div className="flex items-end space-x-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="mb-1"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            <Smile className="h-5 w-5 text-gray-500" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="mb-1"
            onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
          >
            <Paperclip className="h-5 w-5 text-gray-500" />
          </Button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="flex-1">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              rows={1}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || sending}
            className="mb-1"
          >
            {sending ? (
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Contact Modal Component
interface ContactModalProps {
  onClose: () => void;
  onSend: (data: { firstName: string; lastName: string; phone: string; email?: string }) => void;
  sending: boolean;
}

const ContactModal: React.FC<ContactModalProps> = ({ onClose, onSend, sending }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = () => {
    if (!firstName || !phone) {
      alert('First name and phone are required');
      return;
    }
    onSend({ firstName, lastName, phone, email: email || undefined });
  };

  return (
    <div className="absolute inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Send Contact</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name *
            </label>
            <Input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="John"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name
            </label>
            <Input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Doe"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number *
            </label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1234567890"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email (Optional)
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
            />
          </div>
          
          <div className="flex space-x-2 pt-2">
            <Button variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              variant="primary" 
              onClick={handleSubmit}
              disabled={sending || !firstName || !phone}
              className="flex-1"
            >
              {sending ? 'Sending...' : 'Send Contact'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Location Modal Component
interface LocationModalProps {
  onClose: () => void;
  onSend: (data: { latitude: string; longitude: string; name?: string; address?: string }) => void;
  sending: boolean;
}

const LocationModal: React.FC<LocationModalProps> = ({ onClose, onSend, sending }) => {
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');

  const handleSubmit = () => {
    if (!latitude || !longitude) {
      alert('Latitude and Longitude are required');
      return;
    }
    
    // Validate coordinates
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      alert('Invalid coordinates. Latitude must be between -90 and 90, Longitude between -180 and 180');
      return;
    }
    
    onSend({ latitude, longitude, name: name || undefined, address: address || undefined });
  };

  const handleUseCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude.toString());
          setLongitude(position.coords.longitude.toString());
        },
        (error) => {
          alert('Error getting location: ' + error.message);
        }
      );
    } else {
      alert('Geolocation is not supported by your browser');
    }
  };

  return (
    <div className="absolute inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Send Location</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="p-4 space-y-4">
          <Button 
            variant="outline" 
            onClick={handleUseCurrentLocation}
            className="w-full"
          >
            <MapPin className="h-4 w-4 mr-2" />
            Use Current Location
          </Button>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Latitude *
              </label>
              <Input
                type="text"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="-6.200000"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Longitude *
              </label>
              <Input
                type="text"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="106.816666"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Place Name (Optional)
            </label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jakarta"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address (Optional)
            </label>
            <Input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Jakarta, Indonesia"
            />
          </div>
          
          <div className="flex space-x-2 pt-2">
            <Button variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              variant="primary" 
              onClick={handleSubmit}
              disabled={sending || !latitude || !longitude}
              className="flex-1"
            >
              {sending ? 'Sending...' : 'Send Location'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

