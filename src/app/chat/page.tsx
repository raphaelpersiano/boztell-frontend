'use client';

import React from 'react';
import { Layout } from '@/components/Layout';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { Message, MessageType } from '@/types';

// Mock data
const mockRooms = [
  {
    id: '1',
    customerName: 'Ahmad Rizky',
    customerPhone: '+6281234567890',
    lastMessage: 'Halo, saya ingin tanya tentang pinjaman KPR',
    lastMessageTime: new Date(Date.now() - 5 * 60 * 1000),
    unreadCount: 2,
    isAssigned: true,
    assignedAgent: 'Agent 1',
    status: 'warm'
  },
  {
    id: '2',
    customerName: 'Siti Nurhaliza',
    customerPhone: '+6281234567891',
    lastMessage: 'Terima kasih atas infonya',
    lastMessageTime: new Date(Date.now() - 30 * 60 * 1000),
    unreadCount: 0,
    isAssigned: false,
    status: 'cold'
  },
  {
    id: '3',
    customerName: 'Budi Santoso',
    customerPhone: '+6281234567892',
    lastMessage: 'Saya sudah transfer uang muka',
    lastMessageTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
    unreadCount: 1,
    isAssigned: true,
    assignedAgent: 'Agent 2',
    status: 'hot'
  }
];

const mockMessages: Message[] = [
  {
    id: '1',
    roomId: '1',
    senderId: 'customer-1',
    senderName: 'Ahmad Rizky',
    content: 'Halo, saya ingin tanya tentang pinjaman KPR',
    type: 'text',
    timestamp: new Date(Date.now() - 10 * 60 * 1000),
    isFromCustomer: true,
    status: 'read'
  },
  {
    id: '2',
    roomId: '1',
    senderId: 'agent-1',
    senderName: 'Agent 1',
    content: 'Halo Ahmad, terima kasih sudah menghubungi kami. Saya akan membantu Anda terkait pinjaman KPR.',
    type: 'text',
    timestamp: new Date(Date.now() - 8 * 60 * 1000),
    isFromCustomer: false,
    status: 'read'
  },
  {
    id: '3',
    roomId: '1',
    senderId: 'customer-1',
    senderName: 'Ahmad Rizky',
    content: 'Berapa minimal uang muka untuk KPR?',
    type: 'text',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    isFromCustomer: true,
    status: 'read'
  }
];

export default function ChatPage() {
  const { user } = useAuth();
  const [selectedRoomId, setSelectedRoomId] = React.useState<string>('1');
  const [messages, setMessages] = React.useState<Message[]>(mockMessages);

  const selectedRoom = mockRooms.find(room => room.id === selectedRoomId);
  const roomMessages = messages.filter(msg => msg.roomId === selectedRoomId);

  const handleSendMessage = (content: string, type: MessageType = 'text') => {
    const newMessage: Message = {
      id: Date.now().toString(),
      roomId: selectedRoomId,
      senderId: 'current-agent',
      senderName: 'Agent 1',
      content,
      type,
      timestamp: new Date(),
      isFromCustomer: false,
      status: 'sent'
    };

    setMessages(prev => [...prev, newMessage]);
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="flex h-full">
          <ChatSidebar
            rooms={mockRooms}
            selectedRoomId={selectedRoomId}
            onRoomSelect={setSelectedRoomId}
            userRole={user?.role || 'agent'}
          />
          <ChatWindow
            customerName={selectedRoom?.customerName || ''}
            customerPhone={selectedRoom?.customerPhone || ''}
            customerStatus={selectedRoom?.status || ''}
            messages={roomMessages}
            onSendMessage={handleSendMessage}
            isAssigned={selectedRoom?.isAssigned || false}
            assignedAgent={selectedRoom?.assignedAgent}
            userRole={user?.role || 'agent'}
          />
        </div>
      </Layout>
    </ProtectedRoute>
  );
}