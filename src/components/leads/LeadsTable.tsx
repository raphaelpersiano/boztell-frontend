'use client';

import React from 'react';
import { Search, Filter, Plus, MoreVertical, Phone, MessageSquare, Edit, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { LeadModal } from './LeadModal';
import { Lead } from '@/types';
import { formatCurrency, formatRelativeTime, getStatusColor } from '@/lib/utils';
import { ApiService } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface LeadsTableProps {
  onLeadClick?: (lead: Lead) => void;
  onAssignToAgent?: (leadId: string, agentId: string) => void;
}

export const LeadsTable: React.FC<LeadsTableProps> = ({
  onLeadClick,
  onAssignToAgent
}) => {
  const { user } = useAuth();
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [loading, setLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [selectedLead, setSelectedLead] = React.useState<Lead | null>(null);

  // Fetch leads based on user role
  const fetchLeads = React.useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      let result;
      
      if (user.role === 'agent') {
        // Agents only see their own leads
        result = await ApiService.getLeadsByUserId(user.id);
      } else {
        // Admin/Supervisor see all leads with optional filters
        const filters: Record<string, string> = {};
        if (statusFilter !== 'all') {
          filters.leads_status = statusFilter;
        }
        if (searchQuery.trim()) {
          filters.search = searchQuery.trim();
        }
        result = await ApiService.getAllLeads(filters);
      }
      
      if (result.success) {
        setLeads(result.data || []);
      } else {
        console.error('Failed to fetch leads:', result.message);
        setLeads([]);
      }
    } catch (error: unknown) {
      console.error('Error fetching leads:', error);
      if (error instanceof Error && error.message?.includes('401')) {
        // Token expired, redirect to login
        window.location.href = '/login';
      }
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [user, statusFilter, searchQuery]);

  // Initial load
  React.useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Filter leads locally for search (since API search might have delay)
  const filteredLeads = React.useMemo(() => {
    if (!searchQuery.trim()) return leads;
    
    return leads.filter(lead => {
      const name = lead.name?.toLowerCase() || '';
      const phone = lead.phone || '';
      const loanType = lead.loan_type?.toLowerCase() || '';
      const query = searchQuery.toLowerCase();
      
      return name.includes(query) || 
             phone.includes(query) || 
             loanType.includes(query);
    });
  }, [leads, searchQuery]);

  const handleCreateLead = () => {
    setSelectedLead(null);
    setIsModalOpen(true);
  };

  const handleEditLead = (lead: Lead) => {
    setSelectedLead(lead);
    setIsModalOpen(true);
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm('Are you sure you want to delete this lead? This action cannot be undone.')) {
      return;
    }

    try {
      const result = await ApiService.deleteLead(leadId);
      if (result.success) {
        setLeads(prev => prev.filter(l => l.id !== leadId));
      } else {
        alert('Failed to delete lead: ' + (result.message || 'Unknown error'));
      }
    } catch (error: unknown) {
      console.error('Delete lead error:', error);
      alert('Failed to delete lead: ' + (error instanceof Error ? error.message : 'Network error'));
    }
  };

  const handleSaveLead = (savedLead: Lead) => {
    if (selectedLead) {
      // Update existing lead
      setLeads(prev => prev.map(l => l.id === savedLead.id ? savedLead : l));
    } else {
      // Add new lead
      setLeads(prev => [savedLead, ...prev]);
    }
    fetchLeads(); // Refresh to get updated data
  };

  const handleLeadClick = (lead: Lead) => {
    if (onLeadClick) {
      onLeadClick(lead);
    } else {
      // Default behavior: edit lead
      handleEditLead(lead);
    }
  };

  const getStats = () => {
    const total = filteredLeads.length;
    const active = filteredLeads.filter(l => ['warm', 'hot'].includes(l.leads_status || '')).length;
    const converted = filteredLeads.filter(l => l.leads_status === 'paid').length;
    const revenue = filteredLeads
      .filter(l => l.leads_status === 'paid')
      .reduce((sum, l) => sum + (l.outstanding || 0), 0);
    
    return { total, active, converted, revenue };
  };

  const stats = getStats();

  if (loading && leads.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500">Loading leads...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads Management</h1>
          <p className="text-gray-600 mt-1">
            {user?.role === 'agent' 
              ? 'Your assigned leads' 
              : 'Manage all leads in the system'
            }
          </p>
        </div>
        <Button onClick={handleCreateLead}>
          <Plus className="h-4 w-4 mr-2" />
          New Lead
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by name, phone, or loan type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {user?.role !== 'agent' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            >
              <option value="all">All Status</option>
              <option value="cold">Cold</option>
              <option value="warm">Warm</option>
              <option value="hot">Hot</option>
              <option value="paid">Paid</option>
              <option value="service">Service</option>
              <option value="repayment">Repayment</option>
              <option value="advocate">Advocate</option>
            </select>
          )}
          
          <Button variant="outline" onClick={fetchLeads} disabled={loading}>
            <Filter className="h-4 w-4 mr-2" />
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-sm text-gray-500">Total Leads</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.active}</p>
            <p className="text-sm text-gray-500">Active Leads</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{stats.converted}</p>
            <p className="text-sm text-gray-500">Converted</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(stats.revenue)}
            </p>
            <p className="text-sm text-gray-500">Total Revenue</p>
          </div>
        </Card>
      </div>

      {/* Leads Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Loan Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Loan Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Updated
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div 
                      className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600"
                      onClick={() => handleLeadClick(lead)}
                    >
                      {lead.name || 'Unknown'}
                    </div>
                    {lead.utm_id && (
                      <div className="text-xs text-gray-500">UTM: {lead.utm_id}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-900">{lead.phone || '-'}</span>
                      {lead.phone && (
                        <>
                          <Button variant="ghost" size="sm">
                            <Phone className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <MessageSquare className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(lead.outstanding || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {lead.loan_type || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge className={getStatusColor(lead.leads_status || 'cold')}>
                      {lead.leads_status || 'cold'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge 
                      variant={lead.contact_status === 'contacted' ? 'success' : 'warning'} 
                      size="sm"
                    >
                      {lead.contact_status || 'uncontacted'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatRelativeTime(new Date(lead.updated_at))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleEditLead(lead)}
                        title="Edit Lead"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDeleteLead(lead.id)}
                        title="Delete Lead"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" title="More Actions">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredLeads.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {searchQuery.trim() ? 'No leads found matching your search.' : 'No leads available.'}
              </p>
              <Button variant="outline" onClick={handleCreateLead} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Create First Lead
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Lead Modal */}
      <LeadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveLead}
        lead={selectedLead}
      />
    </div>
  );
};