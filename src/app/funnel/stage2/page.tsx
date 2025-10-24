'use client';

import React from 'react';
import { Layout } from '@/components/Layout';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Lead, LeadStatus } from '@/types';
import { STAGE_2_STATUSES } from '@/lib/constants';
import { useAuth } from '@/context/AuthContext';
import { Filter } from 'lucide-react';

// Mock data for stage 2 (Empty for now - needs real data from backend)
const mockLeads: Lead[] = [];

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
    mockLeads.filter(lead => (STAGE_2_STATUSES as readonly string[]).includes(lead.leads_status || '')),
    []
  );

  // Get unique agents from leads (Note: Lead interface doesn't have assignedTo field anymore)
  const agents: string[] = [];

  // Filter leads based on user role and selected agent
  const filteredLeads = React.useMemo(() => {
    const leads = allStage2Leads;
    // Note: Lead interface no longer has assignedTo field
    // Filtering by agent is disabled for now
    return leads;
  }, [allStage2Leads]);

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