'use client';

import React from 'react';
import { Layout } from '@/components/Layout';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Lead, LeadStatus } from '@/types';
import { STAGE_2_STATUSES } from '@/lib/constants';
import { useAuth } from '@/context/AuthContext';
import { Filter } from 'lucide-react';

// Mock data for stage 2
const mockLeads: Lead[] = [
  {
    id: '7',
    namaLengkap: 'Eko Prasetyo',
    nomorTelpon: '+6281234567894',
    nominalPinjaman: 300000000,
    jenisUtang: 'KPR (Kredit Pemilikan Rumah)',
    status: 'service',
    createdAt: new Date('2024-01-08'),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    assignedTo: 'Agent 3'
  },
  {
    id: '8',
    namaLengkap: 'Linda Kartika',
    nomorTelpon: '+6281234567897',
    nominalPinjaman: 180000000,
    jenisUtang: 'KTA (Kredit Tanpa Agunan)',
    status: 'repayment',
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    assignedTo: 'Agent 1'
  },
  {
    id: '9',
    namaLengkap: 'Bambang Sutrisno',
    nomorTelpon: '+6281234567898',
    nominalPinjaman: 120000000,
    jenisUtang: 'Kredit Kendaraan',
    status: 'advocate',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    assignedTo: 'Agent 2'
  },
  {
    id: '10',
    namaLengkap: 'Ratna Sari',
    nomorTelpon: '+6281234567899',
    nominalPinjaman: 90000000,
    jenisUtang: 'KTA (Kredit Tanpa Agunan)',
    status: 'service',
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    assignedTo: 'Agent 1'
  },
  {
    id: '11',
    namaLengkap: 'Dedi Kurniawan',
    nomorTelpon: '+6281234567900',
    nominalPinjaman: 400000000,
    jenisUtang: 'KPR (Kredit Pemilikan Rumah)',
    status: 'repayment',
    createdAt: new Date('2023-12-20'),
    updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    assignedTo: 'Agent 3'
  }
];

const stage2Columns = [
  { title: 'Service', status: 'service' as LeadStatus },
  { title: 'Repayment', status: 'repayment' as LeadStatus },
  { title: 'Advocate', status: 'advocate' as LeadStatus }
];

export default function FunnelStage2Page() {
  const { user } = useAuth();
  const [selectedAgent, setSelectedAgent] = React.useState<string>('all');
  
  // Get all leads for stage 2
  const allStage2Leads = React.useMemo(() => 
    mockLeads.filter(lead => (STAGE_2_STATUSES as readonly string[]).includes(lead.status)),
    []
  );

  // Get unique agents from leads
  const agents = React.useMemo(() => {
    const agentSet = new Set(allStage2Leads.map(lead => lead.assignedTo).filter(Boolean));
    return Array.from(agentSet);
  }, [allStage2Leads]);

  // Filter leads based on user role and selected agent
  const filteredLeads = React.useMemo(() => {
    let leads = allStage2Leads;

    // If user is agent, only show their own leads
    if (user?.role === 'agent') {
      leads = leads.filter(lead => lead.assignedTo === user.name);
    } else {
      // For admin/supervisor, filter by selected agent
      if (selectedAgent !== 'all') {
        leads = leads.filter(lead => lead.assignedTo === selectedAgent);
      }
    }

    return leads;
  }, [allStage2Leads, user, selectedAgent]);

  const [leads, setLeads] = React.useState<Lead[]>(filteredLeads);

  // Update leads when filtered leads change
  React.useEffect(() => {
    setLeads(filteredLeads);
  }, [filteredLeads]);

  const handleLeadClick = (lead: Lead) => {
    console.log('Lead clicked:', lead);
    // Here you would typically open lead detail modal or navigate to detail page
  };

  const handleStatusChange = (leadId: string, newStatus: LeadStatus) => {
    setLeads(prev => 
      prev.map(lead => 
        lead.id === leadId 
          ? { ...lead, status: newStatus, updatedAt: new Date() }
          : lead
      )
    );
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="h-full">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Funnel Stage 2</h1>
              <p className="text-gray-600">Manage post-payment customer journey</p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Agent Filter - Only show for Admin/Supervisor */}
              {user && (user.role === 'admin' || user.role === 'supervisor') && (
                <div className="flex items-center space-x-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <select
                    value={selectedAgent}
                    onChange={(e) => setSelectedAgent(e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Agents</option>
                    {agents.map(agent => (
                      <option key={agent} value={agent}>{agent}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                Total: {leads.length} customers
              </div>
              
              {/* Show current filter for agents */}
              {user?.role === 'agent' && (
                <div className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                  Showing: {user.name}'s customers
                </div>
              )}
            </div>
          </div>
          
          <KanbanBoard
            leads={leads}
            columns={stage2Columns}
            onLeadClick={handleLeadClick}
            onStatusChange={handleStatusChange}
          />
        </div>
      </Layout>
    </ProtectedRoute>
  );
}