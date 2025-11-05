'use client';

import React, { useState, useEffect } from 'react';
import { X, Send, MessageSquare } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ApiService } from '@/lib/api';

interface Template {
  name: string;
  language: string;
  status: string;
  category: string;
  components?: any[];
}

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (roomId: string, phoneNumber?: string) => void;
  userId: string;
  prefilledPhone?: string; // Optional: Pre-fill phone number for existing rooms
  currentRoomId?: string; // Optional: Current room ID for updating existing room
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  userId,
  prefilledPhone,
  currentRoomId,
}) => {
  const [step, setStep] = useState<'phone' | 'template'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateParams, setTemplateParams] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Reset atau pre-fill phone number when modal opens
  useEffect(() => {
    if (isOpen) {
      if (prefilledPhone) {
        // Pre-fill phone for existing room (from ChatWindow)
        setPhoneNumber(prefilledPhone);
        setStep('template'); // Skip phone input, go directly to template selection
      } else {
        // Reset phone for new chat (from ChatSidebar)
        setPhoneNumber('');
        setStep('phone');
      }
      fetchTemplates();
    }
  }, [isOpen, prefilledPhone]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await ApiService.getTemplates();
      setTemplates(response.templates || []);
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      alert('Failed to load templates. Using default template.');
      // Fallback to empty array
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSubmit = () => {
    // Validate phone number
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    
    if (!cleanPhone) {
      alert('Please enter a valid phone number');
      return;
    }

    // Format phone number (ensure it has country code)
    let formattedPhone = cleanPhone;
    if (!formattedPhone.startsWith('62')) {
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '62' + formattedPhone.slice(1);
      } else {
        formattedPhone = '62' + formattedPhone;
      }
    }

    setPhoneNumber(formattedPhone);
    setStep('template');
  };

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    
    // Extract parameters from template components
    const params: Record<string, string> = {};
    template.components?.forEach((component: any) => {
      if (component.type === 'BODY' && component.example?.body_text) {
        const matches = component.text.match(/\{\{(\d+)\}\}/g);
        if (matches) {
          matches.forEach((match: string, index: number) => {
            const paramNumber = index + 1;
            params[`param${paramNumber}`] = '';
          });
        }
      }
    });
    
    setTemplateParams(params);
  };

  const handleSendTemplate = async () => {
    if (!selectedTemplate) {
      alert('Please select a template');
      return;
    }

    // Validate required fields
    if (!phoneNumber || !phoneNumber.trim()) {
      alert('Phone number is required');
      return;
    }

    if (!userId) {
      alert('User ID is missing. Please try logging in again.');
      return;
    }

    // Validate parameters
    const paramValues = Object.values(templateParams);
    const hasEmptyParams = paramValues.some(val => !val.trim());
    
    if (paramValues.length > 0 && hasEmptyParams) {
      alert('Please fill in all template parameters');
      return;
    }

    setSending(true);

    // Build request data - user_id is required, room_id is optional
    const requestData: any = {
      to: phoneNumber.trim(),
      templateName: selectedTemplate.name,
      languageCode: selectedTemplate.language || 'en',
      user_id: userId, // REQUIRED: agent/admin who sends the template
    };

    // Add parameters only if present
    if (paramValues.length > 0) {
      requestData.parameters = paramValues;
    }

    // Add room_id only if exists (for existing customers)
    // For new customers, don't include room_id at all (backend will create new room)
    if (currentRoomId) {
      requestData.room_id = currentRoomId;
    }

    try {

      console.log('📤 Sending template message...', {
        to: requestData.to,
        templateName: requestData.templateName,
        languageCode: requestData.languageCode,
        paramCount: paramValues.length,
        hasRoomId: !!currentRoomId,
        isNewCustomer: !currentRoomId,
        userId: userId,
        fullRequestData: requestData
      });
      
      // Send template message via API
      const response = await ApiService.sendTemplate(requestData);

      console.log('✅ Template sent successfully:', response);
      
      // Extract room_id from response
      // Backend returns: { success, database_saved: { room_id, message_id, whatsapp_message_id } }
      const roomId = response.database_saved?.room_id || currentRoomId;
      
      // Pass both room_id AND phone number to parent
      // This allows parent to find room by phone if room_id fails
      console.log('🎯 Passing to parent:', { roomId, phoneNumber });
      onSuccess(roomId || '', phoneNumber);
      
      // Note: 
      // - For NEW room: Room will be added via 'new_room_complete' socket event
      // - For EXISTING room: Room will be updated via 'new_message' socket event
      // - Both events trigger automatic UI update in useRealtimeRooms hook
      // - The parent component also calls refetchRooms() for additional sync
    } catch (error: any) {
      console.error('❌ Error sending template:', {
        error,
        errorMessage: error.message,
        errorStack: error.stack,
        userId: userId,
        requestData
      });
      
      if (error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('connect')) {
        alert('Cannot send template: Backend API is not running. Please start the Express.js backend server at localhost:8080');
      } else {
        alert(`Failed to send template: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setSending(false);
    }
  };

  const handleBack = () => {
    if (step === 'template') {
      setStep('phone');
      setSelectedTemplate(null);
      setTemplateParams({});
    }
  };

  const handleReset = () => {
    setStep('phone');
    setPhoneNumber('');
    setSelectedTemplate(null);
    setTemplateParams({});
    setTemplates([]);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              {step === 'phone' ? 'New Chat - Enter Phone Number' : 'Select Template Message'}
            </h2>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'phone' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number *
                </label>
                <Input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="628123456789 or 08123456789"
                  className="text-lg"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handlePhoneSubmit();
                    }
                  }}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Enter phone number with country code (e.g., 628123456789) or local format (08123456789)
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">How it works:</h3>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Enter the customer's phone number</li>
                  <li>Select a WhatsApp template message</li>
                  <li>Fill in template parameters (if any)</li>
                  <li>Send template to initiate conversation</li>
                  <li>New chat room will be created automatically</li>
                </ol>
              </div>
            </div>
          )}

          {step === 'template' && (
            <div className="space-y-4">
              {/* Phone Number Display */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Sending to:</p>
                  <p className="text-sm font-semibold text-gray-900">+{phoneNumber}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleBack}>
                  Change
                </Button>
              </div>

              {/* Template Selection */}
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-gray-500">Loading templates...</p>
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-2">No templates available</p>
                  <p className="text-sm text-gray-400">Please create templates in WhatsApp Business Manager</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Template *
                    </label>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {templates.map((template) => (
                        <div
                          key={template.name}
                          onClick={() => handleTemplateSelect(template)}
                          className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                            selectedTemplate?.name === template.name
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900">{template.name}</h4>
                              <p className="text-xs text-gray-500 mt-1">
                                {template.language?.toUpperCase()} • {template.category}
                              </p>
                              {template.components?.find((c: any) => c.type === 'BODY')?.text && (
                                <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                                  {template.components.find((c: any) => c.type === 'BODY')?.text}
                                </p>
                              )}
                            </div>
                            <div
                              className={`ml-3 h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                                selectedTemplate?.name === template.name
                                  ? 'border-blue-500 bg-blue-500'
                                  : 'border-gray-300'
                              }`}
                            >
                              {selectedTemplate?.name === template.name && (
                                <div className="h-2 w-2 bg-white rounded-full" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Template Parameters */}
                  {selectedTemplate && Object.keys(templateParams).length > 0 && (
                    <div className="border-t border-gray-200 pt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Template Parameters
                      </label>
                      <div className="space-y-3">
                        {Object.keys(templateParams).map((key, index) => (
                          <div key={key}>
                            <label className="block text-xs text-gray-600 mb-1">
                              Parameter {index + 1}
                            </label>
                            <Input
                              type="text"
                              value={templateParams[key]}
                              onChange={(e) =>
                                setTemplateParams({
                                  ...templateParams,
                                  [key]: e.target.value,
                                })
                              }
                              placeholder={`Enter value for {{${index + 1}}}`}
                            />
                          </div>
                        ))}
                      </div>
                      
                      {/* Preview */}
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs font-medium text-gray-700 mb-2">Preview:</p>
                        <p className="text-sm text-gray-900 whitespace-pre-wrap">
                          {selectedTemplate.components
                            ?.find((c: any) => c.type === 'BODY')
                            ?.text.replace(/\{\{(\d+)\}\}/g, (match: string, num: string) => {
                              return templateParams[`param${num}`] || match;
                            })}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex items-center justify-between">
          {step === 'phone' ? (
            <>
              <Button variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handlePhoneSubmit}
                disabled={!phoneNumber.trim()}
              >
                Next: Select Template
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={prefilledPhone ? handleClose : handleBack}>
                {prefilledPhone ? 'Cancel' : 'Back'}
              </Button>
              <Button
                variant="primary"
                onClick={handleSendTemplate}
                disabled={!selectedTemplate || sending}
              >
                {sending ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Template
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
