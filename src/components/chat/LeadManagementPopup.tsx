'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Search, Plus } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ApiService } from '@/lib/api';
import type { Lead, Room } from '@/types';

interface LeadManagementPopupProps {
  roomId: string;
  room?: Room | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { lead?: Lead; roomTitle?: string }) => void;
  refreshing?: boolean;
}

export const LeadManagementPopup: React.FC<LeadManagementPopupProps> = ({
  roomId,
  room,
  isOpen,
  onClose,
  onSave,
  refreshing = false,
}) => {
  const [mode, setMode] = useState<'view' | 'create' | 'edit' | 'search'>('view');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Lead[]>([]);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: room?.phone || '',
    outstanding: 0,
    loan_type: '',
    leads_status: 'cold',
    contact_status: '',
  });

  const [roomTitle, setRoomTitle] = useState(room?.title || '');

  useEffect(() => {
    if (room?.lead) {
      setFormData({
        name: room.lead.name || '',
        phone: room.lead.phone || '',
        outstanding: room.lead.outstanding || 0,
        loan_type: room.lead.loan_type || '',
        leads_status: room.lead.leads_status || 'cold',
        contact_status: room.lead.contact_status || '',
      });
      setMode('view');
    } else if (room?.leads_id) {
      // Room has leads_id but lead not loaded yet - show view mode
      setMode('view');
    } else {
      // No lead connected - show create/search mode
      setMode('create');
    }
    setRoomTitle(room?.title || '');
  }, [room]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const result = await ApiService.getLeadsByPhone(searchQuery);
      if (result.success) {
        setSearchResults(result.data || []);
      } else {
        setSearchResults([]);
      }
      setMode('search');
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLead = async () => {
    setLoading(true);
    try {
      const result = await ApiService.createNewLead(formData);
      
      if (result.success) {
        // Link lead to room
        const roomResult = await ApiService.updateRoom(roomId, {
          leads_id: result.data.id,
          title: roomTitle || formData.name,
        });

        if (roomResult.success) {
          onSave({ lead: result.data, roomTitle });
          onClose();
          // Force refresh the room data after successful update
          console.log('✅ Lead created and room updated successfully');
        } else {
          throw new Error(roomResult.message || 'Failed to link lead to room');
        }
      } else {
        throw new Error(result.message || 'Create failed');
      }
    } catch (error) {
      console.error('Create lead error:', error);
      alert('Failed to create lead: ' + (error instanceof Error ? error.message : 'Network error'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLead = async () => {
    if (!room?.leads_id) return;

    setLoading(true);
    try {
      const result = await ApiService.updateExistingLead(room.leads_id, formData);
      
      if (result.success) {
        // Update room title if changed
        if (roomTitle !== room.title) {
          const roomResult = await ApiService.updateRoom(roomId, { title: roomTitle });
          if (!roomResult.success) {
            console.warn('Failed to update room title:', roomResult.message);
          }
        }

        onSave({ lead: result.data, roomTitle });
        onClose();
        console.log('✅ Lead updated successfully');
      } else {
        throw new Error(result.message || 'Update failed');
      }
    } catch (error) {
      console.error('Update lead error:', error);
      alert('Failed to update lead: ' + (error instanceof Error ? error.message : 'Network error'));
    } finally {
      setLoading(false);
    }
  };

  const handleLinkExistingLead = async (lead: Lead) => {
    setLoading(true);
    try {
      const result = await ApiService.updateRoom(roomId, {
        leads_id: lead.id,
        title: roomTitle || lead.name || undefined,
      });

      if (result.success) {
        onSave({ lead, roomTitle: roomTitle || lead.name || undefined });
        onClose();
      } else {
        throw new Error(result.message || 'Failed to link lead');
      }
    } catch (error) {
      console.error('Link lead error:', error);
      alert('Failed to link lead: ' + (error instanceof Error ? error.message : 'Network error'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRoomTitle = async () => {
    setLoading(true);
    try {
      const result = await ApiService.updateRoom(roomId, { title: roomTitle });
      if (result.success) {
        onSave({ roomTitle });
        onClose();
      } else {
        throw new Error(result.message || 'Failed to update room title');
      }
    } catch (error) {
      console.error('Update room title error:', error);
      alert('Failed to update room title: ' + (error instanceof Error ? error.message : 'Network error'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-96 bg-white shadow-xl flex flex-col z-40 border-l border-gray-200">
      <div className="bg-white h-full w-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-semibold text-gray-900">
              {mode === 'view' && 'Lead Information'}
              {mode === 'create' && 'Create New Lead'}
              {mode === 'edit' && 'Edit Lead'}
              {mode === 'search' && 'Search Existing Lead'}
            </h2>
            {refreshing && (
              <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Room Title */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Room Title
            </label>
            <Input
              value={roomTitle}
              onChange={(e) => setRoomTitle(e.target.value)}
              placeholder="e.g., Nomor Pribadi, Nomor Kantor"
            />
            <p className="text-xs text-gray-500 mt-1">
              Label untuk mengidentifikasi nomor ini
            </p>
          </div>

          {/* Search Existing Lead - only show if room has NO leads_id */}
          {!room?.leads_id && mode === 'create' && (
            <div className="mb-6">
              <div className="flex gap-2 mb-4">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by phone number"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={loading}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Search Results:</p>
                  {searchResults.map((lead) => (
                    <div
                      key={lead.id}
                      className="p-3 border border-gray-200 rounded-lg hover:border-blue-500 cursor-pointer"
                      onClick={() => handleLinkExistingLead(lead)}
                    >
                      <p className="font-medium text-gray-900">{lead.name}</p>
                      <p className="text-sm text-gray-600">{lead.phone}</p>
                      <p className="text-xs text-gray-500">
                        {lead.loan_type} - Rp{lead.outstanding?.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or create new lead</span>
                </div>
              </div>
            </div>
          )}

          {/* Lead Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Customer name"
                disabled={mode === 'view'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number *
              </label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="62xxx"
                disabled={mode === 'view'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Outstanding Amount
              </label>
              <Input
                type="number"
                value={formData.outstanding}
                onChange={(e) => setFormData({ ...formData, outstanding: Number(e.target.value) })}
                placeholder="0"
                disabled={mode === 'view'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Loan Type
              </label>
              <Input
                value={formData.loan_type}
                onChange={(e) => setFormData({ ...formData, loan_type: e.target.value })}
                placeholder="e.g., Personal Loan, Business Loan"
                disabled={mode === 'view'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Lead Status
              </label>
              <select
                value={formData.leads_status}
                onChange={(e) => setFormData({ ...formData, leads_status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={mode === 'view'}
              >
                <option value="cold">Cold</option>
                <option value="warm">Warm</option>
                <option value="hot">Hot</option>
                <option value="paid">Paid</option>
                <option value="service">Service</option>
                <option value="repayment">Repayment</option>
                <option value="advocate">Advocate</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contact Status
              </label>
              <Input
                value={formData.contact_status}
                onChange={(e) => setFormData({ ...formData, contact_status: e.target.value })}
                placeholder="e.g., First Contact, Follow Up"
                disabled={mode === 'view'}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 space-y-2">
          {mode === 'view' && (
            <>
              <Button
                variant="primary"
                className="w-full"
                onClick={() => setMode('edit')}
              >
                Edit Lead Information
              </Button>
              {roomTitle !== room?.title && (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={handleUpdateRoomTitle}
                  disabled={loading}
                >
                  Update Room Title Only
                </Button>
              )}
            </>
          )}

          {mode === 'create' && !room?.leads_id && (
            <Button
              variant="primary"
              className="w-full"
              onClick={handleCreateLead}
              disabled={loading || !formData.name || !formData.phone}
            >
              {loading ? 'Creating...' : 'Create Lead & Link'}
            </Button>
          )}

          {mode === 'edit' && (
            <>
              <Button
                variant="primary"
                className="w-full"
                onClick={handleUpdateLead}
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setMode('view')}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
