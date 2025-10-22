'use client';

import React from 'react';
import { Layout } from '@/components/Layout';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { LeadManagementPopup } from '@/components/chat/LeadManagementPopup';
import { NewChatModal } from '@/components/chat/NewChatModal';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { useRooms } from '@/hooks/useSupabaseRealtime';

export default function ChatPage() {
  const { user } = useAuth();
  const [selectedRoomId, setSelectedRoomId] = React.useState<string | null>(null);
  const [showLeadPopup, setShowLeadPopup] = React.useState(false);
  const [showNewChatModal, setShowNewChatModal] = React.useState(false);
  const [optimisticRoomUpdate, setOptimisticRoomUpdate] = React.useState<{[roomId: string]: any}>({});
  const [refreshingRoom, setRefreshingRoom] = React.useState(false);

  // Fetch rooms with Supabase Realtime
  const { rooms, loading: loadingRooms, refetch: refetchRooms } = useRooms(
    user?.id || '',
    user?.role || 'agent'
  );

  // Auto-select first room when rooms load
  React.useEffect(() => {
    if (!selectedRoomId && rooms.length > 0) {
      setSelectedRoomId(rooms[0].id);
    }
  }, [rooms, selectedRoomId]);

  const selectedRoom = rooms.find(room => room.id === selectedRoomId);
  
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
          ...(updatedData.roomTitle && { title: updatedData.roomTitle }),
          ...(updatedData.lead && { lead: updatedData.lead, leads_id: updatedData.lead.id }),
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
          />

          {/* Chat window with realtime messages - full width when popup closed */}
          <div className={`flex-1 transition-all duration-300 ${showLeadPopup ? 'mr-96' : ''}`}>
            {selectedRoomId ? (
              <ChatWindow
                roomId={selectedRoomId}
                userId={user?.id || ''}
                customerPhone={selectedRoom?.phone || undefined}
                onShowLeadPopup={() => setShowLeadPopup(true)}
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-gray-50">
                <p className="text-gray-500">
                  {loadingRooms ? 'Loading rooms...' : 'Select a room to start chatting'}
                </p>
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