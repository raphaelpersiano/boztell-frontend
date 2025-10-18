import React from 'react';
import { Search, Filter, Plus, MoreHorizontal, GripVertical } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Lead, LeadStatus } from '@/types';
import { formatCurrency, formatRelativeTime, getStatusColor } from '@/lib/utils';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

// Draggable Lead Card Component
interface DraggableLeadCardProps {
  lead: Lead;
  status: LeadStatus;
  onLeadClick: (lead: Lead) => void;
  isDragging?: boolean;
}

const DraggableLeadCard: React.FC<DraggableLeadCardProps> = ({
  lead,
  status,
  onLeadClick,
  isDragging = false
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || isSortableDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card
        padding="sm"
        className={`cursor-pointer hover:shadow-md transition-shadow ${
          status === 'cold' ? 'py-2' : 'py-3'
        } ${isDragging || isSortableDragging ? 'shadow-lg ring-2 ring-blue-500' : ''}`}
        onClick={() => !isDragging && !isSortableDragging && onLeadClick(lead)}
      >
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2 flex-1">
              <div
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded"
              >
                <GripVertical className="h-3 w-3 text-gray-400" />
              </div>
              <h4 className="font-medium text-gray-900 text-sm truncate flex-1">
                {lead.namaLengkap}
              </h4>
            </div>
            {lead.assignedTo && (
              <Badge variant="info" size="sm">
                Assigned
              </Badge>
            )}
          </div>
          
          <p className="text-xs text-gray-600 ml-6">{lead.nomorTelpon}</p>
          
          {status !== 'cold' && (
            <>
              <div className="flex items-center justify-between ml-6">
                <span className="text-xs text-gray-500">Nominal:</span>
                <span className="text-xs font-medium text-gray-900">
                  {formatCurrency(lead.nominalPinjaman)}
                </span>
              </div>
              
              <div className="flex items-center justify-between ml-6">
                <span className="text-xs text-gray-500">Jenis:</span>
                <span className="text-xs text-gray-900 truncate">
                  {lead.jenisUtang}
                </span>
              </div>
            </>
          )}
          
          <div className="flex items-center justify-between pt-1 ml-6">
            <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(lead.status)}`}>
              {lead.status}
            </span>
            <span className="text-xs text-gray-500">
              {formatRelativeTime(lead.updatedAt)}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
};

// Droppable Column Component
interface KanbanColumnProps {
  title: string;
  status: LeadStatus;
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  searchQuery: string;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  title,
  status,
  leads,
  onLeadClick,
  searchQuery
}) => {
  const filteredLeads = leads.filter(lead => 
    lead.namaLengkap.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lead.nomorTelpon.includes(searchQuery)
  );

  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status}`,
  });

  return (
    <div className="bg-gray-100 rounded-lg p-4 h-[calc(100vh-200px)] w-80 flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <Badge variant="default" size="sm">
            {filteredLeads.length}
          </Badge>
        </div>
        <Button variant="ghost" size="sm">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>

      <SortableContext
        items={filteredLeads.map(lead => lead.id)}
        strategy={verticalListSortingStrategy}
      >
        <div 
          ref={setNodeRef}
          className={`space-y-3 overflow-y-auto flex-1 pr-2 min-h-32 rounded-lg transition-colors ${
            isOver ? 'bg-blue-50 border-2 border-dashed border-blue-300' : ''
          }`}
        >
          {filteredLeads.map((lead) => (
            <DraggableLeadCard
              key={lead.id}
              lead={lead}
              status={status}
              onLeadClick={onLeadClick}
            />
          ))}
          
          {filteredLeads.length === 0 && (
            <div className={`text-center py-8 text-gray-500 h-32 flex items-center justify-center rounded-lg transition-all ${
              isOver ? 'bg-blue-100 text-blue-600' : ''
            }`}>
              <p className="text-sm">
                {isOver ? 'Drop here to move lead' : 'No leads found'}
              </p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
};

interface KanbanBoardProps {
  leads: Lead[];
  columns: { title: string; status: LeadStatus }[];
  onLeadClick: (lead: Lead) => void;
  onStatusChange: (leadId: string, newStatus: LeadStatus) => void;
  onCreateLead?: () => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  leads,
  columns,
  onLeadClick,
  onStatusChange,
  onCreateLead
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeLead, setActiveLead] = React.useState<Lead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const lead = leads.find(l => l.id === active.id);
    setActiveLead(lead || null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the lead being dragged
    const activeLead = leads.find(lead => lead.id === activeId);
    if (!activeLead) return;

    // Check if we're hovering over a different column (either by column-id or old method)
    let overColumn = columns.find(col => overId === `column-${col.status}`);
    if (!overColumn) {
      overColumn = columns.find(col => overId.startsWith(col.status));
    }
    
    if (overColumn && overColumn.status !== activeLead.status) {
      // Update the lead's status immediately for smooth visual feedback
      onStatusChange(activeId, overColumn.status);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveLead(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the lead being dragged
    const activeLead = leads.find(lead => lead.id === activeId);
    if (!activeLead) return;

    // Determine the target status based on where it was dropped
    let targetStatus: LeadStatus = activeLead.status;

    // Check if dropped on a column (either by column-id or old method)
    let overColumn = columns.find(col => overId === `column-${col.status}`);
    if (!overColumn) {
      overColumn = columns.find(col => 
        overId.startsWith(col.status) || overId === col.status
      );
    }
    
    if (overColumn) {
      targetStatus = overColumn.status;
    } else {
      // If dropped on another lead, find that lead's column
      const overLead = leads.find(lead => lead.id === overId);
      if (overLead) {
        targetStatus = overLead.status;
      }
    }

    // Update the lead's status if it's different
    if (targetStatus !== activeLead.status) {
      onStatusChange(activeId, targetStatus);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="p-6 h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <h1 className="text-2xl font-bold text-gray-900">Lead Funnel</h1>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search leads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </div>
            {onCreateLead && (
              <Button onClick={onCreateLead} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Lead
              </Button>
            )}
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex space-x-6 overflow-x-auto pb-6 h-[calc(100%-100px)]">
          {columns.map((column) => {
            const columnLeads = leads.filter(lead => lead.status === column.status);
            
            return (
              <div key={column.status} id={column.status}>
                <KanbanColumn
                  title={column.title}
                  status={column.status}
                  leads={columnLeads}
                  onLeadClick={onLeadClick}
                  searchQuery={searchQuery}
                />
              </div>
            );
          })}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeLead ? (
            <DraggableLeadCard
              lead={activeLead}
              status={activeLead.status}
              onLeadClick={onLeadClick}
              isDragging={true}
            />
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
};