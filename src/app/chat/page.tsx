'use client';

import React from 'react';
import { Layout } from '@/components/Layout';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatWindowWithRealtime } from '@/components/chat/ChatWindowWithRealtime';
import { LeadManagementPopup } from '@/components/chat/LeadManagementPopup';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { useRooms } from '@/hooks/useSupabaseRealtime';

export default function ChatPage() {
  const { user } = useAuth();
  const [selectedRoomId, setSelectedRoomId] = React.useState<string | null>(null);
  const [showLeadPopup, setShowLeadPopup] = React.useState(false);

  // Fetch rooms with Supabase Realtime
  const { rooms, loading: loadingRooms } = useRooms(
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

  const handleSaveLeadPopup = () => {
    setShowLeadPopup(false);
    // Could trigger refetch here if needed
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
          />

          {/* Chat window with realtime messages - full width when popup closed */}
          <div className={`flex-1 transition-all duration-300 ${showLeadPopup ? 'mr-96' : ''}`}>
            {selectedRoomId ? (
              <ChatWindowWithRealtime
                roomId={selectedRoomId}
                userId={user?.id || ''}
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
              room={selectedRoom || null}
              isOpen={showLeadPopup}
              onClose={() => setShowLeadPopup(false)}
              onSave={handleSaveLeadPopup}
            />
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}