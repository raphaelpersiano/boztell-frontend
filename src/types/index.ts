// Database Types (aligned with Supabase schema)
export interface Lead {
  id: string;
  utm_id: string | null;
  leads_status: string | null;
  contact_status: string | null;
  name: string | null;
  phone: string | null;
  outstanding: number | null;
  loan_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  title: string | null;
  phone: string | null;
  leads_id: string | null;
  created_at: string;
  updated_at: string;
  // Extended fields from joins
  lead?: Lead;
  last_message?: Message;
  unread_count?: number;
}

export interface RoomParticipant {
  room_id: string;
  user_id: string;
  joined_at: string;
}

export interface Message {
  id: string;
  room_id: string;
  content_type: string | null;
  content_text: string | null;
  media_type: string | null;
  media_id: string | null;
  gcs_filename: string | null;
  gcs_url: string | null;
  file_size: number | null;
  mime_type: string | null;
  original_filename: string | null;
  wa_message_id: string | null;
  status: MessageStatus | null;
  status_timestamp: string | null;
  metadata: Record<string, unknown> | null;
  reply_to_wa_message_id: string | null;
  reaction_emoji: string | null;
  reaction_to_wa_message_id: string | null;
  user_id: string | null; // null = from customer, filled = from agent
  created_at: string;
  updated_at: string;
  // Extended fields
  user?: User;
  replied_message?: Message;
}

export interface MessageStatusHistory {
  id: number;
  message_id: string | null;
  status: MessageStatus | null;
  timestamp: string | null;
  recipient_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed';

export type LeadStatus = 'cold' | 'warm' | 'hot' | 'paid' | 'service' | 'repayment' | 'advocate';

export type UserRole = 'admin' | 'supervisor' | 'agent';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  isOnline: boolean;
}

// Legacy types for backward compatibility
export interface ChatRoom extends Room {
  // Extends Room with any additional properties if needed
}

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'contact' | 'location';

export interface MessageMetadata {
  fileName?: string;
  fileSize?: number;
  duration?: number;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  contact?: {
    name: string;
    phone: string;
  };
}

export interface UnknownLead {
  id: string;
  phoneNumber: string;
  name?: string;
  messages: Message[];
  createdAt: Date;
}