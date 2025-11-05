'use client';

import React from 'react';
import { Search, MoreVertical, Archive, Users, MessageSquarePlus } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { formatRelativeTime } from '@/lib/utils';
import type { Room } from '@/types';

interface ChatSidebarProps {
  selectedRoomId?: string;
  onRoomSelect: (roomId: string) => void;
  userId: string;
  userRole: 'admin' | 'supervisor' | 'agent';
  onNewChat?: () => void;
  rooms?: Room[];  // Accept rooms as prop
  loading?: boolean;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  selectedRoomId,
  onRoomSelect,
  userId,
  userRole,
  onNewChat,
  rooms = [],
  loading = false,
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'all' | 'unassigned' | 'assigned'>('all');

  // Filter rooms based on search and tab
  const filteredRooms = rooms
    .filter(room => {
      const customerName = room.lead?.name || room.title || 'Unknown';
      const customerPhone = room.phone || '';
      
      const matchesSearch = customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           customerPhone.includes(searchQuery);
      
      // Use backend's is_assigned field (more reliable than counting)
      // Fallback to checking assigned_count if is_assigned not provided
      const isAssigned = room.is_assigned ?? ((room.assigned_count ?? room.assigned_agents?.length ?? 0) > 0);
      
      if (activeTab === 'all') return matchesSearch;
      if (activeTab === 'unassigned') return matchesSearch && !isAssigned;
      if (activeTab === 'assigned') return matchesSearch && isAssigned;
      
      return matchesSearch;
    })
    .sort((a, b) => {
      // Sort by latest message timestamp (descending - newest first)
      const timeA = a.last_message_at || a.updated_at || a.created_at || '';
      const timeB = b.last_message_at || b.updated_at || b.created_at || '';
      
      // Convert to timestamps for comparison
      const dateA = new Date(timeA).getTime();
      const dateB = new Date(timeB).getTime();
      
      // Descending order (newest first)
      return dateB - dateA;
    });

  const formatLastMessage = (room: Room): string => {
    // Handle string last_message from new API
    if (typeof room.last_message === 'string') {
      return room.last_message || 'No messages yet';
    }
    
    // Handle old object format for backward compatibility
    if (!room.last_message) return 'No messages yet';
    
    const msg = room.last_message as any;
    
    // If it's a media message
    if (msg.media_type) {
      switch (msg.media_type) {
        case 'image': return '📷 Photo';
        case 'video': return '🎥 Video';
        case 'audio': return '🎵 Audio';
        case 'document': return '📄 Document';
        default: return '📎 Media';
      }
    }
    
    // If it's a reaction
    if (msg.reaction_emoji) {
      return `Reacted ${msg.reaction_emoji}`;
    }
    
    // Text message
    return msg.content_text || 'Message';
  };

  const getMessageStatusIcon = (status: string | null | undefined): string => {
    switch (status) {
      case 'sent': return '✓';
      case 'delivered': return '✓✓';
      case 'read': return '✓✓';
      default: return '';
    }
  };

  if (loading) {
    return (
      <div className="w-80 bg-white border-r border-gray-200 flex items-center justify-center h-full">
        <div className="text-center p-4">
          <p className="text-gray-500">Loading chats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {userRole === 'agent' ? 'My Chats' : 'Main Inbox'}
          </h2>
          <div className="flex items-center space-x-2">
            {onNewChat && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onNewChat}
                title="New Chat"
              >
                <MessageSquarePlus className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm">
              <Archive className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Tabs - only for admin/supervisor */}
        {(userRole === 'admin' || userRole === 'supervisor') && (
          <div className="flex mt-3 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'all' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab('unassigned')}
              className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'unassigned' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Unassigned
            </button>
            <button
              onClick={() => setActiveTab('assigned')}
              className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'assigned' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Assigned
            </button>
          </div>
        )}
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {loading && rooms.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>Loading chats...</p>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No chats found</p>
          </div>
        ) : (
          <>
            {filteredRooms.map((room) => {
              const customerName = room.lead?.name || room.title || 'Unknown';
              const customerPhone = room.phone || '';
              const lastMessageText = formatLastMessage(room);
              // Use last_message_at if available, fallback to updated_at, then created_at
              const lastMessageTime = room.last_message_at || room.updated_at || room.created_at;
              const unreadCount = room.unread_count || 0;
              
              // Use backend's is_assigned field (more reliable)
              // Fallback to checking assigned_count if is_assigned not provided
              const isAssigned = room.is_assigned ?? ((room.assigned_count ?? room.assigned_agents?.length ?? 0) > 0);
              const assignedCount = room.assigned_count ?? room.assigned_agents?.length ?? 0;
              const leadStatus = room.lead?.leads_status || 'cold';
            
              return (
                <div
                  key={room.id}
                  onClick={() => onRoomSelect(room.id)}
                  className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedRoomId === room.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      <div className="h-12 w-12 rounded-full bg-gray-300 flex items-center justify-center">
                        <Users className="h-6 w-6 text-gray-600" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {customerName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatRelativeTime(lastMessageTime)}
                        </p>
                      </div>
                      
                      <p className="text-xs text-gray-500 mb-1">{customerPhone}</p>
                      
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-600 truncate">{lastMessageText}</p>
                        <div className="flex items-center space-x-1">
                          {unreadCount > 0 && (
                            <Badge variant="info" size="sm">
                              {unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Assignment info */}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center space-x-2">
                          {isAssigned ? (
                            <Badge variant="success" size="sm">
                              Assigned ({assignedCount})
                            </Badge>
                          ) : (
                            <Badge variant="warning" size="sm">
                              Unassigned
                            </Badge>
                          )}
                        </div>
                        <Badge variant="default" size="sm">
                          {leadStatus}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};