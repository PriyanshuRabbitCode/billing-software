"use client";

import { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';

export function Header() {
  const [user, setUser] = useState<{user_metadata?: {name?: string}, email?: string} | null>(null);
  
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await getCurrentUser();
        if (userData) {
          setUser(userData as {user_metadata?: {name?: string}, email?: string});
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };
    
    fetchUser();
  }, []);

  return (
    <header className="flex items-center justify-between h-16 px-6 border-b border-gray-800 bg-gray-950">
      <div>
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div className="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-full">
            <User className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-medium text-gray-200">
            {user?.user_metadata?.name || user?.email || 'User'}
          </span>
        </div>
      </div>
    </header>
  );
}