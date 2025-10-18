'use client';

import React from 'react';
import { Layout } from '@/components/Layout';
import { LeadsTable } from '@/components/leads/LeadsTable';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Lead } from '@/types';

// Mock data
const mockLeads: Lead[] = [
  {
    id: '1',
    namaLengkap: 'Ahmad Rizky Pratama',
    nomorTelpon: '+6281234567890',
    nominalPinjaman: 500000000,
    jenisUtang: 'KPR (Kredit Pemilikan Rumah)',
    status: 'warm',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date(Date.now() - 5 * 60 * 1000),
    assignedTo: 'Agent 1',
    roomChatId: '1'
  },
  {
    id: '2',
    namaLengkap: 'Siti Nurhaliza',
    nomorTelpon: '+6281234567891',
    nominalPinjaman: 200000000,
    jenisUtang: 'KTA (Kredit Tanpa Agunan)',
    status: 'cold',
    createdAt: new Date('2024-01-14'),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000)
  },
  {
    id: '3',
    namaLengkap: 'Budi Santoso',
    nomorTelpon: '+6281234567892',
    nominalPinjaman: 150000000,
    jenisUtang: 'Kredit Kendaraan',
    status: 'hot',
    createdAt: new Date('2024-01-13'),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    assignedTo: 'Agent 2',
    roomChatId: '3'
  },
  {
    id: '4',
    namaLengkap: 'Dewi Sartika',
    nomorTelpon: '+6281234567893',
    nominalPinjaman: 75000000,
    jenisUtang: 'KTA (Kredit Tanpa Agunan)',
    status: 'paid',
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    assignedTo: 'Agent 1'
  },
  {
    id: '5',
    namaLengkap: 'Eko Prasetyo',
    nomorTelpon: '+6281234567894',
    nominalPinjaman: 300000000,
    jenisUtang: 'KPR (Kredit Pemilikan Rumah)',
    status: 'service',
    createdAt: new Date('2024-01-08'),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    assignedTo: 'Agent 3'
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