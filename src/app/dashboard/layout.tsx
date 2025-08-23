import { ReactNode } from 'react';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Header } from '@/components/dashboard/header';

export const metadata = {
  title: 'Dashboard',
  description: 'Dashboard overview',
};

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      <div className="w-64 h-full">
        <Sidebar />
      </div>
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 p-6 overflow-auto bg-gray-900">
          {children}
        </main>
      </div>
    </div>
  );
}