'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { PinInput } from '@/components/ui/PinInput';
import { Eye, EyeOff, MessageSquare } from 'lucide-react';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const { login, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.replace('/chat');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoggingIn(true);

    if (!identifier || !pin) {
      setError('Please fill in all fields');
      setIsLoggingIn(false);
      return;
    }

    if (pin.length !== 6) {
      setError('PIN must be exactly 6 digits');
      setIsLoggingIn(false);
      return;
    }

    try {
      const success = await login(identifier, pin);
      if (success) {
        router.replace('/chat'); // Use replace for smoother transition
      } else {
        setError('Invalid identifier or PIN. Please check your credentials.');
      }
    } catch (err: any) {
      console.error('Login error in component:', err);
      
      // Show specific error message based on error type
      if (err.message?.includes('Cannot connect to server')) {
        setError('Cannot connect to server. Please check if backend is running.');
      } else if (err.message?.includes('HTTP 401')) {
        setError('Invalid credentials. Please check your identifier and PIN.');
      } else if (err.message?.includes('HTTP 500')) {
        setError('Server error. Please try again later.');
      } else {
        setError(err.message || 'Login failed. Please try again.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-4000"></div>
      </div>
      
      <div className="max-w-md w-full space-y-8 relative z-10">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-2xl shadow-lg">
              <MessageSquare className="h-10 w-10 text-white" />
            </div>
          </div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Welcome to Boztell CRM
          </h2>
          <p className="mt-3 text-base text-gray-600 max-w-sm mx-auto">
            Sign in with your PIN to manage leads and conversations
          </p>
        </div>

        {/* Login Form */}
        <Card className="p-8 shadow-xl border-0 bg-white/95 backdrop-blur">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <Input
                label="Email or Phone Number"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Enter your email or phone number"
                className="w-full"
                disabled={isLoggingIn}
              />
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700 text-center">
                Enter Your 6-Digit PIN
              </label>
              <PinInput
                value={pin}
                onChange={setPin}
                length={6}
                disabled={isLoggingIn}
                autoFocus={true}
              />
              <div className="text-center">
                <p className="text-xs text-gray-500 mt-2">
                  Enter your 6-digit PIN to access your account
                </p>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm flex items-center space-x-2">
                <div className="w-4 h-4 bg-red-500 rounded-full flex-shrink-0"></div>
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all duration-200"
              disabled={isLoggingIn || pin.length !== 6}
            >
              {isLoggingIn ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Signing in...
                </div>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        </Card>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            © 2025 Boztell CRM. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}