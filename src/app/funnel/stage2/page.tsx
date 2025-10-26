'use client';

import React from 'react';
import { Layout } from '@/components/Layout';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Lead, LeadStatus } from '@/types';
import { STAGE_2_STATUSES } from '@/lib/constants';
import { useAuth } from '@/context/AuthContext';
import { ApiService } from '@/lib/api';
import { Filter, Loader2 } from 'lucide-react';

// Mock data for stage 2 (Empty for now - needs real data from backend)
const mockLeads: Lead[] = [];

const stage2Columns = [
  { title: 'Service', status: 'service' as LeadStatus },
  { title: 'Repayment', status: 'repayment' as LeadStatus },
  { title: 'Advocate', status: 'advocate' as LeadStatus }
];

export default function FunnelStage2Page() {
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
        // Filter only stage 2 leads (service, repayment, advocate)
        const stage2Leads = (result.data || []).filter((lead: Lead) =>
          (STAGE_2_STATUSES as readonly string[]).includes(lead.leads_status || '')
        );
        setLeads(stage2Leads);
        console.log('✅ Stage 2 leads loaded:', stage2Leads.length);
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

  // Show loading state
  if (loading) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-green-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading customers...</p>
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
              <h1 className="text-2xl font-bold text-gray-900">Funnel Stage 2</h1>
              <p className="text-gray-600">Manage post-payment customer journey</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                Total: {leads.length} customers
              </div>
              
              {/* Show role-based access info */}
              {user?.role === 'agent' && (
                <div className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                  Showing: Assigned customers only
                </div>
              )}
              {(user?.role === 'admin' || user?.role === 'supervisor') && (
                <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                  Showing: All customers
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