'use client';

import React from 'react';
import { Layout } from '@/components/Layout';
import { LeadsTable } from '@/components/leads/LeadsTable';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Lead } from '@/types';

// Mock data - using fixed timestamps to prevent hydration mismatch
const mockLeads: Lead[] = [
  {
    id: '1',
    utm_id: null,
    name: 'Ahmad Rizky Pratama',
    phone: '6281234567890',
    outstanding: 500000000,
    loan_type: 'KPR (Kredit Pemilikan Rumah)',
    leads_status: 'warm',
    contact_status: 'Following Up',
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-10-20T10:30:00Z',
  },
  {
    id: '2',
    utm_id: null,
    name: 'Siti Nurhaliza',
    phone: '6281234567891',
    outstanding: 200000000,
    loan_type: 'KTA (Kredit Tanpa Agunan)',
    leads_status: 'cold',
    contact_status: 'First Contact',
    created_at: '2024-01-14T00:00:00Z',
    updated_at: '2024-10-20T10:00:00Z'
  },
  {
    id: '3',
    utm_id: null,
    name: 'Budi Santoso',
    phone: '6281234567892',
    outstanding: 150000000,
    loan_type: 'Kredit Kendaraan',
    leads_status: 'hot',
    contact_status: 'Negotiating',
    created_at: '2024-01-13T00:00:00Z',
    updated_at: '2024-10-20T08:30:00Z',
  },
  {
    id: '4',
    utm_id: null,
    name: 'Dewi Sartika',
    phone: '6281234567893',
    outstanding: 75000000,
    loan_type: 'KTA (Kredit Tanpa Agunan)',
    leads_status: 'paid',
    contact_status: 'Completed',
    created_at: '2024-01-10T00:00:00Z',
    updated_at: '2024-10-19T10:30:00Z',
  },
  {
    id: '5',
    utm_id: null,
    name: 'Eko Prasetyo',
    phone: '6281234567894',
    outstanding: 300000000,
    loan_type: 'KPR (Kredit Pemilikan Rumah)',
    leads_status: 'service',
    contact_status: 'In Service',
    created_at: '2024-01-08T00:00:00Z',
    updated_at: '2024-10-17T10:30:00Z',
  }
];

export default function LeadsPage() {
  const [leads, setLeads] = React.useState<Lead[]>(mockLeads);

  const handleLeadClick = (lead: Lead) => {
    console.log('Lead clicked:', lead);
    // Here you would typically navigate to lead detail page or open modal
  };

  const handleEditLead = (lead: Lead) => {
    console.log('Edit lead:', lead);
    // Here you would open edit modal or navigate to edit page
  };

  const handleDeleteLead = (leadId: string) => {
    if (confirm('Are you sure you want to delete this lead?')) {
      setLeads(prev => prev.filter(lead => lead.id !== leadId));
    }
  };

  const handleCreateLead = () => {
    console.log('Create new lead');
    // Here you would open create modal or navigate to create page
  };

  return (
    <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
      <Layout>
        <LeadsTable
          leads={leads}
          onLeadClick={handleLeadClick}
          onEditLead={handleEditLead}
          onDeleteLead={handleDeleteLead}
          onCreateLead={handleCreateLead}
        />
      </Layout>
    </ProtectedRoute>
  );
}