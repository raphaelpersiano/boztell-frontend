'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '@/types';
import { ApiService } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  login: (identifier: string, pin: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);



export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in (from localStorage)
    try {
      const savedUser = localStorage.getItem('currentUser');
      const savedToken = localStorage.getItem('authToken');
      
      console.log('🔍 AuthContext initialization check:', {
        hasSavedUser: !!savedUser,
        hasSavedToken: !!savedToken,
        tokenLength: savedToken?.length || 0,
        allKeys: Object.keys(localStorage)
      });
      
      if (savedUser) {
        const userData = JSON.parse(savedUser);
        console.log('🔍 Loaded user data from localStorage:', userData);
        console.log('🔍 Loaded user ID:', userData.id);
        console.log('🔍 Loaded user ID type:', typeof userData.id);
        setUser(userData);
        
        if (!savedToken) {
          console.warn('⚠️ User data found but no auth token! This might cause API failures.');
        }
      }
    } catch (error) {
      console.error('Error parsing saved user data:', error);
      localStorage.removeItem('currentUser');
    }
    setIsLoading(false);
  }, []);

  const login = async (identifier: string, pin: string): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      console.log('🔐 Attempting login with:', { identifier, pin });
      const response = await ApiService.login(identifier, pin);
      console.log('🔐 Full login response (RAW):', JSON.stringify(response, null, 2));
      console.log('🔐 Response type:', typeof response);
      console.log('🔐 Response keys:', Object.keys(response || {}));
      console.log('🔐 Response.success:', response?.success);
      console.log('🔐 Response.user:', response?.user);
      
      if (response && response.success && response.user) {
        console.log('🔐 Raw user data from response:', response.user);
        console.log('🔐 User ID from response:', response.user.id);
        console.log('🔐 User ID type:', typeof response.user.id);
        
        const userData: User = {
          id: response.user.id,
          name: response.user.name,
          email: response.user.email,
          role: response.user.role as UserRole,
          isOnline: response.user.is_active ?? true,
          avatar: response.user.avatar_url || undefined
        };
        
        console.log('🔐 Constructed userData object:', userData);
        console.log('🔐 userData.id:', userData.id);
        
        setUser(userData);
        
        // Save user data to localStorage
        localStorage.setItem('currentUser', JSON.stringify(userData));
        console.log('🔐 Saved to localStorage:', JSON.stringify(userData));
        
        // ✅ IMPORTANT: Give backend time to sync user data across microservices
        // This prevents "Get user by ID failed" error when fetching rooms immediately
        console.log('⏳ Waiting 500ms for backend to sync user data...');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('🔍 Token analysis:', {
          hasTokenInResponse: !!response.token,
          tokenType: typeof response.token,
          tokenValue: response.token,
          tokenLength: response.token?.length || 0,
          allResponseKeys: Object.keys(response)
        });
        
        // Try different possible token field names
        const responseAny = response as any;
        const possibleToken = response.token || responseAny.authToken || responseAny.access_token || responseAny.accessToken || responseAny.jwt;
        
        if (possibleToken) {
          localStorage.setItem('authToken', possibleToken);
          console.log('🔐 Auth token saved to localStorage:', {
            tokenSource: response.token ? 'token' : 'alternative field',
            tokenLength: possibleToken.length,
            tokenPreview: possibleToken.substring(0, 20) + '...'
          });
        } else {
          console.warn('⚠️ NO TOKEN FOUND in login response!', {
            responseKeys: Object.keys(response || {}),
            fullResponse: response
          });
          
          // TEMPORARY FIX: Generate a session token based on user data
          // This is a temporary solution until backend provides proper JWT token
          const temporaryToken = `session-${userData.id}-${Date.now()}`;
          localStorage.setItem('authToken', temporaryToken);
          console.log('🔧 Generated temporary session token:', {
            token: temporaryToken,
            reason: 'Backend did not provide token, using temporary session ID'
          });
          
          // Optionally store user credentials for API calls that need authentication
          localStorage.setItem('userCredentials', JSON.stringify({ identifier, pin }));
          console.log('� Stored user credentials for API authentication');
        }
        if (response.refreshToken) {
          localStorage.setItem('refreshToken', response.refreshToken);
        }
        
        // Verify localStorage state immediately after save
        const savedToken = localStorage.getItem('authToken');
        const savedUser = localStorage.getItem('currentUser');
        console.log('🔍 Immediate verification after save:', {
          tokenExists: !!savedToken,
          tokenLength: savedToken?.length || 0,
          userExists: !!savedUser,
          allKeys: Object.keys(localStorage)
        });
        
        console.log('✅ Login successful, user data saved');
        setIsLoading(false);
        return true;
      } else {
        console.warn('⚠️ Login response indicates failure:', response);
        setIsLoading(false);
        return false;
      }
    } catch (error) {
      console.error('💥 Login API error:', error);
      setIsLoading(false);
      
      // Re-throw error so login page can show specific error message
      throw error;
    }
  };

  const logout = () => {
    // Clear all auth data (frontend only)
    setUser(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userCredentials'); // Clear temporary credentials
    
    console.log('🚪 User logged out, session cleared');
  };

  const value = {
    user,
    login,
    logout,
    isLoading,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}