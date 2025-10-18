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
}