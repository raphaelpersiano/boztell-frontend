'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
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
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [loading, setLoading] = useState(false);
  
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
      // No lead connected - show create mode
      setMode('create');
    }
    setRoomTitle(room?.title || '');
  }, [room]);

  const handleCreateLead = async () => {
    setLoading(true);
    try {
      console.log('🔄 Creating lead with data:', formData);
      console.log('🔄 API Base URL:', process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080');
      console.log('🔄 Full endpoint:', `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/leads`);
      
      const result = await ApiService.createNewLead(formData);
      
      console.log('🔄 Create lead result:', result);
      
      if (result.success) {
        // Link lead to room (without updating room title)
        const roomResult = await ApiService.updateRoom(roomId, {
          leads_id: result.data.id,
        });

        if (roomResult.success) {
          onSave({ lead: result.data });
          onClose();
          console.log('✅ Lead created and linked to room successfully');
          alert('Lead created successfully!');
        } else {
          throw new Error(roomResult.message || 'Failed to link lead to room');
        }
      } else {
        // Show detailed error message
        const errorMsg = result.message || result.error || 'Create failed';
        console.error('❌ Create lead failed:', errorMsg);
        alert('Failed to create lead: ' + errorMsg);
      }
    } catch (error) {
      console.error('❌ Create lead error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Network error';
      alert('Failed to create lead: ' + errorMsg);
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
        // Update room title separately if changed
        if (roomTitle !== room.title) {
          const roomResult = await ApiService.updateRoom(roomId, { title: roomTitle });
          if (!roomResult.success) {
            console.warn('Failed to update room title:', roomResult.message);
          }
        }

        onSave({ lead: result.data, roomTitle });
        setMode('view');
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
          {/* Room Title - Only show when viewing/editing existing lead */}
          {(mode === 'view' || mode === 'edit') && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Room Title
              </label>
              <Input
                value={roomTitle}
                onChange={(e) => setRoomTitle(e.target.value)}
                placeholder="e.g., Nomor Pribadi, Nomor Kantor"
                disabled={mode === 'view'}
              />
              <p className="text-xs text-gray-500 mt-1">
                Label untuk mengidentifikasi nomor ini
              </p>
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
                Loan Type *
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
            <Button
              variant="primary"
              className="w-full"
              onClick={() => setMode('edit')}
            >
              Edit Lead Information
            </Button>
          )}

          {mode === 'create' && (
            <Button
              variant="primary"
              className="w-full"
              onClick={handleCreateLead}
              disabled={loading || !formData.name || !formData.phone || !formData.loan_type}
            >
              {loading ? 'Creating...' : 'Create Lead'}
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
