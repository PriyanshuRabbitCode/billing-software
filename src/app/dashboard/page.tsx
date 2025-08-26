"use client";

import { CreditCard, DollarSign, Users, CreditCard as CardIcon, Calendar, CalendarDays } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useStats } from '@/lib/hooks/useCachedAPI';
// Fetch stats from our server API backed by PostgreSQL

export default function DashboardPage() {
  const [recent, setRecent] = useState<any[]>([]);
  const [upcomingDueDates, setUpcomingDueDates] = useState<any[]>([]);
  const [timePeriod, setTimePeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [customDateRange, setCustomDateRange] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Use cached stats API
  const { data: statsData, loading: statsLoading } = useStats(
    timePeriod, 
    customDateRange ? startDate : undefined, 
    customDateRange ? endDate : undefined
  );
  
  // Set default dates when component mounts
  useEffect(() => {
    const now = new Date();
    let defaultStartDate: Date;
    
    switch (timePeriod) {
      case 'daily':
        defaultStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        defaultStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'yearly':
        defaultStartDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    setStartDate(defaultStartDate.toISOString().split('T')[0]);
    setEndDate(now.toISOString().split('T')[0]);
  }, [timePeriod]);
  
  // Load recent activity and upcoming due dates on mount
  useEffect(() => {
    let active = true;
    async function load() {
      // First calculate card pending amounts to ensure data is up to date
      try {
        const cardPendingRes = await fetch('/api/calculate-card-pending-amount');
        if (cardPendingRes.ok) {
          console.log('Card pending amounts calculated for dashboard');
        }
      } catch (error) {
        console.error('Error calculating card pending amounts:', error);
      }
      
      const dueDatesRes = await fetch('/api/upcoming-due-dates');
      const dueDatesData = await dueDatesRes.json();
      
      if (!active) return;
      setUpcomingDueDates(dueDatesData);
    }
    load();
    return () => { active = false; };
  }, [timePeriod, customDateRange, startDate, endDate]);

  // Update recent data when stats data changes
  useEffect(() => {
    if (statsData && typeof statsData === 'object' && statsData !== null && 'recent' in statsData && Array.isArray((statsData as any).recent)) {
      setRecent((statsData as any).recent);
    }
  }, [statsData]);
  
  const timePeriodOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' }
  ];

  const getPeriodLabel = () => {
    if (customDateRange && startDate && endDate) {
      const start = new Date(startDate).toLocaleDateString();
      const end = new Date(endDate).toLocaleDateString();
      return `${start} - ${end}`;
    }
    return timePeriod;
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1">Welcome back! Here&apos;s what&apos;s happening with your business.</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select
              value={timePeriod}
              onChange={(e) => {
                setTimePeriod(e.target.value as any);
                setCustomDateRange(false);
              }}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 px-3 py-2"
            >
              {timePeriodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="customDateRange"
              checked={customDateRange}
              onChange={(e) => setCustomDateRange(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-700 rounded focus:ring-blue-500 focus:ring-2"
            />
            <label htmlFor="customDateRange" className="text-sm text-gray-400">Custom Range</label>
          </div>
          
          {customDateRange && (
            <div className="flex items-center space-x-2">
              <CalendarDays className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 px-3 py-2"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 px-3 py-2"
              />
            </div>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
        <DashboardCard 
          title="Total Customers" 
          value={statsLoading ? "Loading..." : String((statsData as any)?.stats?.customers || 0)} 
          description={`Active customers (${getPeriodLabel()})`} 
          icon={<Users className="w-6 h-6 text-blue-500" />} 
        />
        <DashboardCard 
          title="Total Cards" 
          value={statsLoading ? "Loading..." : String((statsData as any)?.stats?.cards || 0)} 
          description={`All cards in system`} 
          icon={<CardIcon className="w-6 h-6 text-purple-500" />} 
        />
        <DashboardCard 
          title="Total Transactions" 
          value={statsLoading ? "Loading..." : String((statsData as any)?.stats?.transactions || 0)} 
          description={`All transactions (${getPeriodLabel()})`} 
          icon={<CreditCard className="w-6 h-6 text-orange-500" />} 
        />
        <DashboardCard 
          title="Pending Payments" 
          value={statsLoading ? "Loading..." : `₹${((statsData as any)?.stats?.pending || 0).toFixed(2)}`} 
          description={`Awaiting payment (${getPeriodLabel()})`} 
          icon={<DollarSign className="w-6 h-6 text-yellow-500" />} 
        />
        <DashboardCard 
          title="Total Revenue" 
          value={statsLoading ? "Loading..." : `₹${((statsData as any)?.stats?.revenue || 0).toFixed(2)}`} 
          description={`Total profit (${getPeriodLabel()})`} 
          icon={<DollarSign className="w-6 h-6 text-green-500" />} 
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity Card */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-lg">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white">Recent Activity</h2>
            <p className="text-gray-400 text-sm mt-1">Latest transactions and activities</p>
          </div>
          <div className="p-6">
            {recent.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">No recent transactions found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recent.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-750 hover:bg-gray-700 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <div className="flex flex-col">
                        <span className="text-gray-200 font-medium">{tx.customer_name ?? tx.customer_id}</span>
                        <span className="text-gray-400 text-sm capitalize">{tx.status || 'Transaction'}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="flex flex-col items-end">
                        <span className="text-gray-300">₹{Number(tx.payable_amount ?? 0).toFixed(2)}</span>
                        <span className="text-gray-400 text-xs">Pending: ₹{Number(tx.pending_amount ?? 0).toFixed(2)}</span>
                      </div>
                      <span className="text-gray-400 text-sm">{new Date(tx.transaction_date).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Due Dates Card */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-lg">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white">Upcoming Due Dates</h2>
            <p className="text-gray-400 text-sm mt-1">Cards with upcoming payment due dates</p>
          </div>
          <div className="p-6">
            {upcomingDueDates.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">No upcoming due dates found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingDueDates.map((card) => (
                  <div key={card.card_number} className="flex items-center justify-between p-3 rounded-lg bg-gray-750 hover:bg-gray-700 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <div className="flex flex-col">
                        <span className="text-gray-200 font-medium">{card.customer_name}</span>
                        <span className="text-gray-400 text-sm">{card.card_name}</span>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <span className="text-gray-300">{new Date(card.due_date).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface DashboardCardProps {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
}

function DashboardCard({ title, value, description, icon }: DashboardCardProps) {
  return (
    <div className="p-6 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 shadow-lg hover:shadow-xl transition-all duration-200 hover:border-gray-600">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</h3>
        <div className="p-2 rounded-lg bg-gray-700/50">
          {icon}
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold text-white mb-1">{value}</p>
        {description && <p className="text-sm text-gray-400">{description}</p>}
      </div>
    </div>
  );
}