"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface User {
  id: string;
  email?: string;
  created_at: string;
  user_metadata?: {
    name?: string;
  };
  email_confirmed_at?: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const { data, error } = await supabase.auth.admin.listUsers();
        
        if (error) {
          throw error;
        }
        
        if (data?.users) {
          setUsers(data.users);
        }
      } catch (err: unknown) {
        console.error('Error fetching users:', err);
        setError((err as Error).message || 'Failed to load users');
        
        // If admin API fails, try to at least get the current user
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            setUsers([user]);
          }
        } catch (userErr) {
          console.error('Failed to get current user:', userErr);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Users</h1>
        <p>Loading user data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Users</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Error</p>
          <p>{error}</p>
          <p className="mt-2">
            Note: To view all users, you need admin access to the Supabase project.
            Please check the Supabase dashboard instead.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Users</h1>
      
      {users.length === 0 ? (
        <p>No users found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-gray-800 rounded-lg overflow-hidden">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Created At</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Email Confirmed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-600">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{user.id.substring(0, 8)}...</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{user.user_metadata?.name || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {user.email_confirmed_at ? 'Yes' : 'No'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="mt-8 p-4 bg-gray-800 rounded-lg">
        <h2 className="text-xl font-bold mb-2">View Users in Supabase Dashboard</h2>
        <p className="mb-4">
          To view all registered users and their complete data, you should access the Supabase dashboard:
        </p>
        <ol className="list-decimal pl-5 space-y-2">
          <li>Go to <a href="https://app.supabase.com" className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">https://app.supabase.com</a> and log in</li>
          <li>Select your project</li>
          <li>In the left sidebar, click on &quot;Authentication&quot;</li>
          <li>Click on &quot;Users&quot; to view all registered users</li>
        </ol>
      </div>
    </div>
  );
}