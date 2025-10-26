'use client';

import React from 'react';
import { Layout } from '@/components/Layout';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { LeadManagementPopup } from '@/components/chat/LeadManagementPopup';
import { NewChatModal } from '@/components/chat/NewChatModal';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/hooks/useSocket';
import { useRealtimeRooms } from '@/hooks/useRealtimeRooms';

export default function ChatPage() {
  const { user } = useAuth();
  const [selectedRoomId, setSelectedRoomId] = React.useState<string | null>(null);
  const [showLeadPopup, setShowLeadPopup] = React.useState(false);
  const [showNewChatModal, setShowNewChatModal] = React.useState(false);
  const [optimisticRoomUpdate, setOptimisticRoomUpdate] = React.useState<{[roomId: string]: any}>({});
  const [refreshingRoom, setRefreshingRoom] = React.useState(false);

  // ✅ Socket.IO connection (shared across components)
  const { socket, isConnected, error: socketError } = useSocket();

  // ✅ Fetch rooms with real-time updates via Socket.IO
  const { rooms, loading: loadingRooms, error: roomsError, refetch: refetchRooms, markRoomAsRead } = useRealtimeRooms({
    socket,
    isConnected,
    userId: user?.id,
    userRole: user?.role,
  });

  // Auto-select first room when rooms load
  React.useEffect(() => {
    if (!selectedRoomId && rooms.length > 0) {
      setSelectedRoomId(rooms[0].room_id);
    }
  }, [rooms, selectedRoomId]);

  // Mark room as read when selected
  React.useEffect(() => {
    if (selectedRoomId) {
      markRoomAsRead(selectedRoomId);
    }
  }, [selectedRoomId, markRoomAsRead]);

  const selectedRoom = rooms.find(room => room.room_id === selectedRoomId);
  
  // Apply optimistic updates to selected room
  const displayRoom = selectedRoom && optimisticRoomUpdate[selectedRoomId || ''] 
    ? { ...selectedRoom, ...optimisticRoomUpdate[selectedRoomId || ''] }
    : selectedRoom;

  const handleSaveLeadPopup = (updatedData?: { lead?: any; roomTitle?: string }) => {
    setShowLeadPopup(false);
    
    // If we have updated data, apply optimistic update and refresh
    if (updatedData && selectedRoomId) {
      console.log('Lead data updated, applying optimistic update...', updatedData);
      
      // Apply optimistic update immediately
      setOptimisticRoomUpdate(prev => ({
        ...prev,
        [selectedRoomId]: {
          ...(updatedData.roomTitle && { room_title: updatedData.roomTitle }),
          ...(updatedData.lead && { leads_info: updatedData.lead }),
        }
      }));
      
      // Force refresh rooms data to sync with database
      setRefreshingRoom(true);
      refetchRooms().then(() => {
        // Clear optimistic update after real data is loaded
        setOptimisticRoomUpdate(prev => {
          const newState = { ...prev };
          delete newState[selectedRoomId];
          return newState;
        });
        setRefreshingRoom(false);
      });
    }
  };

  const handleNewChatSuccess = (roomId: string) => {
    setShowNewChatModal(false);
    // Room list will refresh automatically via realtime subscription
    // Optionally select the new room
    if (roomId) {
      setSelectedRoomId(roomId);
    }
  };

  // Convert rooms to format expected by ChatSidebar
  const sidebarRooms = React.useMemo(() => {
    return rooms.map(room => ({
      id: room.room_id,
      phone: room.room_phone,
      title: room.room_title,
      last_message: room.last_message,
      last_message_at: room.last_message_at,
      unread_count: room.unread_count || 0,
      created_at: room.room_created_at,
      updated_at: room.room_updated_at,
      lead: room.leads_info,
      leads_id: room.leads_info?.id || null,
      participants: room.participants,
      // Use backend's is_assigned field (more reliable than counting participants)
      is_assigned: room.is_assigned,
      assigned_count: room.participants?.length || 0,
      assigned_agents: room.participants,
    })) as any[]; // Use any[] temporarily to bypass type check
  }, [rooms]);

  return (
    <ProtectedRoute>
      <Layout>
        <div className="flex h-full relative">
          {/* Sidebar with realtime rooms */}
          <ChatSidebar
            selectedRoomId={selectedRoomId || undefined}
            onRoomSelect={setSelectedRoomId}
            userId={user?.id || ''}
            userRole={user?.role || 'agent'}
            onNewChat={() => setShowNewChatModal(true)}
            rooms={sidebarRooms}
            loading={loadingRooms}
          />

          {/* Chat window with realtime messages - full width when popup closed */}
          <div className={`flex-1 transition-all duration-300 ${showLeadPopup ? 'mr-96' : ''}`}>
            {roomsError ? (
              <div className="flex h-full items-center justify-center bg-gray-50">
                <div className="text-center max-w-md p-6">
                  <div className="text-red-500 text-5xl mb-4">⚠️</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Failed to Load Rooms
                  </h3>
                  <p className="text-sm text-gray-600 mb-4 whitespace-pre-wrap">
                    {roomsError}
                  </p>
                  <button
                    onClick={refetchRooms}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Retry
                  </button>
                  <div className="mt-4 text-xs text-gray-500">
                    <p>Troubleshooting:</p>
                    <ul className="text-left mt-2 space-y-1">
                      <li>• Check if backend is running on localhost:8080</li>
                      <li>• Check console for detailed errors</li>
                      <li>• Verify database connection</li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : selectedRoomId ? (
              <ChatWindow
                roomId={selectedRoomId}
                userId={user?.id || ''}
                customerPhone={selectedRoom?.room_phone || undefined}
                onShowLeadPopup={() => setShowLeadPopup(true)}
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-gray-50">
                <div className="text-center max-w-md p-6">
                  {loadingRooms ? (
                    <>
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-500">Loading rooms...</p>
                    </>
                  ) : rooms.length === 0 ? (
                    <>
                      <div className="text-6xl mb-4">📭</div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {user?.role === 'agent' ? 'No Assigned Rooms' : 'No Rooms Yet'}
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        {user?.role === 'agent' 
                          ? 'You have not been assigned to any chat rooms yet. Contact your supervisor to get assigned.'
                          : 'No chat rooms have been created yet. New rooms will appear here when customers start chatting.'}
                      </p>
                      {isConnected ? (
                        <p className="text-xs text-green-600 flex items-center justify-center gap-1">
                          <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></span>
                          Connected - Waiting for new chats
                        </p>
                      ) : socketError ? (
                        <div className="mt-4">
                          <p className="text-xs text-yellow-600 mb-2">⚠️ Real-time features unavailable</p>
                          <details className="text-xs text-left">
                            <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
                              Show details
                            </summary>
                            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-32">
                              {socketError}
                            </pre>
                          </details>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">⚬ Connecting to server...</p>
                      )}
                      {user?.role === 'agent' && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-left">
                          <p className="text-xs text-blue-900 font-semibold mb-1">💡 For Admins/Supervisors:</p>
                          <p className="text-xs text-blue-700">
                            Assign agents to rooms using the "Assign Agent" button in each room.
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-gray-500 mb-2">Select a room to start chatting</p>
                      {isConnected ? (
                        <p className="text-xs text-green-600">✓ Connected to server</p>
                      ) : (
                        <p className="text-xs text-gray-400">⚬ Connecting to server...</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Lead Management Popup - slides from right */}
          {showLeadPopup && selectedRoomId && (
            <LeadManagementPopup
              roomId={selectedRoomId}
              room={displayRoom || null}
              isOpen={showLeadPopup}
              onClose={() => setShowLeadPopup(false)}
              onSave={handleSaveLeadPopup}
              refreshing={refreshingRoom}
            />
          )}

          {/* New Chat Modal */}
          <NewChatModal
            isOpen={showNewChatModal}
            onClose={() => setShowNewChatModal(false)}
            onSuccess={handleNewChatSuccess}
            userId={user?.id || ''}
          />
        </div>
      </Layout>
    </ProtectedRoute>
  );
}