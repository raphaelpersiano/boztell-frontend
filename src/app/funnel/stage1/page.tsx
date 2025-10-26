'use client';

import React from 'react';
import { Layout } from '@/components/Layout';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Lead, LeadStatus } from '@/types';
import { STAGE_1_STATUSES } from '@/lib/constants';
import { useAuth } from '@/context/AuthContext';
import { ApiService } from '@/lib/api';
import { Filter, Loader2 } from 'lucide-react';

// Mock data (same as leads page but filtered for stage 1)
const mockLeads: Lead[] = [
  {
    id: '1',
    utm_id: null,
    leads_status: 'warm',
    contact_status: null,
    name: 'Ahmad Rizky Pratama',
    phone: '+6281234567890',
    outstanding: 500000000,
    loan_type: 'KPR (Kredit Pemilikan Rumah)',
    created_at: new Date('2024-01-15').toISOString(),
    updated_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    utm_id: null,
    leads_status: 'cold',
    contact_status: null,
    name: 'Siti Nurhaliza',
    phone: '+6281234567891',
    outstanding: 200000000,
    loan_type: 'KTA (Kredit Tanpa Agunan)',
    created_at: new Date('2024-01-14').toISOString(),
    updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    utm_id: null,
    leads_status: 'hot',
    contact_status: null,
    name: 'Budi Santoso',
    phone: '+6281234567892',
    outstanding: 150000000,
    loan_type: 'Kredit Kendaraan',
    created_at: new Date('2024-01-13').toISOString(),
    updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    utm_id: null,
    leads_status: 'hot',
    contact_status: null,
    name: 'Dewi Sartika',
    phone: '+6281234567893',
    outstanding: 75000000,
    loan_type: 'KTA (Kredit Tanpa Agunan)',
    created_at: new Date('2024-01-10').toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5',
    utm_id: null,
    leads_status: 'cold',
    contact_status: null,
    name: 'Maya Sari',
    phone: '+6281234567895',
    outstanding: 100000000,
    loan_type: 'Kartu Kredit',
    created_at: new Date('2024-01-12').toISOString(),
    updated_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '6',
    utm_id: null,
    leads_status: 'warm',
    contact_status: null,
    name: 'Rudi Hartono',
    phone: '+6281234567896',
    outstanding: 250000000,
    loan_type: 'KPR (Kredit Pemilikan Rumah)',
    created_at: new Date('2024-01-11').toISOString(),
    updated_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
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
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedAgent, setSelectedAgent] = React.useState<string>('all');

  // Fetch leads from backend
  const fetchLeads = React.useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const result = await ApiService.getLeadsWithRoleAccess({
        user_id: user.id,
        user_role: user.role as 'admin' | 'supervisor' | 'agent',
        page: 1,
        limit: 200, // Get all leads for kanban view
      });

      if (result.success) {
        // Filter only stage 1 leads (cold, warm, hot, paid)
        const stage1Leads = (result.data || []).filter((lead: Lead) =>
          (STAGE_1_STATUSES as readonly string[]).includes(lead.leads_status || '')
        );
        setLeads(stage1Leads);
        console.log('✅ Stage 1 leads loaded:', stage1Leads.length);
      } else {
        console.error('❌ Failed to load leads:', result.message);
        setLeads([]);
      }
    } catch (error) {
      console.error('❌ Error fetching leads:', error);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch on mount
  React.useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleLeadClick = (lead: Lead) => {
    console.log('Lead clicked:', lead);
    // TODO: Open lead detail modal or navigate to detail page
  };

  const handleStatusChange = async (leadId: string, newStatus: LeadStatus) => {
    // Optimistic UI update
    const previousLeads = [...leads];
    setLeads(prev => 
      prev.map(lead => 
        lead.id === leadId 
          ? { ...lead, leads_status: newStatus, updated_at: new Date().toISOString() }
          : lead
      )
    );

    // Update backend
    try {
      const result = await ApiService.updateLeadStatus(
        leadId,
        newStatus,
        user?.id,
        user?.name
      );

      if (!result.success) {
        // Rollback on error
        console.error('❌ Failed to update lead status, rolling back');
        setLeads(previousLeads);
        alert('Failed to update lead status. Please try again.');
      } else {
        console.log('✅ Lead status updated successfully');
      }
    } catch (error) {
      console.error('❌ Error updating lead status:', error);
      setLeads(previousLeads);
      alert('Failed to update lead status. Please try again.');
    }
  };

  const handleCreateLead = () => {
    console.log('Create new lead');
    // Here you would open create modal
  };

  // Show loading state
  if (loading) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading leads...</p>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

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
              <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                Total: {leads.length} leads
              </div>
              
              {/* Show role-based access info */}
              {user?.role === 'agent' && (
                <div className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                  Showing: Assigned leads only
                </div>
              )}
              {(user?.role === 'admin' || user?.role === 'supervisor') && (
                <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                  Showing: All leads
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