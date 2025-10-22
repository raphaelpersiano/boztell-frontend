// API Configuration
export const API_BASE_URL = 'http://localhost:8080';

// API Types
export interface LoginRequest {
  identifier: string;
  pin: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role: string;
    avatar_url?: string | null;
    is_active?: boolean;
    created_at?: string;
    updated_at?: string;
  };
  token?: string;
  refreshToken?: string;
}

// API Service
export class ApiService {
  private static baseUrl = API_BASE_URL;

  private static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Only add Content-Type for requests with body (POST, PUT, PATCH)
    const headers: Record<string, string> = { ...options.headers as Record<string, string> };
    if (options.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    
    const config: RequestInit = {
      mode: 'cors',
      credentials: 'omit',
      headers,
      ...options,
    };

    console.log('🚀 API Request Details:');
    console.log('URL:', url);
    console.log('Method:', config.method);
    console.log('Headers:', config.headers);
    console.log('Body:', options.body);

    try {
      const response = await fetch(url, config);
      console.log('📡 Response Status:', response.status, response.statusText);
      console.log('📡 Response Headers:', Object.fromEntries(response.headers.entries()));
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ Non-JSON Response:', text);
        throw new Error(`Expected JSON response, got ${contentType}. Response: ${text}`);
      }

      const data = await response.json();
      console.log('📊 Response Data:', data);

      if (!response.ok) {
        console.error('❌ API Error Response:', data);
        console.error('❌ Response Status:', response.status);
        console.error('❌ Response StatusText:', response.statusText);
        console.error('❌ Full Response Data:', JSON.stringify(data, null, 2));
        console.error('❌ Request Details:', { url, method: config.method, headers: config.headers, body: config.body });
        throw new Error(data.error || data.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('✅ API Request Success');
      return data;
    } catch (error) {
      console.error('💥 API Request Error:', error);
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('🌐 Network Error - Check if backend is running on localhost:8080');
        throw new Error('Cannot connect to server. Please check if backend is running on localhost:8080');
      }
      
      throw error;
    }
  }

  // Authentication API
  static async login(identifier: string, pin: string): Promise<LoginResponse> {
    try {
      console.log('🔐 Login API call:', { identifier, endpoint: '/auth/login' });
      const response = await this.request<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, pin }),
      });
      
      console.log('🔐 Login API response:', {
        success: response.success,
        hasUser: !!response.user,
        hasToken: !!response.token,
        tokenLength: response.token?.length || 0,
        userRole: response.user?.role
      });
      
      return response;
    } catch (error) {
      console.error('💥 Login API error:', error);
      throw error;
    }
  }

  // Add more API methods here as needed
  static async logout(): Promise<void> {
    // Could be used for server-side logout if needed
    return this.request<void>('/api/auth/logout', {
      method: 'POST',
    });
  }

  // Health check endpoint
  static async healthCheck(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        mode: 'cors',
      });
      return { status: response.status, ok: response.ok };
    } catch (error) {
      console.error('Health check failed:', error);
      return { status: 0, ok: false, error };
    }
  }

  // ==================== CHAT & MESSAGING API ====================
  // Based on: MESSAGES_API_DOCUMENTATION.md

  /**
   * Send a text message
   * Endpoint: POST /messages/send
   */
  static async sendMessage(data: {
    to: string;              // Phone number (e.g., "6287879565390")
    text: string;            // Message text
    type?: 'text';           // Always 'text'
    user_id?: string;        // UUID of agent sending (null = from customer)
    replyTo?: string;        // Optional: WhatsApp message ID to reply to
  }): Promise<any> {
    return this.request('/messages/send', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        type: 'text', // Ensure type is always set
      }),
    });
  }

  /**
   * Send template message
   * Endpoint: POST /messages/send-template
   */
  static async sendTemplate(data: {
    to: string;              // Phone number
    templateName: string;    // Template name (e.g., "hello_world")
    languageCode: string;    // Language code (e.g., "en_US")
    parameters?: string[];   // Optional: Template parameters
    user_id?: string;        // UUID of agent sending
  }): Promise<any> {
    // Generate a client-side id to correlate optimistic bubbles
    const clientId = `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Notify UI that a template send is initiated (for optimistic UI)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('boztell:outgoing-template', {
          detail: { clientId, ...data },
        })
      );
    }

    try {
      const res = await this.request('/messages/send-template', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      // Confirm optimistic UI immediately on success
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('boztell:outgoing-template:confirmed', {
            detail: { clientId, to: data.to },
          })
        );
      }

      return res;
    } catch (error) {
      // Notify failure so UI can rollback optimistic bubble
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('boztell:outgoing-template:failed', {
            detail: { clientId, to: data.to, error: (error as Error)?.message },
          })
        );
      }
      throw error;
    }
  }

  /**
   * Send contacts
   * Endpoint: POST /messages/send-contacts
   */
  static async sendContacts(data: {
    to: string;
    contacts: Array<{
      name: { first_name: string; last_name?: string };
      phones?: Array<{ phone: string; type?: string }>;
      emails?: Array<{ email: string; type?: string }>;
    }>;
    user_id?: string;
    replyTo?: string;
  }): Promise<any> {
    return this.request('/messages/send-contacts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Send location
   * Endpoint: POST /messages/send-location
   */
  static async sendLocation(data: {
    to: string;
    location: {
      latitude: number;
      longitude: number;
      name?: string;
      address?: string;
    };
    user_id?: string;
    replyTo?: string;
  }): Promise<any> {
    return this.request('/messages/send-location', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Send reaction emoji to a message
   * Endpoint: POST /messages/send-reaction
   */
  static async sendReaction(data: {
    to: string;              // Phone number
    message_id: string;      // WhatsApp message ID to react to
    emoji: string;           // Emoji (e.g., "👍")
    user_id?: string;        // UUID of agent sending
  }): Promise<any> {
    return this.request('/messages/send-reaction', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Upload and send media (combined: upload + send in one request)
   * Endpoint: POST /messages/send-media-combined
   * 
   * Supported media types:
   * - Image: image/jpeg, image/png, image/webp
   * - Video: video/mp4, video/3gpp
   * - Audio: audio/aac, audio/mp4, audio/mpeg, audio/amr, audio/ogg
   * - Document: application/pdf, application/msword, etc.
   */
  static async sendMediaCombined(data: {
    media: File;             // File object to upload
    to: string;              // Phone number
    caption?: string;        // Optional caption
    user_id?: string;        // UUID of agent sending
  }): Promise<any> {
    const formData = new FormData();
    formData.append('media', data.media);
    formData.append('to', data.to);
    if (data.caption) formData.append('caption', data.caption);
    if (data.user_id) formData.append('user_id', data.user_id);

    return fetch(`${this.baseUrl}/messages/send-media-combined`, {
      method: 'POST',
      body: formData,
      // Don't set Content-Type, let browser set it with boundary
    }).then(res => res.json());
  }

  /**
   * Get available message templates
   * Endpoint: GET /messages/templates
   */
  static async getTemplates(): Promise<any> {
    return this.request('/messages/templates', {
      method: 'GET',
    });
  }

  /**
   * Verify message in database
   * Endpoint: GET /messages/verify/{messageId}
   */
  static async verifyMessage(messageId: string): Promise<any> {
    return this.request(`/messages/verify/${messageId}`, {
      method: 'GET',
    });
  }

  /**
   * Mark all messages in a room as read (NOT IN BACKEND DOCS)
   * This is a frontend-only helper that may need backend implementation
   */
  static async markRoomAsRead(roomId: string): Promise<any> {
    console.warn('markRoomAsRead: This endpoint is not documented in backend API');
    // For now, just resolve without error to avoid blocking UI
    return Promise.resolve({ success: true, message: 'Not implemented in backend' });
  }

  // ==================== ROOM API ====================

  /**
   * Update room data (title, leads_id, etc.)
   */
  static async updateRoom(roomId: string, data: {
    title?: string;
    leads_id?: string;
  }): Promise<any> {
    try {
      console.log('🔄 Updating room:', roomId, data);
      const response = await this.request(`/rooms/${roomId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      console.log('✅ Room updated successfully:', response);
      return { success: true, data: response };
    } catch (error) {
      console.error('❌ Update room error:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to update room'
      };
    }
  }

  /**
   * Create a new room
   */
  static async createRoom(data: {
    phone: string;
    title?: string;
    leads_id?: string;
  }): Promise<any> {
    return this.request('/api/rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Assign agent to room
   */
  static async assignAgentToRoom(roomId: string, userId: string): Promise<any> {
    return this.request(`/api/rooms/${roomId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  }

  /**
   * Remove agent from room
   */
  static async removeAgentFromRoom(roomId: string, userId: string): Promise<any> {
    return this.request(`/api/rooms/${roomId}/unassign`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  }

  // ==================== LEADS API ====================

  /**
   * Create a new lead
   */
  static async createLead(data: {
    name: string;
    phone: string;
    outstanding?: number;
    loan_type?: string;
    leads_status?: string;
    contact_status?: string;
    utm_id?: string;
  }): Promise<any> {
    return this.request('/api/leads', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update existing lead
   */
  static async updateLead(leadId: string, data: {
    name?: string;
    phone?: string;
    outstanding?: number;
    loan_type?: string;
    leads_status?: string;
    contact_status?: string;
  }): Promise<any> {
    return this.request(`/api/leads/${leadId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get lead by ID
   */
  static async getLead(leadId: string): Promise<any> {
    return this.request(`/api/leads/${leadId}`, {
      method: 'GET',
    });
  }

  /**
   * Search leads by phone number
   */
  /**
   * Get leads by phone number (NEW ENDPOINT)
   */
  static async getLeadsByPhone(phone: string): Promise<any> {
    // Clean phone number (remove non-digits as per API spec)
    const cleanPhone = phone.replace(/\D/g, '');
    return this.request(`/leads/phone/${cleanPhone}`, {
      method: 'GET',
    });
  }

  // ==================== LEADS API (NEW ENDPOINTS) ====================

  /**
   * Get all leads with filtering (role-based access)
   * Admin/Supervisor: See all leads
   * Agent: Should use getLeadsByUser instead
   */
  static async getAllLeads(filters: {
    leads_status?: string;
    contact_status?: string;
    loan_type?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<any> {
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });

    return this.request(`/leads?${queryParams}`, {
      method: 'GET',
    });
  }

  /**
   * Get leads by user ID (for agents)
   * Note: This endpoint does NOT require authentication
   */
  static async getLeadsByUserId(userId: string): Promise<any> {
    return this.request(`/leads/user/${userId}`, {
      method: 'GET',
    });
  }

  /**
   * Create a new lead (updated endpoint)
   */
  static async createNewLead(data: {
    name: string;
    phone: string;
    outstanding?: number;
    loan_type: string;
    leads_status?: string;
    contact_status?: string;
    utm_id?: string;
  }): Promise<any> {
    try {
      console.log('🔄 Creating new lead:', data);
      const response = await this.request('/leads', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      console.log('✅ Lead created successfully:', response);
      return { success: true, data: response };
    } catch (error) {
      console.error('❌ Create lead error:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to create lead'
      };
    }
  }

  /**
   * Update existing lead (updated endpoint)
   */
  static async updateExistingLead(leadId: string, data: {
    name?: string;
    phone?: string;
    outstanding?: number;
    loan_type?: string;
    leads_status?: string;
    contact_status?: string;
    utm_id?: string;
  }): Promise<any> {
    try {
      console.log('🔄 Updating lead:', leadId, data);
      const response = await this.request(`/leads/${leadId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      console.log('✅ Lead updated successfully:', response);
      return { success: true, data: response };
    } catch (error) {
      console.error('❌ Update lead error:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to update lead'
      };
    }
  }

  /**
   * Update lead status only
   */
  static async updateLeadStatusOnly(leadId: string, status: string): Promise<any> {
    return this.request(`/leads/${leadId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ leads_status: status }),
    });
  }

  /**
   * Update lead contact status only
   */
  static async updateLeadContactStatus(leadId: string, status: string): Promise<any> {
    return this.request(`/leads/${leadId}/contact-status`, {
      method: 'PATCH',
      body: JSON.stringify({ contact_status: status }),
    });
  }

  /**
   * Delete lead
   */
  static async deleteLead(leadId: string): Promise<any> {
    return this.request(`/leads/${leadId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get leads statistics
   */
  static async getLeadsStats(): Promise<any> {
    return this.request('/leads/stats/overview', {
      method: 'GET',
    });
  }

  // ==================== ROOMS ASSIGNMENT API ====================

  /**
   * Get all rooms (role-based access)
   * Note: This endpoint does NOT require authentication
   */
  static async getAllRooms(): Promise<any> {
    return this.request('/rooms', {
      method: 'GET',
    });
  }

  /**
   * Get specific room by ID
   * Note: This endpoint does NOT require authentication
   */
  static async getRoomById(roomId: string): Promise<any> {
    return this.request(`/rooms/${roomId}`, {
      method: 'GET',
    });
  }

  // ==================== ROOM ASSIGNMENT ====================

  /**
   * Assign user to room (Admin/Supervisor only)
   * Note: This endpoint does NOT require authentication
   */
  static async assignUserToRoom(roomId: string, userId: string): Promise<any> {
    console.log('🔄 Assigning user to room:', { roomId, userId });
    console.log('🔄 Request body:', JSON.stringify({ user_id: userId }));
    try {
      const response = await this.request(`/rooms/${roomId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      });
      console.log('✅ Assign response:', response);
      return response;
    } catch (error) {
      console.error('❌ Assign error:', error);
      throw error;
    }
  }

  /**
   * Unassign user from room (Admin/Supervisor only)
   * Note: This endpoint does NOT require authentication
   */
  static async unassignUserFromRoom(roomId: string, userId: string): Promise<any> {
    console.log('🔄 Unassigning user from room:', { roomId, userId });
    return this.request(`/rooms/${roomId}/assign/${userId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get room participants
   * Note: This endpoint does NOT require authentication
   */
  static async getRoomParticipants(roomId: string): Promise<any> {
    return this.request(`/rooms/${roomId}/participants`, {
      method: 'GET',
    });
  }

  // ==================== USER MANAGEMENT ====================

  /**
   * Get all users (for admin/supervisor)
   * Note: This endpoint does NOT require authentication
   */
  static async getUsers(): Promise<any> {
    return this.request('/users', {
      method: 'GET',
    });
  }

  // ==================== AUTH HELPERS ====================

  /**
   * Get auth token from localStorage
   */
  private static getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('authToken');
      console.log('🔍 Getting auth token:', { 
        hasToken: !!token, 
        tokenLength: token?.length || 0,
        tokenPreview: token ? token.substring(0, 20) + '...' : 'null',
        timestamp: new Date().toISOString()
      });
      
      // If no token but we have a user, this is the problem
      const savedUser = localStorage.getItem('currentUser');
      if (!token && savedUser) {
        console.error('🚨 CRITICAL: User exists but no auth token!', {
          userExists: !!savedUser,
          tokenExists: !!token,
          suggestion: 'This means login succeeded but token was not saved or was cleared'
        });
      }
      
      return token;
    }
    return null;
  }
}