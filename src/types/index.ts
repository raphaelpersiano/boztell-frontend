export interface Lead {
  id: string;
  namaLengkap: string;
  nomorTelpon: string;
  nominalPinjaman: number;
  jenisUtang: string;
  status: LeadStatus;
  createdAt: Date;
  updatedAt: Date;
  assignedTo?: string;
  roomChatId?: string;
}

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

export interface ChatRoom {
  id: string;
  leadId: string;
  assignedAgent?: string;
  isActive: boolean;
  lastMessage?: Message;
  unreadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: MessageType;
  timestamp: Date;
  isFromCustomer: boolean;
  status: MessageStatus;
  metadata?: MessageMetadata;
}

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'contact' | 'location';

export type MessageStatus = 'sent' | 'delivered' | 'read';

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