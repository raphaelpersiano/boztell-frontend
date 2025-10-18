import React from 'react';
import { 
  Send, 
  Smile, 
  Paperclip, 
  Mic,
  MoreVertical,
  Phone,
  Video,
  Search,
  Users,
  MapPin,
  File,
  Image,
  Play,
  Download
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { formatRelativeTime } from '@/lib/utils';
import { Message, MessageType } from '@/types';

interface ChatWindowProps {
  customerName: string;
  customerPhone: string;
  customerStatus: string;
  messages: Message[];
  onSendMessage: (content: string, type?: MessageType) => void;
  onAssignAgent?: (agentId: string) => void;
  isAssigned: boolean;
  assignedAgent?: string;
  userRole: 'admin' | 'supervisor' | 'agent';
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  customerName,
  customerPhone,
  customerStatus,
  messages,
  onSendMessage,
  onAssignAgent,
  isAssigned,
  assignedAgent,
  userRole
}) => {
  const [message, setMessage] = React.useState('');
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const renderMessageContent = (msg: Message) => {
    switch (msg.type) {
      case 'text':
        return <p className="whitespace-pre-wrap">{msg.content}</p>;
      
      case 'image':
        return (
          <div className="relative max-w-xs">
            <div className="bg-gray-200 rounded-lg p-4 flex items-center justify-center h-48">
              <Image className="h-12 w-12 text-gray-400" />
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="absolute top-2 right-2 bg-black bg-opacity-50 text-white hover:bg-opacity-70"
            >
              <Download className="h-4 w-4" />
            </Button>
            {msg.content && <p className="mt-2 text-sm">{msg.content}</p>}
          </div>
        );
      
      case 'video':
        return (
          <div className="relative max-w-xs">
            <div className="bg-gray-200 rounded-lg p-4 flex items-center justify-center h-48">
              <Play className="h-12 w-12 text-gray-400" />
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="absolute top-2 right-2 bg-black bg-opacity-50 text-white hover:bg-opacity-70"
            >
              <Download className="h-4 w-4" />
            </Button>
            {msg.content && <p className="mt-2 text-sm">{msg.content}</p>}
          </div>
        );
      
      case 'document':
        return (
          <div className="flex items-center space-x-3 p-3 bg-gray-100 rounded-lg max-w-xs">
            <File className="h-8 w-8 text-gray-500" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {msg.metadata?.fileName || 'Document'}
              </p>
              {msg.metadata?.fileSize && (
                <p className="text-xs text-gray-500">
                  {(msg.metadata.fileSize / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
            </div>
            <Button variant="ghost" size="sm">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        );
      
      case 'location':
        return (
          <div className="max-w-xs">
            <div className="bg-gray-200 rounded-lg p-4 flex items-center justify-center h-32">
              <MapPin className="h-8 w-8 text-gray-400" />
            </div>
            {msg.metadata?.location?.address && (
              <p className="mt-2 text-sm text-gray-600">{msg.metadata.location.address}</p>
            )}
          </div>
        );
      
      case 'contact':
        return (
          <div className="flex items-center space-x-3 p-3 bg-gray-100 rounded-lg max-w-xs">
            <Users className="h-8 w-8 text-gray-500" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                {msg.metadata?.contact?.name || 'Contact'}
              </p>
              <p className="text-sm text-gray-600">
                {msg.metadata?.contact?.phone}
              </p>
            </div>
          </div>
        );
      
      default:
        return <p>{msg.content}</p>;
    }
  };

  if (!customerName) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Users className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Welcome to Boztell CRM</h3>
          <p className="text-gray-500">Select a chat to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Chat Header */}
      <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
            <Users className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{customerName}</h3>
            <div className="flex items-center space-x-2">
              <p className="text-sm text-gray-500">{customerPhone}</p>
              <Badge variant="default" size="sm">{customerStatus}</Badge>
              {isAssigned && assignedAgent && (
                <Badge variant="success" size="sm">
                  Assigned to {assignedAgent}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm">
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Video className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.isFromCustomer ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                msg.isFromCustomer
                  ? 'bg-white border border-gray-200'
                  : 'bg-blue-500 text-white'
              }`}
            >
              {renderMessageContent(msg)}
              <div className={`flex items-center justify-between mt-1 text-xs ${
                msg.isFromCustomer ? 'text-gray-500' : 'text-blue-100'
              }`}>
                <span>{formatRelativeTime(msg.timestamp)}</span>
                {!msg.isFromCustomer && (
                  <span>
                    {msg.status === 'sent' && '✓'}
                    {msg.status === 'delivered' && '✓✓'}
                    {msg.status === 'read' && '✓✓'}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="flex items-end space-x-2">
          <Button variant="ghost" size="sm">
            <Smile className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="sm">
            <Paperclip className="h-5 w-5" />
          </Button>
          
          <div className="flex-1">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={1}
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
          </div>

          {message.trim() ? (
            <Button onClick={handleSendMessage} size="sm">
              <Send className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="ghost" size="sm">
              <Mic className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};