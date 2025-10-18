import React from 'react';
import { Search, MoreVertical, Archive, Users } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { formatRelativeTime } from '@/lib/utils';

interface ChatRoom {
  id: string;
  customerName: string;
  customerPhone: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  isAssigned: boolean;
  assignedAgent?: string;
  status: string;
}

interface ChatSidebarProps {
  rooms: ChatRoom[];
  selectedRoomId?: string;
  onRoomSelect: (roomId: string) => void;
  userRole: 'admin' | 'supervisor' | 'agent';
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  rooms,
  selectedRoomId,
  onRoomSelect,
  userRole
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'all' | 'unassigned' | 'assigned'>('all');

  const filteredRooms = rooms.filter(room => {
    const matchesSearch = room.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         room.customerPhone.includes(searchQuery);
    
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'unassigned') return matchesSearch && !room.isAssigned;
    if (activeTab === 'assigned') return matchesSearch && room.isAssigned;
    
    return matchesSearch;
  });

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {userRole === 'agent' ? 'My Chats' : 'Main Inbox'}
          </h2>
          <div className="flex items-center space-x-2">
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
        {filteredRooms.map((room) => (
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
                    {room.customerName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatRelativeTime(room.lastMessageTime)}
                  </p>
                </div>
                
                <p className="text-xs text-gray-500 mb-1">{room.customerPhone}</p>
                
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 truncate">{room.lastMessage}</p>
                  <div className="flex items-center space-x-1">
                    {room.unreadCount > 0 && (
                      <Badge variant="info" size="sm">
                        {room.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Assignment info */}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center space-x-2">
                    {room.isAssigned ? (
                      <Badge variant="success" size="sm">
                        Assigned to {room.assignedAgent}
                      </Badge>
                    ) : (
                      <Badge variant="warning" size="sm">
                        Unassigned
                      </Badge>
                    )}
                  </div>
                  <Badge variant="default" size="sm">
                    {room.status}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {filteredRooms.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No chats found</p>
          </div>
        )}
      </div>
    </div>
  );
};