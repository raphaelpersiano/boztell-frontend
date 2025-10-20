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
    
    const config: RequestInit = {
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
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
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
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
    return this.request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, pin }),
    });
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
   * Update room information (title, etc.)
   */
  static async updateRoom(roomId: string, data: {
    title?: string;
    leads_id?: string;
  }): Promise<any> {
    return this.request(`/api/rooms/${roomId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
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
  static async searchLeadsByPhone(phone: string): Promise<any> {
    return this.request(`/api/leads/search?phone=${encodeURIComponent(phone)}`, {
      method: 'GET',
    });
  }
}