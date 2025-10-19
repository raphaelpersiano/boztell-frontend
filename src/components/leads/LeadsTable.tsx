'use client';

import React from 'react';
import { Search, Filter, Plus, MoreVertical, Phone, MessageSquare, Edit, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Lead } from '@/types';
import { formatCurrency, formatRelativeTime, getStatusColor } from '@/lib/utils';

interface LeadsTableProps {
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  onEditLead: (lead: Lead) => void;
  onDeleteLead: (leadId: string) => void;
  onCreateLead: () => void;
  onAssignToAgent?: (leadId: string, agentId: string) => void;
}

export const LeadsTable: React.FC<LeadsTableProps> = ({
  leads,
  onLeadClick,
  onEditLead,
  onDeleteLead,
  onCreateLead,
  onAssignToAgent
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [mounted, setMounted] = React.useState(false);

  // Prevent hydration mismatch for time-based content
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const filteredLeads = leads.filter(lead => {
    const name = lead.name || '';
    const phone = lead.phone || '';
    const loanType = lead.loan_type || '';
    
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         phone.includes(searchQuery) ||
                         loanType.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || lead.leads_status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Leads Management</h1>
        <Button onClick={onCreateLead}>
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
              placeholder="Search by name, phone, or debt type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            More Filters
          </Button>
        </div>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{leads.length}</p>
            <p className="text-sm text-gray-500">Total Leads</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">
              {leads.filter(l => l.leads_status && ['warm', 'hot'].includes(l.leads_status)).length}
            </p>
            <p className="text-sm text-gray-500">Active Leads</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {leads.filter(l => l.leads_status === 'paid').length}
            </p>
            <p className="text-sm text-gray-500">Converted</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(
                leads
                  .filter(l => l.leads_status === 'paid')
                  .reduce((sum, l) => sum + (l.outstanding || 0), 0)
              )}
            </p>
            <p className="text-sm text-gray-500">Total Outstanding</p>
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
                  Debt Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned To
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
                    <div className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600"
                         onClick={() => onLeadClick(lead)}>
                      {lead.name || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-900">{lead.phone || 'N/A'}</span>
                      <Button variant="ghost" size="sm">
                        <Phone className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <MessageSquare className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(lead.outstanding || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {lead.loan_type || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge className={getStatusColor(lead.leads_status || 'cold')}>
                      {lead.leads_status || 'N/A'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {lead.contact_status ? (
                      <Badge variant="success" size="sm">
                        {lead.contact_status}
                      </Badge>
                    ) : (
                      <Badge variant="warning" size="sm">
                        Not Contacted
                      </Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {mounted ? formatRelativeTime(lead.updated_at) : new Date(lead.updated_at).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => onEditLead(lead)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => onDeleteLead(lead.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredLeads.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No leads found matching your criteria</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};