'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Phone, Video, Info, Paperclip, Send, Smile, MapPin, User, Users, FileText, Download, Play, Volume2, Contact2, Reply, Image as ImageIcon, Film, Mic, FileIcon, Square, Trash2 } from 'lucide-react';
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
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Voice Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Socket.IO connection
  const { socket, isConnected } = useSocket();
  
  // Real-time messages from Socket.IO (with REST API historical fetch)
  const { messages, isTyping, loading, hasMore, setMessages, loadMoreMessages } = useRealtimeMessages({
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
        // Match by wa_message_id if available
        if (optMsg.wa_message_id && realMsg.wa_message_id) {
          return realMsg.wa_message_id === optMsg.wa_message_id;
        }
        
        // Match text messages by content and user
        if (optMsg.content_type === 'text' && realMsg.content_type === 'text') {
          const contentMatch = realMsg.content_text?.trim() === optMsg.content_text?.trim();
          const userMatch = realMsg.user_id === optMsg.user_id;
          const timeDiff = Math.abs(
            new Date(realMsg.created_at).getTime() - new Date(optMsg.created_at).getTime()
          );
          return contentMatch && userMatch && timeDiff < 60000; // 60 second tolerance
        }
        
        // Match media messages by filename and type
        if (optMsg.content_type !== 'text' && realMsg.content_type !== 'text') {
          const typeMatch = realMsg.content_type === optMsg.content_type;
          const userMatch = realMsg.user_id === optMsg.user_id;
          const filenameMatch = realMsg.original_filename === optMsg.original_filename;
          const timeDiff = Math.abs(
            new Date(realMsg.created_at).getTime() - new Date(optMsg.created_at).getTime()
          );
          return typeMatch && userMatch && filenameMatch && timeDiff < 60000;
        }
        
        return false;
      });
      
      if (!existsInReal) {
        merged.push(optMsg);
      }
    });
    
    // ✅ Filter out invalid messages (missing id)
    const validMessages = merged.filter(msg => msg && msg.id);
    
    console.log('📊 All messages after merge:', {
      total: validMessages.length,
      fromBackend: messages.length,
      optimistic: optimisticMessages.length,
      types: validMessages.reduce((acc: any, msg) => {
        const type = msg.content_type || 'unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {}),
    });
    
    return validMessages.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [messages, optimisticMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages.length]);

  // Handle scroll for "Load More"
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    
    // If scrolled to top and has more messages, load more
    if (target.scrollTop === 0 && hasMore && !loading) {
      console.log('📚 Loading more messages...');
      const previousScrollHeight = target.scrollHeight;
      
      loadMoreMessages().then(() => {
        // Restore scroll position after loading older messages
        requestAnimationFrame(() => {
          const newScrollHeight = target.scrollHeight;
          target.scrollTop = newScrollHeight - previousScrollHeight;
        });
      });
    }
  };

  // Cleanup optimistic messages that are now in real messages
  useEffect(() => {
    if (optimisticMessages.length === 0 || messages.length === 0) return;
    
    const toRemove: string[] = [];
    
    optimisticMessages.forEach(optMsg => {
      // ✅ Skip if invalid message
      if (!optMsg || !optMsg.id) return;
      
      const foundInReal = messages.some(realMsg => {
        // ✅ Skip if invalid message
        if (!realMsg || !realMsg.id) return false;
        
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

  const handleFileSelect = async (fileType: 'image' | 'video' | 'document' | 'audio') => {
    setShowAttachmentMenu(false);
    
    const acceptTypes: Record<string, string> = {
      image: 'image/jpeg,image/png,image/webp',
      video: 'video/mp4,video/3gpp',
      document: 'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      audio: 'audio/aac,audio/mp4,audio/mpeg,audio/amr,audio/ogg',
    };

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = acceptTypes[fileType];
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      if (!customerPhone) {
        alert('Cannot send media: Customer phone number not available');
        return;
      }

      // Validate file size (16MB max for WhatsApp)
      const maxSize = 16 * 1024 * 1024; // 16MB
      if (file.size > maxSize) {
        alert('File too large. Maximum size is 16MB.');
        return;
      }

      // Create optimistic message for immediate UI feedback
      const tempId = `temp-media-${Date.now()}`;
      const fileUrl = URL.createObjectURL(file);
      
      const optimisticMessage: Message = {
        id: tempId,
        room_id: roomId,
        content_type: fileType === 'document' ? 'document' : 
                      fileType === 'audio' ? 'audio' : fileType,
        content_text: inputMessage.trim() || null,
        media_type: file.type,
        media_id: null,
        gcs_filename: file.name,
        gcs_url: fileUrl, // Temporary local URL
        file_size: file.size,
        mime_type: file.type,
        original_filename: file.name,
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
      setInputMessage(''); // Clear caption

      setSending(true);
      try {
        const response = await ApiService.sendMediaCombined({
          media: file,
          to: customerPhone,
          caption: inputMessage.trim() || undefined,
          user_id: userId,
        });

        console.log('✅ Media sent successfully:', response);
        
        // Mark as confirmed
        setConfirmedOptimisticIds(prev => new Set(prev).add(tempId));
        
        // Revoke temporary URL after confirmed
        setTimeout(() => {
          URL.revokeObjectURL(fileUrl);
        }, 5000);
        
      } catch (error: any) {
        console.error('❌ Send media error:', error);
        
        // Remove optimistic message on error
        setOptimisticMessages(prev => prev.filter(m => m.id !== tempId));
        URL.revokeObjectURL(fileUrl);
        
        alert(`Failed to send ${fileType}: ${error.message || 'Unknown error'}`);
      } finally {
        setSending(false);
      }
    };

    input.click();
  };

  const handleSendLocation = async () => {
    setShowAttachmentMenu(false);
    
    if (!customerPhone) {
      alert('Cannot send location: Customer phone number not available');
      return;
    }

    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setSending(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await ApiService.sendLocation({
            to: customerPhone,
            location: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              name: 'My Location',
              address: undefined,
            },
            user_id: userId,
          });

          console.log('✅ Location sent successfully');
        } catch (error: any) {
          console.error('❌ Send location error:', error);
          alert(`Failed to send location: ${error.message || 'Unknown error'}`);
        } finally {
          setSending(false);
        }
      },
      (error) => {
        setSending(false);
        alert(`Failed to get location: ${error.message}`);
      }
    );
  };

  const handleSendContact = async () => {
    setShowAttachmentMenu(false);
    
    if (!customerPhone) {
      alert('Cannot send contact: Customer phone number not available');
      return;
    }

    // Simple prompt for demo - you can replace with a proper form modal
    const name = prompt('Contact Name:');
    if (!name) return;

    const phone = prompt('Contact Phone (with country code, e.g., +6281234567890):');
    if (!phone) return;

    setSending(true);
    try {
      await ApiService.sendContacts({
        to: customerPhone,
        contacts: [
          {
            name: {
              first_name: name,
            },
            phones: [{ phone }],
          },
        ],
        user_id: userId,
      });

      console.log('✅ Contact sent successfully');
    } catch (error: any) {
      console.error('❌ Send contact error:', error);
      alert(`Failed to send contact: ${error.message || 'Unknown error'}`);
    } finally {
      setSending(false);
    }
  };

  // Voice Recording Functions
  const startVoiceRecording = async () => {
    if (!customerPhone) {
      alert('Cannot record: Customer phone number not available');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        // Auto-send voice note
        await sendVoiceNote(audioBlob);
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      console.log('🎤 Voice recording started');
    } catch (error: any) {
      console.error('❌ Failed to start recording:', error);
      alert(`Failed to access microphone: ${error.message}`);
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      
      console.log('🎤 Voice recording stopped');
    }
  };

  const cancelVoiceRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;
    }
    
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    audioChunksRef.current = [];
    setAudioBlob(null);
    setIsRecording(false);
    setRecordingTime(0);
    
    console.log('🎤 Voice recording cancelled');
  };

  const sendVoiceNote = async (blob: Blob) => {
    if (!customerPhone) return;

    const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
    
    // Create optimistic message
    const tempId = `temp-voice-${Date.now()}`;
    const fileUrl = URL.createObjectURL(blob);
    
    const optimisticMessage: Message = {
      id: tempId,
      room_id: roomId,
      content_type: 'voice',
      content_text: null,
      media_type: 'audio/webm',
      media_id: null,
      gcs_filename: file.name,
      gcs_url: fileUrl,
      file_size: file.size,
      mime_type: 'audio/webm',
      original_filename: file.name,
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

    setOptimisticMessages(prev => [...prev, optimisticMessage]);

    setSending(true);
    try {
      const response = await ApiService.sendMediaCombined({
        media: file,
        to: customerPhone,
        user_id: userId,
      });

      console.log('✅ Voice note sent successfully:', response);
      
      // Mark as confirmed
      setConfirmedOptimisticIds(prev => new Set(prev).add(tempId));
      
      // Clean up
      setTimeout(() => {
        URL.revokeObjectURL(fileUrl);
        setAudioBlob(null);
        setRecordingTime(0);
      }, 5000);
      
    } catch (error: any) {
      console.error('❌ Send voice note error:', error);
      
      // Remove optimistic message on error
      setOptimisticMessages(prev => prev.filter(m => m.id !== tempId));
      URL.revokeObjectURL(fileUrl);
      
      alert(`Failed to send voice note: ${error.message || 'Unknown error'}`);
    } finally {
      setSending(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

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
    // ✅ Defensive check: Ensure message.id exists
    if (!message || !message.id) {
      console.error('❌ Invalid message: missing id', message);
      return null;
    }
    
    const isFromCustomer = !message.user_id;
    const isOptimistic = message.id.startsWith('temp-');
    const isConfirmed = isOptimistic && confirmedOptimisticIds.has(message.id);
    
    // Date separator
    const showDate = index === 0 || 
      new Date(message.created_at).toDateString() !== 
      new Date(allMessages[index - 1]?.created_at || message.created_at).toDateString();

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
          <div className={`max-w-[70%] rounded-lg ${
            (message.content_type === 'audio' || message.content_type === 'voice' || 
             (message.content_type === 'media' && message.media_type === 'audio')) 
              ? 'p-0' 
              : 'px-4 py-2'
          } ${
            isFromCustomer 
              ? (message.content_type === 'audio' || message.content_type === 'voice' || 
                 (message.content_type === 'media' && message.media_type === 'audio')) 
                ? '' 
                : 'bg-white'
              : isConfirmed 
                ? 'bg-blue-600 text-white' 
                : 'bg-blue-400 text-white'
          }`}>
            {/* Reaction (if this message reacts to another) */}
            {message.reaction_emoji && message.reaction_to_wa_message_id && (
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200 dark:border-gray-600">
                <span className="text-2xl">{message.reaction_emoji}</span>
                <span className="text-xs opacity-70">Reacted to a message</span>
              </div>
            )}

            {/* Replied Message (if replying to another message) */}
            {message.replied_message && (
              <div className="mb-2 pb-2 border-l-4 border-blue-400 pl-3 bg-black/5 dark:bg-white/5 rounded">
                <div className="flex items-start gap-2">
                  <Reply className="w-3 h-3 mt-0.5 opacity-60" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold opacity-80 mb-1">
                      {message.replied_message.user_id ? 'You' : 'Customer'}
                    </p>
                    <p className="text-xs opacity-70 truncate">
                      {message.replied_message.content_text || 
                       (message.replied_message.content_type === 'image' ? '📷 Image' :
                        message.replied_message.content_type === 'video' ? '🎥 Video' :
                        message.replied_message.content_type === 'audio' || message.replied_message.content_type === 'voice' ? '🎵 Audio' :
                        message.replied_message.content_type === 'document' ? '📄 Document' :
                        message.replied_message.content_type === 'location' ? '📍 Location' :
                        message.replied_message.content_type === 'contacts' ? '👤 Contact' :
                        '💬 Message')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Text Message */}
            {message.content_type === 'text' && (
              <p className="text-sm whitespace-pre-wrap break-words">
                {message.content_text}
              </p>
            )}

            {/* Image Message */}
            {message.content_type === 'image' && (
              <div className="space-y-2">
                {message.gcs_url && (
                  <img 
                    src={message.gcs_url} 
                    alt={message.original_filename || 'Image'}
                    className="max-w-full rounded-lg cursor-pointer hover:opacity-90"
                    onClick={() => window.open(message.gcs_url!, '_blank')}
                    loading="lazy"
                  />
                )}
                {message.content_text && (
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.content_text}
                  </p>
                )}
              </div>
            )}

            {/* Video Message */}
            {message.content_type === 'video' && (
              <div className="space-y-2">
                {message.gcs_url ? (
                  <video 
                    controls 
                    className="max-w-full rounded-lg"
                    preload="metadata"
                  >
                    <source src={message.gcs_url} type={message.mime_type || 'video/mp4'} />
                    Your browser doesn't support video playback.
                  </video>
                ) : (
                  <div className="flex items-center space-x-2 p-3 bg-gray-100 rounded-lg">
                    <Play className="h-5 w-5 text-gray-500" />
                    <span className="text-sm text-gray-600">Video {message.original_filename}</span>
                  </div>
                )}
                {message.content_text && (
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.content_text}
                  </p>
                )}
              </div>
            )}

            {/* Audio/Voice Message */}
            {(message.content_type === 'audio' || message.content_type === 'voice') && (
              <div className="space-y-2">
                {message.gcs_url ? (
                  <div className="min-w-[300px]">
                    {isFromCustomer ? (
                      /* Ingoing Audio - Customer Messages */
                      <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-gray-100 shadow-sm">
                        {/* Play Button dengan Icon Musik/Mic */}
                        <button 
                          className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105 shadow-md ${
                            message.content_type === 'voice'
                              ? 'bg-gradient-to-br from-emerald-400 to-green-500 hover:from-emerald-500 hover:to-green-600' 
                              : 'bg-gradient-to-br from-purple-400 to-purple-500 hover:from-purple-500 hover:to-purple-600'
                          }`}
                          onClick={(e) => {
                            const audio = e.currentTarget.parentElement?.querySelector('audio') as HTMLAudioElement;
                            if (audio) {
                              if (audio.paused) {
                                audio.play();
                              } else {
                                audio.pause();
                              }
                            }
                          }}
                        >
                          {message.content_type === 'voice' ? (
                            <Mic className="h-5 w-5 text-white" />
                          ) : (
                            <svg 
                              className="h-5 w-5 text-white"
                              fill="currentColor" 
                              viewBox="0 0 20 20"
                            >
                              <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                            </svg>
                          )}
                        </button>
                        
                        {/* Waveform Visual */}
                        <div className="flex-1 flex items-center gap-0.5">
                          {[4, 7, 3, 8, 5, 9, 4, 7, 8, 6, 7, 4, 8, 6, 3, 7, 6, 5, 7, 4, 6, 8, 5].map((height, i) => (
                            <div 
                              key={i} 
                              className={`w-1 rounded-full ${
                                message.content_type === 'voice'
                                  ? 'bg-green-400' 
                                  : 'bg-purple-400'
                              }`}
                              style={{ height: `${height * 2.5}px` }}
                            />
                          ))}
                        </div>
                        
                        {/* Duration/Size */}
                        <span className="text-xs font-medium text-gray-500">
                          {message.file_size ? `${Math.round(message.file_size / 1024)}KB` : '0:00'}
                        </span>
                        
                        {/* Hidden Audio Element */}
                        <audio className="hidden">
                          <source src={message.gcs_url} type={message.mime_type || 'audio/mpeg'} />
                        </audio>
                      </div>
                    ) : (
                      /* Outgoing Audio - Agent Messages */
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-white/10 backdrop-blur-sm">
                        {/* Icon Musik/Mic di sebelah kiri */}
                        <div className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center ${
                          message.content_type === 'voice'
                            ? 'bg-gradient-to-br from-white to-gray-100 shadow-lg shadow-white/20'
                            : 'bg-gradient-to-br from-white to-gray-100 shadow-lg shadow-white/20'
                        }`}>
                          {message.content_type === 'voice' ? (
                            <Mic className="h-5 w-5 text-blue-600" />
                          ) : (
                            <svg 
                              className="h-5 w-5 text-blue-600"
                              fill="currentColor" 
                              viewBox="0 0 20 20"
                            >
                              <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                            </svg>
                          )}
                        </div>
                        
                        {/* Play Button */}
                        <button 
                          className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110 bg-white hover:bg-gray-50 shadow-md"
                          onClick={(e) => {
                            const audio = e.currentTarget.parentElement?.querySelector('audio') as HTMLAudioElement;
                            if (audio) {
                              if (audio.paused) {
                                audio.play();
                              } else {
                                audio.pause();
                              }
                            }
                          }}
                        >
                          <Play className="h-4 w-4 ml-0.5 text-green-600" />
                        </button>
                        
                        {/* Waveform Visual */}
                        <div className="flex-1 flex items-center gap-1">
                          {[4, 6, 3, 7, 5, 8, 4, 6, 7, 5, 6, 4, 7, 5, 3, 6, 5, 4, 6, 3, 5, 7].map((height, i) => (
                            <div 
                              key={i} 
                              className="w-1 rounded-full transition-all hover:scale-y-110 bg-white/70"
                              style={{ height: `${height * 2.5}px` }}
                            />
                          ))}
                        </div>
                        
                        {/* Duration/Size */}
                        <span className="text-xs font-medium text-white/90">
                          {message.file_size ? `${Math.round(message.file_size / 1024)}KB` : '0:00'}
                        </span>
                        
                        {/* Hidden Audio Element */}
                        <audio className="hidden">
                          <source src={message.gcs_url} type={message.mime_type || 'audio/mpeg'} />
                        </audio>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Fallback - No GCS URL */
                  <div className={`min-w-[280px] ${
                    isFromCustomer 
                      ? 'flex items-center gap-3 p-3 rounded-2xl bg-white border border-gray-100 shadow-sm' 
                      : 'flex items-center gap-3 p-3 rounded-xl bg-white/10'
                  }`}>
                    {isFromCustomer ? (
                      /* Ingoing Fallback */
                      <>
                        <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center shadow-md ${
                          message.content_type === 'voice'
                            ? 'bg-gradient-to-br from-emerald-400 to-green-500'
                            : 'bg-gradient-to-br from-purple-400 to-purple-500'
                        }`}>
                          {message.content_type === 'voice' ? (
                            <Mic className="h-5 w-5 text-white" />
                          ) : (
                            <svg 
                              className="h-5 w-5 text-white"
                              fill="currentColor" 
                              viewBox="0 0 20 20"
                            >
                              <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">
                            {message.content_type === 'voice' ? 'Voice Message' : 'Audio File'}
                          </p>
                          {message.original_filename && (
                            <p className="text-xs text-gray-500 truncate">
                              {message.original_filename}
                            </p>
                          )}
                        </div>
                      </>
                    ) : (
                      /* Outgoing Fallback */
                      <>
                        <div className="w-11 h-11 rounded-full flex items-center justify-center bg-gradient-to-br from-white to-gray-100 shadow-lg">
                          {message.content_type === 'voice' ? (
                            <Mic className="h-5 w-5 text-blue-600" />
                          ) : (
                            <svg 
                              className="h-5 w-5 text-blue-600"
                              fill="currentColor" 
                              viewBox="0 0 20 20"
                            >
                              <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">
                            {message.content_type === 'voice' ? 'Voice Message' : 'Audio File'}
                          </p>
                          {message.original_filename && (
                            <p className="text-xs text-white/70 truncate">
                              {message.original_filename}
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
                {message.content_text && (
                  <p className="text-sm whitespace-pre-wrap break-words mt-2">
                    {message.content_text}
                  </p>
                )}
              </div>
            )}

            {/* Document/File Message */}
            {message.content_type === 'document' && (
              <div className="space-y-2">
                <div className="flex items-center space-x-3 p-3 bg-gray-100 rounded-lg">
                  <FileText className="h-6 w-6 text-blue-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {message.original_filename || 'Document'}
                    </p>
                    {message.file_size && (
                      <p className="text-xs text-gray-500">
                        {(message.file_size / 1024).toFixed(1)} KB
                      </p>
                    )}
                  </div>
                  {message.gcs_url && (
                    <a 
                      href={message.gcs_url} 
                      download={message.original_filename}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Download className="h-5 w-5" />
                    </a>
                  )}
                </div>
                {message.content_text && (
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.content_text}
                  </p>
                )}
              </div>
            )}

            {/* Sticker Message */}
            {message.content_type === 'sticker' && (
              <div>
                {message.gcs_url ? (
                  <img 
                    src={message.gcs_url} 
                    alt="Sticker"
                    className="w-32 h-32 object-contain"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Smile className="h-12 w-12 text-gray-400" />
                  </div>
                )}
              </div>
            )}

            {/* Location Message */}
            {message.content_type === 'location' && (
              <div className="space-y-2">
                {message.metadata?.location?.latitude && message.metadata?.location?.longitude ? (
                  <div className="flex items-start space-x-3 p-3 bg-gray-100 rounded-lg">
                    <MapPin className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {message.metadata.location.name || 'Shared Location'}
                      </p>
                      {message.metadata.location.address && (
                        <p className="text-xs text-gray-600 mt-1">
                          {message.metadata.location.address}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1 font-mono">
                        {message.metadata.location.latitude.toFixed(6)}, {message.metadata.location.longitude.toFixed(6)}
                      </p>
                      <a
                        href={`https://www.google.com/maps?q=${message.metadata.location.latitude},${message.metadata.location.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline mt-2 inline-block"
                      >
                        📍 Open in Google Maps
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 p-3 bg-gray-100 rounded-lg">
                    <MapPin className="h-5 w-5 text-gray-500" />
                    <span className="text-sm text-gray-600">Location shared</span>
                  </div>
                )}
                {message.content_text && (
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.content_text}
                  </p>
                )}
              </div>
            )}

            {/* Contact Message */}
            {message.content_type === 'contacts' && (
              <div className="space-y-2">
                <div className="flex items-start space-x-3 p-3 bg-gray-100 rounded-lg">
                  <Contact2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    {message.metadata?.contacts && Array.isArray(message.metadata.contacts) ? (
                      message.metadata.contacts.map((contact: any, idx: number) => (
                        <div key={idx} className={idx > 0 ? 'mt-2 pt-2 border-t border-gray-200' : ''}>
                          <p className="text-sm font-medium text-gray-900">
                            {contact.name?.formatted_name || contact.name?.first_name || 'Contact'}
                          </p>
                          {contact.phones && contact.phones.length > 0 && (
                            <p className="text-xs text-gray-600 mt-0.5">
                              📞 {contact.phones[0].phone}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-600">Contact card</p>
                    )}
                  </div>
                </div>
                {message.content_text && (
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.content_text}
                  </p>
                )}
              </div>
            )}

            {/* Generic Media Type (detect from mime_type or media_type) */}
            {message.content_type === 'media' && (
              <div className="space-y-2">
                {(() => {
                  const mediaType = message.media_type || '';
                  const mimeType = message.mime_type || '';
                  
                  // Image
                  if (mediaType === 'image' || mimeType.startsWith('image/')) {
                    return (
                      <>
                        {message.gcs_url && (
                          <img 
                            src={message.gcs_url} 
                            alt={message.original_filename || 'Image'}
                            className="max-w-full rounded-lg cursor-pointer hover:opacity-90"
                            onClick={() => window.open(message.gcs_url!, '_blank')}
                            loading="lazy"
                          />
                        )}
                        {message.content_text && (
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {message.content_text}
                          </p>
                        )}
                      </>
                    );
                  }
                  
                  // Video
                  if (mediaType === 'video' || mimeType.startsWith('video/')) {
                    return (
                      <>
                        {message.gcs_url && (
                          <video 
                            controls 
                            className="max-w-full rounded-lg"
                            preload="metadata"
                          >
                            <source src={message.gcs_url} type={mimeType} />
                            <div className="flex items-center space-x-2 p-3 bg-gray-100 rounded-lg">
                              <Play className="h-5 w-5 text-gray-500" />
                              <a 
                                href={message.gcs_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline"
                              >
                                Open video
                              </a>
                            </div>
                          </video>
                        )}
                        {message.content_text && (
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {message.content_text}
                          </p>
                        )}
                      </>
                    );
                  }
                  
                  // Audio
                  if (mediaType === 'audio' || mimeType.startsWith('audio/')) {
                    return (
                      <>
                        {message.gcs_url ? (
                          <div className="min-w-[300px]">
                            {isFromCustomer ? (
                              /* Ingoing Audio - Customer Messages */
                              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-gray-100 shadow-sm">
                                {/* Play Button dengan Icon Musik */}
                                <button 
                                  className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105 shadow-md bg-gradient-to-br from-purple-400 to-purple-500 hover:from-purple-500 hover:to-purple-600"
                                  onClick={(e) => {
                                    const audio = e.currentTarget.parentElement?.querySelector('audio') as HTMLAudioElement;
                                    if (audio) {
                                      if (audio.paused) {
                                        audio.play();
                                      } else {
                                        audio.pause();
                                      }
                                    }
                                  }}
                                >
                                  <svg 
                                    className="h-5 w-5 text-white"
                                    fill="currentColor" 
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                                  </svg>
                                </button>
                                
                                {/* Waveform Visual */}
                                <div className="flex-1 flex items-center gap-0.5">
                                  {[4, 7, 3, 8, 5, 9, 4, 7, 8, 6, 7, 4, 8, 6, 3, 7, 6, 5, 7, 4, 6, 8, 5].map((height, i) => (
                                    <div 
                                      key={i} 
                                      className="w-1 rounded-full bg-purple-400"
                                      style={{ height: `${height * 2.5}px` }}
                                    />
                                  ))}
                                </div>
                                
                                {/* Duration/Size */}
                                <span className="text-xs font-medium text-gray-500">
                                  {message.file_size ? `${Math.round(message.file_size / 1024)}KB` : '0:00'}
                                </span>
                                
                                {/* Hidden Audio Element */}
                                <audio className="hidden">
                                  <source src={message.gcs_url} type={mimeType} />
                                </audio>
                              </div>
                            ) : (
                              /* Outgoing Audio - Agent Messages */
                              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/10 backdrop-blur-sm">
                                {/* Icon Musik di sebelah kiri */}
                                <div className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center bg-gradient-to-br from-white to-gray-100 shadow-lg shadow-white/20">
                                  <svg 
                                    className="h-5 w-5 text-blue-600"
                                    fill="currentColor" 
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                                  </svg>
                                </div>
                                
                                {/* Play Button */}
                                <button 
                                  className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110 bg-white hover:bg-gray-50 shadow-md"
                                  onClick={(e) => {
                                    const audio = e.currentTarget.parentElement?.querySelector('audio') as HTMLAudioElement;
                                    if (audio) {
                                      if (audio.paused) {
                                        audio.play();
                                      } else {
                                        audio.pause();
                                      }
                                    }
                                  }}
                                >
                                  <Play className="h-4 w-4 ml-0.5 text-green-600" />
                                </button>
                                
                                {/* Waveform Visual */}
                                <div className="flex-1 flex items-center gap-1">
                                  {[4, 6, 3, 7, 5, 8, 4, 6, 7, 5, 6, 4, 7, 5, 3, 6, 5, 4, 6, 3, 5, 7].map((height, i) => (
                                    <div 
                                      key={i} 
                                      className="w-1 rounded-full transition-all hover:scale-y-110 bg-white/70"
                                      style={{ height: `${height * 2.5}px` }}
                                    />
                                  ))}
                                </div>
                                
                                {/* Duration/Size */}
                                <span className="text-xs font-medium text-white/90">
                                  {message.file_size ? `${Math.round(message.file_size / 1024)}KB` : '0:00'}
                                </span>
                                
                                {/* Hidden Audio Element */}
                                <audio className="hidden">
                                  <source src={message.gcs_url} type={mimeType} />
                                </audio>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2 p-3 bg-gray-100 rounded-lg">
                            <Volume2 className="h-5 w-5 text-gray-500" />
                            <span className="text-sm text-gray-600">Audio file</span>
                          </div>
                        )}
                        {message.content_text && (
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {message.content_text}
                          </p>
                        )}
                      </>
                    );
                  }
                  
                  // Document / Other files
                  return (
                    <div className="flex items-center space-x-3 p-3 bg-gray-100 rounded-lg">
                      <FileText className="h-8 w-8 text-blue-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {message.original_filename || message.gcs_filename || 'File'}
                        </p>
                        {message.file_size && (
                          <p className="text-xs text-gray-500">
                            {(message.file_size / 1024).toFixed(1)} KB
                          </p>
                        )}
                        {message.mime_type && (
                          <p className="text-xs text-gray-500">
                            {message.mime_type}
                          </p>
                        )}
                      </div>
                      {message.gcs_url && (
                        <a 
                          href={message.gcs_url}
                          download={message.original_filename || 'download'}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button size="sm" variant="outline">
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                    </div>
                  );
                })()}
                {message.content_text && !['image/', 'video/', 'audio/'].some(prefix => 
                  (message.mime_type || message.media_type || '').startsWith(prefix)
                ) && (
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.content_text}
                  </p>
                )}
              </div>
            )}

            {/* Unsupported/Unknown Message Type */}
            {!['text', 'image', 'video', 'audio', 'voice', 'document', 'sticker', 'location', 'contacts', 'media'].includes(message.content_type || '') && (
              <div className="flex items-center space-x-2 p-3 bg-gray-100 rounded-lg">
                <Info className="h-5 w-5 text-gray-500" />
                <span className="text-sm text-gray-600">
                  Unsupported message type: {message.content_type || 'unknown'}
                </span>
              </div>
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
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
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
            {/* Load More Indicator */}
            {hasMore && (
              <div className="flex justify-center my-2">
                <button
                  onClick={loadMoreMessages}
                  disabled={loading}
                  className="text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400"
                >
                  {loading ? 'Loading...' : 'Load older messages'}
                </button>
              </div>
            )}
            
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
        {isRecording ? (
          /* Voice Recording UI */
          <div className="flex items-center space-x-3 py-2">
            {/* Recording Indicator */}
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-gray-700">
                {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
              </span>
            </div>

            {/* Waveform Animation */}
            <div className="flex-1 flex items-center justify-center space-x-1">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-blue-500 rounded-full"
                  style={{
                    height: `${Math.random() * 20 + 10}px`,
                    animation: `pulse ${Math.random() * 0.5 + 0.5}s ease-in-out infinite`,
                    animationDelay: `${i * 0.05}s`,
                  }}
                />
              ))}
            </div>

            {/* Cancel Button */}
            <Button
              onClick={cancelVoiceRecording}
              variant="outline"
              className="text-red-600 hover:bg-red-50"
              title="Cancel recording"
            >
              <Trash2 className="h-5 w-5" />
            </Button>

            {/* Stop & Send Button */}
            <Button
              onClick={stopVoiceRecording}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              title="Send voice note"
            >
              <Square className="h-5 w-5" />
            </Button>
          </div>
        ) : (
          /* Normal Input UI */
          <div className="flex items-end space-x-2">
            {/* Attachment Menu */}
            <div className="relative">
              <Button
                onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                disabled={sending || !isConnected}
                variant="outline"
                size="sm"
                className="h-10"
                title="Attach file"
              >
                <Paperclip className="h-5 w-5" />
              </Button>

              {/* Attachment Dropdown */}
              {showAttachmentMenu && (
                <>
                  {/* Backdrop to close menu */}
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowAttachmentMenu(false)}
                  />
                  
                  {/* Menu */}
                  <div className="absolute bottom-full mb-2 left-0 bg-white rounded-lg shadow-lg border border-gray-200 py-2 w-48 z-20">
                    <button
                      onClick={() => handleFileSelect('image')}
                      className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center space-x-3 text-sm"
                    >
                      <ImageIcon className="h-5 w-5 text-purple-600" />
                      <span>Photo</span>
                    </button>
                    
                    <button
                      onClick={() => handleFileSelect('video')}
                      className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center space-x-3 text-sm"
                    >
                      <Film className="h-5 w-5 text-red-600" />
                      <span>Video</span>
                    </button>
                    
                    <button
                      onClick={() => handleFileSelect('document')}
                      className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center space-x-3 text-sm"
                    >
                      <FileIcon className="h-5 w-5 text-blue-600" />
                      <span>Document</span>
                    </button>
                    
                    <button
                      onClick={() => handleFileSelect('audio')}
                      className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center space-x-3 text-sm"
                    >
                      <Mic className="h-5 w-5 text-green-600" />
                      <span>Audio</span>
                    </button>
                    
                    <div className="border-t border-gray-200 my-1" />
                    
                    <button
                      onClick={handleSendContact}
                      className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center space-x-3 text-sm"
                    >
                      <Contact2 className="h-5 w-5 text-orange-600" />
                      <span>Contact</span>
                    </button>
                    
                    <button
                      onClick={handleSendLocation}
                      className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center space-x-3 text-sm"
                    >
                      <MapPin className="h-5 w-5 text-red-600" />
                      <span>Location</span>
                    </button>
                  </div>
                </>
              )}
            </div>

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

            {/* Voice Recording Button (when no text) or Send Button (when text exists) */}
            {!inputMessage.trim() ? (
              <Button
                onClick={startVoiceRecording}
                disabled={sending || !isConnected}
                className="bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-300"
                title="Record voice note"
              >
                <Mic className="h-5 w-5" />
              </Button>
            ) : (
              <Button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || sending || !isConnected}
                className="bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300"
              >
                <Send className="h-5 w-5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
