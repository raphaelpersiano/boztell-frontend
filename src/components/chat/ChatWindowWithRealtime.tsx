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
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [mediaCaption, setMediaCaption] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use realtime hooks
  const { messages, loading: messagesLoading } = useMessages(roomId);
  const { lead, loading: leadLoading } = useLead(messages[0]?.room_id || null);

  // Fetch room data to get phone number if not provided
  useEffect(() => {
    const fetchRoomPhone = async () => {
      try {
        const { data } = await supabase
          .from('rooms')
          .select('phone, leads_id')
          .eq('id', roomId)
          .single();
        
        const roomData = data as { phone: string | null; leads_id: string | null } | null;
        
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
        console.error('Error fetching room phone:', error);
      }
    };

    if (!customerPhone && roomId) {
      fetchRoomPhone();
    }
  }, [roomId, customerPhone]);
  
  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    setInputMessage('');
    setSending(true);

    try {
      // Use new backend API format
      await ApiService.sendMessage({
        to: phoneToSend,          // Phone number
        text: messageText,        // Message text
        user_id: userId,          // Agent ID
      });
      // Message will appear automatically via realtime subscription
    } catch (error: any) {
      console.error('Send message error:', error);
      
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

    setSending(true);

    try {
      await ApiService.sendMediaCombined({
        media: selectedFile,
        to: phoneToSend,
        caption: mediaCaption || undefined,
        user_id: userId,
      });

      // Clear state
      setSelectedFile(null);
      setFilePreview(null);
      setMediaCaption('');
      
      alert('Media sent successfully!');
    } catch (error: any) {
      console.error('Send media error:', error);
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
      alert('Contact sent successfully!');
    } catch (error: any) {
      console.error('Send contact error:', error);
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
      alert('Location sent successfully!');
    } catch (error: any) {
      console.error('Send location error:', error);
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
    const showDate = index === 0 || 
      new Date(message.created_at).toDateString() !== 
      new Date(messages[index - 1].created_at).toDateString();

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
            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
              isFromCustomer
                ? 'bg-white text-gray-900'
                : 'bg-blue-500 text-white'
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
                <span className={`text-xs ${message.status === 'read' ? 'text-blue-200' : 'text-blue-100'}`}>
                  {getMessageStatusIcon(message.status)}
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
        {messagesLoading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-500">Loading messages...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-gray-500 mb-2">No messages yet</p>
              <p className="text-sm text-gray-400">Send a message to start the conversation</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => renderMessage(message, index))}
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
