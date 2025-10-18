'use client';

import React from 'react';
import { Layout } from '@/components/Layout';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Lead, LeadStatus } from '@/types';
import { STAGE_1_STATUSES } from '@/lib/constants';
import { useAuth } from '@/context/AuthContext';
import { Filter } from 'lucide-react';

// Mock data (same as leads page but filtered for stage 1)
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
    assignedTo: 'Agent 1'
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
    assignedTo: 'Agent 2'
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
    namaLengkap: 'Maya Sari',
    nomorTelpon: '+6281234567895',
    nominalPinjaman: 100000000,
    jenisUtang: 'Kartu Kredit',
    status: 'cold',
    createdAt: new Date('2024-01-12'),
    updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000)
  },
  {
    id: '6',
    namaLengkap: 'Rudi Hartono',
    nomorTelpon: '+6281234567896',
    nominalPinjaman: 250000000,
    jenisUtang: 'KPR (Kredit Pemilikan Rumah)',
    status: 'warm',
    createdAt: new Date('2024-01-11'),
    updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    assignedTo: 'Agent 3'
  }
];

const stage1Columns = [
  { title: 'Cold', status: 'cold' as LeadStatus },
  { title: 'Warm', status: 'warm' as LeadStatus },
  { title: 'Hot', status: 'hot' as LeadStatus },
  { title: 'Paid', status: 'paid' as LeadStatus }
];

export default function FunnelStage1Page() {
  const { user } = useAuth();
  const [selectedAgent, setSelectedAgent] = React.useState<string>('all');
  
  // Get all leads for stage 1
  const allStage1Leads = React.useMemo(() => 
    mockLeads.filter(lead => (STAGE_1_STATUSES as readonly string[]).includes(lead.status)),
    []
  );

  // Get unique agents from leads
  const agents = React.useMemo(() => {
    const agentSet = new Set(allStage1Leads.map(lead => lead.assignedTo).filter(Boolean));
    return Array.from(agentSet);
  }, [allStage1Leads]);

  // Filter leads based on user role and selected agent
  const filteredLeads = React.useMemo(() => {
    let leads = allStage1Leads;

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
  }, [allStage1Leads, user, selectedAgent]);

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

  const handleCreateLead = () => {
    console.log('Create new lead');
    // Here you would open create modal
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="h-full">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Funnel Stage 1</h1>
              <p className="text-gray-600">Manage leads from initial contact to payment</p>
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
              
              <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                Total: {leads.length} leads
              </div>
              
              {/* Show current filter for agents */}
              {user?.role === 'agent' && (
                <div className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                  Showing: {user.name}'s leads
                </div>
              )}
            </div>
          </div>
          
          <KanbanBoard
            leads={leads}
            columns={stage1Columns}
            onLeadClick={handleLeadClick}
            onStatusChange={handleStatusChange}
            onCreateLead={handleCreateLead}
          />
        </div>
      </Layout>
    </ProtectedRoute>
  );
}