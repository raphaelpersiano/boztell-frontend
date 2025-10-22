'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { X } from 'lucide-react';
import { ApiService } from '@/lib/api';
import type { Lead } from '@/types';

interface LeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (lead: Lead) => void;
  lead?: Lead | null; // null = create, Lead = edit
}

const LOAN_TYPES = [
  'KTA (Kredit Tanpa Agunan)',
  'KPR (Kredit Pemilikan Rumah)',
  'Kredit Kendaraan',
  'Kartu Kredit',
  'Pinjaman Online',
  'Lainnya',
];

const LEAD_STATUSES = [
  { value: 'cold', label: 'Cold' },
  { value: 'warm', label: 'Warm' },
  { value: 'hot', label: 'Hot' },
  { value: 'paid', label: 'Paid' },
  { value: 'service', label: 'Service' },
  { value: 'repayment', label: 'Repayment' },
  { value: 'advocate', label: 'Advocate' },
];

const CONTACT_STATUSES = [
  { value: 'uncontacted', label: 'Uncontacted' },
  { value: 'contacted', label: 'Contacted' },
];

export const LeadModal: React.FC<LeadModalProps> = ({
  isOpen,
  onClose,
  onSave,
  lead,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    outstanding: 0,
    loan_type: '',
    leads_status: 'cold',
    contact_status: 'uncontacted',
    utm_id: '',
  });
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = !!lead;

  // Initialize form data
  useEffect(() => {
    if (lead) {
      setFormData({
        name: lead.name || '',
        phone: lead.phone || '',
        outstanding: lead.outstanding || 0,
        loan_type: lead.loan_type || '',
        leads_status: lead.leads_status || 'cold',
        contact_status: lead.contact_status || 'uncontacted',
        utm_id: lead.utm_id || '',
      });
    } else {
      // Reset form for create
      setFormData({
        name: '',
        phone: '',
        outstanding: 0,
        loan_type: '',
        leads_status: 'cold',
        contact_status: 'uncontacted',
        utm_id: '',
      });
    }
    setErrors({});
  }, [lead, isOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone is required';
    } else if (!/^(\+62|62|0)[0-9]{8,13}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Invalid Indonesian phone number format';
    }

    if (!formData.loan_type) {
      newErrors.loan_type = 'Loan type is required';
    }

    if (formData.outstanding < 0) {
      newErrors.outstanding = 'Outstanding amount cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      let result;
      
      if (isEditing && lead) {
        // Update existing lead
        result = await ApiService.updateExistingLead(lead.id, {
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          outstanding: formData.outstanding,
          loan_type: formData.loan_type,
          leads_status: formData.leads_status,
          contact_status: formData.contact_status,
          utm_id: formData.utm_id || undefined,
        });
      } else {
        // Create new lead
        result = await ApiService.createNewLead({
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          outstanding: formData.outstanding,
          loan_type: formData.loan_type,
          leads_status: formData.leads_status,
          contact_status: formData.contact_status,
          utm_id: formData.utm_id || undefined,
        });
      }

      if (result.success) {
        // Convert API response to our Lead type
        const savedLead: Lead = {
          id: result.data.id,
          name: result.data.name,
          phone: result.data.phone,
          outstanding: result.data.outstanding,
          loan_type: result.data.loan_type,
          leads_status: result.data.leads_status,
          contact_status: result.data.contact_status,
          utm_id: result.data.utm_id,
          created_at: result.data.created_at,
          updated_at: result.data.updated_at,
        };

        onSave(savedLead);
        onClose();
      } else {
        throw new Error(result.message || 'Failed to save lead');
      }
    } catch (error: any) {
      console.error('Save lead error:', error);
      
      if (error.message?.includes('400')) {
        setErrors({ general: 'Invalid data provided. Please check all fields.' });
      } else if (error.message?.includes('409')) {
        setErrors({ phone: 'A lead with this phone number already exists.' });
      } else {
        setErrors({ general: error.message || 'Failed to save lead. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format Indonesian phone numbers
    if (digits.startsWith('62')) {
      return `+${digits}`;
    } else if (digits.startsWith('0')) {
      return `+62${digits.slice(1)}`;
    } else if (digits.length > 0) {
      return `+62${digits}`;
    }
    
    return value;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData(prev => ({ ...prev, phone: formatted }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEditing ? 'Edit Lead' : 'Create New Lead'}
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errors.general && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {errors.general}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <Input
                label="Full Name *"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                error={errors.name}
                placeholder="Enter customer name"
              />
            </div>

            {/* Phone */}
            <div>
              <Input
                label="Phone Number *"
                type="text"
                value={formData.phone}
                onChange={handlePhoneChange}
                error={errors.phone}
                placeholder="+628123456789"
              />
            </div>

            {/* Outstanding Amount */}
            <div>
              <Input
                label="Outstanding Amount"
                type="number"
                min="0"
                step="1000"
                value={formData.outstanding}
                onChange={(e) => setFormData(prev => ({ ...prev, outstanding: Number(e.target.value) }))}
                error={errors.outstanding}
                placeholder="0"
              />
            </div>

            {/* Loan Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Loan Type *
              </label>
              <select
                value={formData.loan_type}
                onChange={(e) => setFormData(prev => ({ ...prev, loan_type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select loan type</option>
                {LOAN_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              {errors.loan_type && (
                <p className="mt-1 text-sm text-red-600">{errors.loan_type}</p>
              )}
            </div>

            {/* Lead Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lead Status
              </label>
              <select
                value={formData.leads_status}
                onChange={(e) => setFormData(prev => ({ ...prev, leads_status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {LEAD_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Contact Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Status
              </label>
              <select
                value={formData.contact_status}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {CONTACT_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* UTM ID */}
          <div>
            <Input
              label="UTM ID (Optional)"
              type="text"
              value={formData.utm_id}
              onChange={(e) => setFormData(prev => ({ ...prev, utm_id: e.target.value }))}
              placeholder="campaign-001"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                  Saving...
                </div>
              ) : (
                isEditing ? 'Update Lead' : 'Create Lead'
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};