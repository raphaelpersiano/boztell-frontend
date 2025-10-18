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
      if (savedUser) {
        const userData = JSON.parse(savedUser);
        setUser(userData);
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
      console.log('🔐 Login response:', response);
      
      if (response.success && response.user) {
        const userData: User = {
          id: response.user.id,
          name: response.user.name,
          email: response.user.email,
          role: response.user.role as UserRole,
          isOnline: response.user.is_active ?? true,
          avatar: response.user.avatar_url || undefined
        };
        
        setUser(userData);
        
        // Save user data to localStorage
        localStorage.setItem('currentUser', JSON.stringify(userData));
        if (response.token) {
          localStorage.setItem('authToken', response.token);
        }
        if (response.refreshToken) {
          localStorage.setItem('refreshToken', response.refreshToken);
        }
        
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