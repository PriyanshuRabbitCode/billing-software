"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  Users,
  LogOut,
  CreditCard,
  BarChart3
} from 'lucide-react';
import { signOut } from '@/lib/auth';

const navItems = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Customers',
    href: '/dashboard/customers',
    icon: Users,
  },
  {
    title: 'Card Details',
    href: '/dashboard/card_details',
    icon: CreditCard,
  },
  {
    title: 'Transactions',
    href: '/dashboard/transactions',
    icon: FileText,
  },
  {
    title: 'Reports',
    href: '/dashboard/reports',
    icon: BarChart3,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/login';
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-200 border-r border-gray-800">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white">Billing Software</h1>
      </div>
      
      <nav className="flex-1 px-4 py-2 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center px-4 py-3 text-sm font-medium rounded-md hover:bg-gray-800",
              pathname === item.href ? "bg-gray-800 text-white" : "text-gray-300"
            )}
          >
            <item.icon className="w-5 h-5 mr-3" />
            {item.title}
          </Link>
        ))}


      </nav>
      
      <div className="p-4 mt-auto">
        <button
          onClick={handleSignOut}
          className="flex items-center w-full px-4 py-3 text-sm font-medium text-gray-300 rounded-md hover:bg-gray-800 hover:text-white"
        >
          <LogOut className="w-5 h-5 mr-3" />
          Sign Out
        </button>
      </div>
    </div>
  );
}