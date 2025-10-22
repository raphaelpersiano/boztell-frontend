'use client';

import React from 'react';
import { Users, Plus, X, Trash2, ChevronDown, Search } from 'lucide-react';
import { Button } from '../ui/Button';
import { ApiService } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface QuickRoomAssignmentProps {
  roomId: string;
  currentAssignees?: string[]; // Array of user IDs currently assigned
  onAssignmentChange?: () => void;
}

interface Agent {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url?: string;
}

interface AssignedAgent extends Agent {
  joined_at: string;
}

export const QuickRoomAssignment: React.FC<QuickRoomAssignmentProps> = ({
  roomId,
  currentAssignees = [],
  onAssignmentChange
}) => {
  const { user } = useAuth();
  const [showModal, setShowModal] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [assignedAgents, setAssignedAgents] = React.useState<AssignedAgent[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [loadingAgents, setLoadingAgents] = React.useState(false);
  const [loadingAssigned, setLoadingAssigned] = React.useState(false);

  // Only show to supervisors/admins
  const canManageAssignments = user?.role === 'admin' || user?.role === 'supervisor';
  
  if (!canManageAssignments) {
    return null;
  }

  // Load all agents
  const loadAgents = async () => {
    setLoadingAgents(true);
    try {
      const response = await ApiService.getUsers();
      if (response.success && response.data) {
        const agentUsers = response.data.filter((u: any) => u.role === 'agent');
        setAgents(agentUsers);
      }
    } catch (error) {
      console.error('Failed to load agents:', error);
    } finally {
      setLoadingAgents(false);
    }
  };

  // Load assigned agents for this room
  const loadAssignedAgents = async () => {
    setLoadingAssigned(true);
    try {
      console.log('🔄 Loading room participants for roomId:', roomId);
      const response = await ApiService.getRoomParticipants(roomId);
      
      console.log('📊 getRoomParticipants response:', JSON.stringify(response, null, 2));
      console.log('📊 response.success:', response.success);
      console.log('📊 response.data type:', typeof response.data);
      console.log('📊 response.data:', response.data);
      
      if (response.success && response.data) {
        // Handle both array and object responses
        const participants = Array.isArray(response.data) ? response.data : [];
        console.log('📊 Participants array:', participants);
        
        const agentParticipants = participants.filter((p: any) => p.user_role === 'agent');
        console.log('📊 Agent participants:', agentParticipants);
        
        const mappedAgents = agentParticipants.map((p: any) => ({
          id: p.user_id,
          name: p.user_name,
          email: p.user_email || '',
          role: p.user_role,
          joined_at: p.joined_at
        }));
        
        console.log('📊 Mapped agents:', mappedAgents);
        setAssignedAgents(mappedAgents);
      } else {
        console.warn('⚠️ No participants data or success=false:', response);
        setAssignedAgents([]);
      }
    } catch (error) {
      console.error('❌ Failed to load assigned agents:', error);
      console.error('❌ Error details:', error instanceof Error ? error.message : error);
      setAssignedAgents([]);
    } finally {
      setLoadingAssigned(false);
    }
  };

  // Open modal and load data
  const openModal = () => {
    setShowModal(true);
    loadAgents();
    loadAssignedAgents();
  };

  // Close modal and reset
  const closeModal = () => {
    setShowModal(false);
    setSearchTerm('');
  };

  // Assign agent to room
  const handleAssignAgent = async (userId: string) => {
    // Prevent double-click or multiple calls
    if (loading) {
      console.warn('⚠️ Assignment already in progress, ignoring duplicate call');
      return;
    }
    
    setLoading(true);
    try {
      console.log('🔄 Assigning user to room:', { 
        roomId, 
        userId,
        endpoint: `/rooms/${roomId}/assign`,
        body: { user_id: userId }
      });
      
      const result = await ApiService.assignUserToRoom(roomId, userId);
      
      console.log('🔄 Full assignment result:', JSON.stringify(result, null, 2));
      console.log('🔄 result.success type:', typeof result.success);
      console.log('🔄 result.success value:', result.success);
      
      // Check if assignment was successful
      if (result && result.success === true) {
        console.log('✅ Assignment successful!');
        
        // Show success alert
        alert('Agent assigned successfully!');
        
        // Trigger parent callback
        onAssignmentChange?.();
        
        // Close modal
        closeModal();
      } else {
        console.error('❌ Assignment failed:', result);
        const errorMsg = result?.message || result?.error || 'Unknown error';
        alert('Failed to assign agent: ' + errorMsg);
      }
    } catch (error) {
      console.error('❌ Assignment error:', error);
      alert('Assignment failed: ' + (error instanceof Error ? error.message : 'Network error'));
    } finally {
      setLoading(false);
    }
  };

  // Unassign agent from room
  const handleUnassignAgent = async (userId: string) => {
    // Prevent double-click or multiple calls
    if (loading) {
      console.warn('⚠️ Unassignment already in progress, ignoring duplicate call');
      return;
    }
    
    setLoading(true);
    try {
      console.log('🔄 Unassigning user from room:', { 
        roomId, 
        userId,
        endpoint: `/rooms/${roomId}/assign/${userId}`
      });
      
      const result = await ApiService.unassignUserFromRoom(roomId, userId);
      
      console.log('🔄 Full unassignment result:', JSON.stringify(result, null, 2));
      
      if (result && result.success === true) {
        console.log('✅ Unassignment successful, refreshing lists...');
        
        // Small delay to ensure backend has processed the unassignment
        await new Promise(resolve => setTimeout(resolve, 300));
        
        await loadAssignedAgents();
        onAssignmentChange?.();
        
        console.log('✅ Lists refreshed successfully');
      } else {
        console.error('❌ Unassign failed:', result);
        // Ensure backend error message is displayed directly
        const errorMsg = result?.message || result?.error || 'Unknown error';
        alert('Failed to unassign agent: ' + errorMsg);
      }
    } catch (error) {
      console.error('❌ Unassignment error:', error);
      alert('Unassignment failed: ' + (error instanceof Error ? error.message : 'Network error'));
    } finally {
      setLoading(false);
    }
  };

  // Filter agents for search
  const filteredAgents = agents.filter(agent => 
    !assignedAgents.some(assigned => assigned.id === agent.id) &&
    (agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     agent.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <>
      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={openModal}
          className="flex items-center space-x-1 text-gray-600 hover:text-gray-700"
          title="Manage room assignments"
        >
          <Users className="h-4 w-4" />
          <span className="text-sm">Manage Access</span>
        </Button>

        {/* Assignment count badge */}
        {currentAssignees.length > 0 && (
          <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {currentAssignees.length}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-gray-900/40 flex items-center justify-center z-50"
          onClick={closeModal}
        >
          <div 
            className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                Manage Room Access
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 max-h-96 overflow-y-auto">
              {/* Currently Assigned Section */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Assigned Agents ({assignedAgents.length})
                </h4>
                
                {loadingAssigned ? (
                  <div className="text-sm text-gray-500 py-2">Loading assigned agents...</div>
                ) : assignedAgents.length === 0 ? (
                  <div className="text-sm text-gray-500 py-2">No agents assigned to this room</div>
                ) : (
                  <div className="space-y-2">
                    {assignedAgents.map((agent) => (
                      <div key={agent.id} className="flex items-center justify-between p-2 border rounded-md">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                            {agent.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{agent.name}</div>
                            <div className="text-xs text-gray-500">{agent.email}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleUnassignAgent(agent.id)}
                          disabled={loading}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Remove access"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Agent Section */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Add Agent
                </h4>
                
                {/* Search Input */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search agents..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>

                {/* Agent List */}
                {loadingAgents ? (
                  <div className="text-sm text-gray-500 py-2">Loading agents...</div>
                ) : filteredAgents.length === 0 ? (
                  <div className="text-sm text-gray-500 py-2">
                    {searchTerm ? 'No agents found matching your search' : 'All agents are already assigned'}
                  </div>
                ) : (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {filteredAgents.map((agent) => (
                      <div
                        key={agent.id}
                        className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded-md"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                            {agent.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{agent.name}</div>
                            <div className="text-xs text-gray-500">{agent.email}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAssignAgent(agent.id)}
                          disabled={loading}
                          className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white flex items-center justify-center transition-colors"
                          title="Assign agent to room"
                        >
                          <span className="text-lg font-bold leading-none">+</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end p-4 border-t">
              <Button
                variant="ghost"
                onClick={closeModal}
                className="text-gray-600"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};