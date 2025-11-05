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
  const [showTemplateModal, setShowTemplateModal] = React.useState(false);
  const [optimisticRoomUpdate, setOptimisticRoomUpdate] = React.useState<{[roomId: string]: any}>({});
  const [refreshingRoom, setRefreshingRoom] = React.useState(false);
  const [pendingRoomSelection, setPendingRoomSelection] = React.useState<{
    phone?: string;
    timestamp: number;
  } | null>(null);

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

  // Auto-select room when it appears (from template message sent)
  React.useEffect(() => {
    if (!pendingRoomSelection || !pendingRoomSelection.phone) return;
    
    // Check if pending selection is too old (> 30 seconds)
    const ageInSeconds = (Date.now() - pendingRoomSelection.timestamp) / 1000;
    if (ageInSeconds > 30) {
      console.log('⏰ Pending room selection expired, clearing...');
      setPendingRoomSelection(null);
      return;
    }
    
    // Try to find room by phone
    const cleanPendingPhone = pendingRoomSelection.phone.replace(/\D/g, '');
    const matchingRoom = rooms.find(r => {
      const cleanRoomPhone = r.room_phone.replace(/\D/g, '');
      return cleanRoomPhone === cleanPendingPhone || 
             cleanRoomPhone.endsWith(cleanPendingPhone) ||
             cleanPendingPhone.endsWith(cleanRoomPhone);
    });
    
    if (matchingRoom) {
      console.log('✅ Room appeared via realtime! Auto-selecting:', matchingRoom.room_id);
      setSelectedRoomId(matchingRoom.room_id);
      setPendingRoomSelection(null); // Clear pending
    } else {
      console.log('⏳ Still waiting for room to appear...', { 
        pendingPhone: cleanPendingPhone, 
        availableRooms: rooms.length,
        ageInSeconds: Math.round(ageInSeconds)
      });
    }
  }, [rooms, pendingRoomSelection]);

  const selectedRoom = rooms.find(room => room.room_id === selectedRoomId);
  
  // Apply optimistic updates to selected room
  const displayRoom = selectedRoom && optimisticRoomUpdate[selectedRoomId || ''] 
    ? { ...selectedRoom, ...optimisticRoomUpdate[selectedRoomId || ''] }
    : selectedRoom;

  // Transform displayRoom to match Room type expected by LeadManagementPopup
  const transformedDisplayRoom = displayRoom ? {
    id: displayRoom.room_id,
    phone: displayRoom.room_phone,
    title: displayRoom.room_title,
    leads_id: displayRoom.room_leads_id || displayRoom.leads_info?.id || null, // Prioritize direct leads_id field
    created_at: displayRoom.room_created_at,
    updated_at: displayRoom.room_updated_at,
    lead: displayRoom.leads_info ? {
      id: displayRoom.leads_info.id,
      name: displayRoom.leads_info.name,
      phone: displayRoom.leads_info.phone,
      leads_status: displayRoom.leads_info.leads_status,
      contact_status: displayRoom.leads_info.contact_status,
      outstanding: 0,
      loan_type: '',
      utm_id: null,
      created_at: '',
      updated_at: '',
    } : undefined,
    last_message: displayRoom.last_message,
    last_message_at: displayRoom.last_message_at,
    unread_count: displayRoom.unread_count,
    is_assigned: displayRoom.is_assigned,
  } : null;

  const handleSaveLeadPopup = (updatedData?: { lead?: any; roomTitle?: string }) => {
    setShowLeadPopup(false);
    
    // If we have updated data, apply optimistic update
    if (updatedData && selectedRoomId) {
      console.log('Lead data updated, applying optimistic update...', updatedData);
      
      // Apply optimistic update immediately for instant UI feedback
      setOptimisticRoomUpdate(prev => ({
        ...prev,
        [selectedRoomId]: {
          ...(updatedData.roomTitle && { room_title: updatedData.roomTitle }),
          ...(updatedData.lead && { leads_info: updatedData.lead }),
        }
      }));
      
      // Optional: Refresh rooms data to sync with database in background
      // If this fails, we keep the optimistic update so UI doesn't break
      console.log('📡 Attempting to refresh rooms in background...');
      setRefreshingRoom(true);
      refetchRooms()
        .then(() => {
          console.log('✅ Rooms refreshed successfully after lead update');
          // Clear optimistic update after real data is loaded
          setOptimisticRoomUpdate(prev => {
            const newState = { ...prev };
            delete newState[selectedRoomId];
            return newState;
          });
        })
        .catch((error) => {
          console.error('⚠️ Failed to refresh rooms after lead update:', error);
          console.log('ℹ️ Keeping optimistic update - UI will continue to work');
          // Keep optimistic update - don't clear it since refresh failed
        })
        .finally(() => {
          setRefreshingRoom(false);
        });
    }
  };

  const handleNewChatSuccess = (roomId: string, phoneNumber?: string) => {
    console.log('🎯 Template sent successfully', { roomId, phoneNumber });
    
    setShowNewChatModal(false);
    setShowTemplateModal(false);
    
    // Strategy 1: If we have room_id, check if it exists in current list
    if (roomId) {
      const roomExists = rooms.some(r => r.room_id === roomId);
      
      if (roomExists) {
        console.log('✅ Room exists in list, selecting immediately:', roomId);
        setSelectedRoomId(roomId);
        setPendingRoomSelection(null); // Clear any pending
        return; // Early exit - room selected successfully
      } else {
        console.log('ℹ️ Room not in list yet, will wait for realtime update or refetch...');
        // Continue to refetch strategy below
      }
    }
    
    // Set pending room selection (will auto-select when room appears)
    if (phoneNumber) {
      console.log('📌 Setting pending room selection for phone:', phoneNumber);
      setPendingRoomSelection({
        phone: phoneNumber,
        timestamp: Date.now(),
      });
    }
    
    // Strategy 2: Refetch and try to find room by phone or room_id
    console.log('📡 Refreshing rooms list to find new/updated room...');
    refetchRooms()
      .then(() => {
        console.log('✅ Rooms list refreshed');
        
        // Try to find room by room_id first (most reliable)
        if (roomId) {
          const roomById = rooms.find(r => r.room_id === roomId);
          if (roomById) {
            console.log('✅ Found room by ID after refetch:', roomId);
            setSelectedRoomId(roomId);
            setPendingRoomSelection(null); // Clear pending
            return;
          }
        }
        
        // Fallback: Try to find room by phone number
        if (phoneNumber) {
          // Clean phone number (remove +, spaces, etc.)
          const cleanPhone = phoneNumber.replace(/\D/g, '');
          const roomByPhone = rooms.find(r => {
            const cleanRoomPhone = r.room_phone.replace(/\D/g, '');
            return cleanRoomPhone === cleanPhone || 
                   cleanRoomPhone.endsWith(cleanPhone) ||
                   cleanPhone.endsWith(cleanRoomPhone);
          });
          
          if (roomByPhone) {
            console.log('✅ Found room by phone after refetch:', roomByPhone.room_id);
            setSelectedRoomId(roomByPhone.room_id);
            setPendingRoomSelection(null); // Clear pending
            return;
          }
        }
        
        // If still not found, wait for socket event (useEffect will auto-select)
        console.log('⏳ Room not found yet, waiting for socket event new_room_complete...');
        console.log('💡 Tip: Room should appear automatically via realtime when backend emits event');
        console.log('📌 Pending selection active - will auto-select when room appears');
      })
      .catch((error) => {
        console.error('⚠️ Failed to refresh rooms:', error);
        console.log('⏳ Waiting for socket event to deliver room...');
        console.log('📌 Pending selection active - will auto-select when room appears');
      });
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
      leads_id: room.room_leads_id || room.leads_info?.id || null, // Prioritize direct leads_id field
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
                    onClick={() => refetchRooms()}
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
                roomTitle={selectedRoom?.room_title || undefined}
                lastMessageAt={selectedRoom?.last_message_at || undefined}
                onShowLeadPopup={() => setShowLeadPopup(true)}
                onShowTemplateModal={() => setShowTemplateModal(true)}
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
              room={transformedDisplayRoom}
              isOpen={showLeadPopup}
              onClose={() => setShowLeadPopup(false)}
              onSave={handleSaveLeadPopup}
              refreshing={refreshingRoom}
            />
          )}

          {/* New Chat Modal - From Sidebar (empty phone) */}
          <NewChatModal
            isOpen={showNewChatModal}
            onClose={() => setShowNewChatModal(false)}
            onSuccess={handleNewChatSuccess}
            userId={user?.id || ''}
          />

          {/* Template Modal - From ChatWindow (pre-filled phone) */}
          <NewChatModal
            isOpen={showTemplateModal}
            onClose={() => setShowTemplateModal(false)}
            onSuccess={handleNewChatSuccess}
            userId={user?.id || ''}
            prefilledPhone={selectedRoom?.room_phone || undefined}
            currentRoomId={selectedRoomId || undefined}
          />
        </div>
      </Layout>
    </ProtectedRoute>
  );
}