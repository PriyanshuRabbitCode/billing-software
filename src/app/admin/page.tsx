"use client";

import { useEffect, useState } from 'react';
import { getCurrentUser, signOut } from '@/lib/auth';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const userData = await getCurrentUser();
        if (!userData) {
          router.push('/login');
          return;
        }
        setUser(userData);
        // Redirect authenticated users to the new dashboard
        router.replace('/dashboard');
        return;
      } catch (error) {
        console.error('Error loading user:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading...</h2>
          <p>Please wait while we load your data.</p>
        </div>
      </div>
    );
  }

  // Fallback UI (very transient) — users are redirected to /dashboard above
  return <div className="p-6">Redirecting…</div>;
}