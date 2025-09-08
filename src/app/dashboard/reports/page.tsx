"use client";

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Calendar, 
  Download, 
  FileText, 
  BarChart3, 
  PieChart, 
  TrendingUp,
  Users,
  Clock,
  DollarSign,
  AlertTriangle,
  CreditCard
} from 'lucide-react';
import { 
  CustomPieChart, 
  CustomBarChart, 
  CustomLineChart, 
  CustomAreaChart,
  MultiBarChart,
  MultiLineChart,
  CustomMultiColorBarChart
} from '@/components/reports/ChartComponents';
import { DataTable } from '@/components/reports/DataTable';

interface ReportData {
  transactionReports: any;
  financialSummaries: any;
  customerAnalytics: any;
  agingRiskAnalysis: any;
  trendsComparison: any;
  businessHealth: any;
}

export default function ReportsPage() {
  const [reportMode, setReportMode] = useState<'default' | 'custom'>('default');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  // Set default date range (today 12:00 AM to current time)
  useEffect(() => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    setFromDate(startOfDay.toISOString().slice(0, 16));
    setToDate(today.toISOString().slice(0, 16));
  }, []);

  const generateReport = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromDate: reportMode === 'default' ? new Date(new Date().setHours(0, 0, 0, 0)).toISOString() : fromDate,
          toDate: reportMode === 'default' ? new Date().toISOString() : toDate,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Report data received:', data);
        console.log('Customer Analytics data:', data.customerAnalytics);
        setReportData(data);
      } else {
        console.error('Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (format: 'pdf' | 'excel' | 'csv') => {
    setDownloading(format);
    try {
      const response = await fetch('/api/reports/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format,
          fromDate: reportMode === 'default' ? new Date(new Date().setHours(0, 0, 0, 0)).toISOString() : fromDate,
          toDate: reportMode === 'default' ? new Date().toISOString() : toDate,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Get filename from response headers or create default
        const contentDisposition = response.headers.get('content-disposition');
        let filename = `Report_${formatDate(fromDate)}_${formatDate(toDate)}.${format}`;
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="(.+)"/);
          if (filenameMatch) {
            filename = filenameMatch[1];
          }
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        throw new Error('Failed to download report');
      }
    } catch (error) {
      console.error('Error exporting report:', error);
      alert('Failed to download report. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toISOString().slice(0, 10).replace(/-/g, '-');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
        <div className="flex gap-2">
          <Button
            onClick={() => exportReport('pdf')}
            disabled={!reportData || downloading === 'pdf'}
            variant="outline"
            size="sm"
          >
            <FileText className="w-4 h-4 mr-2" />
            {downloading === 'pdf' ? 'Downloading...' : 'PDF'}
          </Button>
          <Button
            onClick={() => exportReport('excel')}
            disabled={!reportData || downloading === 'excel'}
            variant="outline"
            size="sm"
          >
            <Download className="w-4 h-4 mr-2" />
            {downloading === 'excel' ? 'Downloading...' : 'Excel'}
          </Button>
          <Button
            onClick={() => exportReport('csv')}
            disabled={!reportData || downloading === 'csv'}
            variant="outline"
            size="sm"
          >
            <Download className="w-4 h-4 mr-2" />
            {downloading === 'csv' ? 'Downloading...' : 'CSV'}
          </Button>
        </div>
      </div>

      {/* Date Range Selection */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Report Configuration</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label className="text-sm font-medium">Report Mode</Label>
            <div className="flex gap-4 mt-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="reportMode"
                  value="default"
                  checked={reportMode === 'default'}
                  onChange={(e) => setReportMode(e.target.value as 'default' | 'custom')}
                  className="mr-2"
                />
                Default Mode (Today 12:00 AM - Now)
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="reportMode"
                  value="custom"
                  checked={reportMode === 'custom'}
                  onChange={(e) => setReportMode(e.target.value as 'default' | 'custom')}
                  className="mr-2"
                />
                Custom Range
              </label>
            </div>
          </div>

          {reportMode === 'custom' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fromDate">From Date & Time</Label>
                <Input
                  id="fromDate"
                  type="datetime-local"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="toDate">To Date & Time</Label>
                <Input
                  id="toDate"
                  type="datetime-local"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-6">
          <Button onClick={generateReport} disabled={loading} className="w-full md:w-auto">
            <BarChart3 className="w-4 h-4 mr-2" />
            {loading ? 'Generating Report...' : 'Generate Report'}
          </Button>
        </div>
      </Card>

      {/* Report Sections */}
      {reportData && (
        <div className="space-y-6">
          {/* Business Health Snapshot */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <DollarSign className="w-5 h-5 mr-2" />
              Business Health Snapshot
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600">Active Customers</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {reportData.businessHealth?.activeCustomers || 0}
                    </p>
                    <p className="text-xs text-gray-500">With accounts/credits</p>
                  </div>
                  <Users className="w-8 h-8 text-blue-600" />
                </div>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600">New Customers</p>
                    <p className="text-2xl font-bold text-green-900">
                      {reportData.businessHealth?.newCustomers || 0}
                    </p>
                    <p className="text-xs text-gray-500">In selected period</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-600" />
                </div>
              </div>
              
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-orange-600">New Cards</p>
                    <p className="text-2xl font-bold text-orange-900">
                      {reportData.businessHealth?.newCards || 0}
                    </p>
                    <p className="text-xs text-gray-500">Total New Cards Added</p>
                  </div>
                  <CreditCard className="w-8 h-8 text-orange-600" />
                </div>
              </div>
            </div>
          </Card>

          {/* Transaction Overview */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2" />
              Transaction Overview
            </h2>
            {/* First Row: Payment Status Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <CustomPieChart 
                  data={reportData.transactionReports?.paymentStatusDistribution?.map((item: any) => ({
                    name: item.payment_status === 'Paid' ? 'Paid' : 
                          item.payment_status === 'Pending' ? 'Pending' :
                          item.payment_status || 'Unknown',
                    value: parseInt(item.amount) || 0
                  })) || []}
                  title="Payment Status Distribution (Pending vs Paid)"
                />
              </div>
              
              <div className="bg-gray-50 p-6 rounded-lg">
                <CustomPieChart 
                  data={reportData.transactionReports?.mdrVsTaxDistribution || [
                    { name: 'No Data', value: 1 }
                  ]}
                  title="MDR vs TAX"
                />
              </div>
            </div>
            
            {/* High Value Transactions Bar Chart */}
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <CustomBarChart 
                data={reportData.transactionReports?.highValueTransactions?.map((item: any, index: number) => ({
                  name: item.customer_name?.substring(0, 8) + '...' || `Transaction ${index + 1}`,
                  value: item.amount || 0
                })) || []}
                title="High Value Transactions (Top 10)"
              />
            </div>

            {/* High Value Transactions Table */}
            <DataTable
              data={reportData.transactionReports?.highValueTransactions || []}
              columns={[
                { key: 'id', label: 'Transaction ID', sortable: true },
                { 
                  key: 'customer_name', 
                  label: 'Customer Name', 
                  sortable: true
                },
                { 
                  key: 'amount', 
                  label: 'Amount', 
                  sortable: true,
                  render: (value) => `₹${Math.floor(value || 0).toString()}`
                },
                { 
                  key: 'status', 
                  label: 'Type', 
                  sortable: true,
                  render: (value) => value === 'Deposit' ? 'Deposit' : 
                                        value === 'Withdraw' ? 'Withdraw' : value
                },
                { 
                  key: 'created_at', 
                  label: 'Date', 
                  sortable: true,
                  render: (value) => new Date(value).toLocaleDateString()
                }
              ]}
              title="High Value Transactions (Top 10)"
              pageSize={5}
            />
          </Card>

          {/* Financial Summaries */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <DollarSign className="w-5 h-5 mr-2" />
              Account Financial Summaries
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <p className="text-sm text-blue-600">Total Received</p>
                <p className="text-xl font-bold text-blue-900">
                  ₹{Math.floor(Number(reportData.financialSummaries?.totalReceived) || 0).toString()}
                </p>
              </div>
              
              <div className="bg-yellow-50 p-4 rounded-lg text-center">
                <p className="text-sm text-yellow-600">Pending Amount</p>
                <p className="text-xl font-bold text-yellow-900">
                  ₹{Math.floor(Number(reportData.financialSummaries?.totalPendingAmount) || 0).toString()}
                </p>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <p className="text-sm text-green-600">Credit Limits</p>
                <p className="text-xl font-bold text-green-900">
                  ₹{Math.floor(Number(reportData.financialSummaries?.totalCreditLimits) || 0).toString()}
                </p>
              </div>
              
              <div className="bg-red-50 p-4 rounded-lg text-center">
                <p className="text-sm text-red-600">Net Position</p>
                <p className="text-xl font-bold text-red-900">
                  ₹{Math.floor(Number(reportData.financialSummaries?.netPosition) || 0).toString()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <CustomBarChart 
                  data={reportData.financialSummaries?.newCardsDistribution || []}
                  title="New Cards Distribution (Debit vs Credit Cards)"
                />
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <CustomMultiColorBarChart 
                  data={reportData.financialSummaries?.transactionOverview || []}
                  title="Transaction Overview (Deposits vs Withdrawals vs Pending)"
                />
              </div>
            </div>
          </Card>

          {/* Customer Analytics */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Customer Analytics
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-50 p-6 rounded-lg">
                <CustomPieChart 
                  data={reportData.customerAnalytics?.customersByCity || [
                    { name: 'No Data', value: 1 }
                  ]}
                  title="Customer Distribution by City"
                />
              </div>
              
              <div className="bg-gray-50 p-6 rounded-lg">
                <CustomBarChart 
                  data={reportData.customerAnalytics?.topCustomers
                    ?.filter((customer: any) => customer.totalSettlement > 0) // Only show customers with positive net deposits
                    ?.slice(0, 8) // Show fewer bars for better readability
                    ?.map((customer: any) => ({
                      name: customer.full_name?.substring(0, 10) + '...' || 'Unknown',
                      value: customer.totalSettlement || 0,
                      totalDeposits: customer.totalDeposits || 0,
                      totalWithdrawals: customer.totalWithdrawals || 0
                    })) || [
                    { name: 'No Data', value: 0 }
                  ]}
                  title="Top Customers by Net Deposits"
                />
              </div>
            </div>

            {/* Top Customers Table */}
            <DataTable
              data={reportData.customerAnalytics?.topCustomers || []}
              columns={[
                { key: 'full_name', label: 'Customer Name', sortable: true },
                { key: 'city', label: 'City', sortable: true },
                { key: 'state', label: 'State', sortable: true },
                { 
                  key: 'totalDeposits', 
                  label: 'Total Deposits', 
                  sortable: true,
                  render: (value) => `₹${Math.floor(value || 0).toString()}`
                },
                { 
                  key: 'totalWithdrawals', 
                  label: 'Total Withdrawals', 
                  sortable: true,
                  render: (value) => `₹${Math.floor(value || 0).toString()}`
                },
                { 
                  key: 'totalSettlement', 
                  label: 'Net Received Amount', 
                  sortable: true,
                  render: (value) => `₹${Math.floor(value || 0).toString()}`
                }
              ]}
              title="Top Customers by Net Deposits"
              pageSize={10}
            />
          </Card>

          {/* Card Details Overview */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <CreditCard className="w-5 h-5 mr-2" />
              Card Details Overview
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <CustomBarChart 
                  data={reportData.financialSummaries?.newCardsDistribution || [
                    { name: 'No Data', value: 0 }
                  ]}
                  title="Card Types Distribution (Debit vs Credit Cards)"
                />
              </div>
              
              <div className="bg-gray-50 p-6 rounded-lg">
                <CustomPieChart 
                  data={reportData.financialSummaries?.bankDistribution || [
                    { name: 'No Data', value: 1 }
                  ]}
                  title="Bank Distribution"
                />
              </div>
            </div>
          </Card>

          {/* Credit Aging & Risk Analysis */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Credit Aging & Risk Analysis
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-green-50 p-4 rounded-lg text-center" title="Total pending amount (overdue) within the last 30 days. Shows freshest dues with highest chance of recovery.">
                <p className="text-sm text-green-600">Recent Overdue</p>
                <p className="text-xl font-bold text-green-900">
                  ₹{Math.floor(reportData.agingRiskAnalysis?.bucket0to30 || 0).toString()}
                </p>
                <p className="text-xs text-gray-500">0-30 Days</p>
              </div>
              
              <div className="bg-yellow-50 p-4 rounded-lg text-center" title="Total pending amount (overdue) that is 31-60 days old. Medium risk category indicating possible payment delays.">
                <p className="text-sm text-yellow-600">Medium Term</p>
                <p className="text-xl font-bold text-yellow-900">
                  ₹{Math.floor(reportData.agingRiskAnalysis?.bucket31to60 || 0).toString()}
                </p>
                <p className="text-xs text-gray-500">31-60 Days</p>
              </div>
              
              <div className="bg-orange-50 p-4 rounded-lg text-center" title="Total pending amount (overdue) that is 61-90 days old. High risk - longer dues mean higher chance of defaults.">
                <p className="text-sm text-orange-600">Long Term</p>
                <p className="text-xl font-bold text-orange-900">
                  ₹{Math.floor(reportData.agingRiskAnalysis?.bucket61to90 || 0).toString()}
                </p>
                <p className="text-xs text-gray-500">61-90 Days</p>
              </div>
              
              <div className="bg-red-50 p-4 rounded-lg text-center" title="Total pending amount (overdue) older than 90 days. Critical category - these payments are least likely to be recovered.">
                <p className="text-sm text-red-600">Critical Overdue</p>
                <p className="text-xl font-bold text-red-900">
                  ₹{Math.floor(reportData.agingRiskAnalysis?.bucket90Plus || 0).toString()}
                </p>
                <p className="text-xs text-gray-500">90+ Days</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <CustomBarChart 
                  data={reportData.agingRiskAnalysis?.creditAgingAnalysis || [
                    { name: '0-30 Days', value: 0 },
                    { name: '31-60 Days', value: 0 },
                    { name: '61-90 Days', value: 0 },
                    { name: '90+ Days', value: 0 }
                  ]}
                  title="Credit Aging Analysis (Visual breakdown of pending amounts in each bucket)"
                />
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-center">
                  <h3 className="text-lg font-medium mb-4" title="Percentage of total pending amounts that are overdue (60+ Days). Single health indicator for credit risk.">Risk Score</h3>
                  <div className={`text-4xl font-bold mb-2 ${
                    (reportData.agingRiskAnalysis?.riskScore || 0) > 20 
                      ? 'text-red-600' 
                      : (reportData.agingRiskAnalysis?.riskScore || 0) < 10 
                        ? 'text-green-600' 
                        : 'text-orange-600'
                  }`}>
                    {(reportData.agingRiskAnalysis?.riskScore || 0).toFixed(1)}%
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    {(reportData.agingRiskAnalysis?.riskScore || 0) > 20 
                      ? 'High Risk - Risky portfolio' 
                      : (reportData.agingRiskAnalysis?.riskScore || 0) < 10 
                        ? 'Low Risk - Healthy portfolio' 
                        : 'Medium Risk - Monitor closely'}
                  </p>
                  <div className="text-xs text-gray-500">
                    <p>Total Outstanding: ₹{Math.floor(reportData.agingRiskAnalysis?.totalOutstanding || 0).toString()}</p>
                    <p>Overdue Amount: ₹{Math.floor(reportData.agingRiskAnalysis?.overdueAmount || 0).toString()}</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Monthly/Quarterly Trends */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              Monthly/Quarterly Trends
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <p className="text-sm text-blue-600">Current Month</p>
                <p className="text-xl font-bold text-blue-900">
                  ₹{Math.floor(reportData.trendsComparison?.currentMonth || 0).toString()}
                </p>
                <p className="text-xs text-gray-500">{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <p className="text-sm text-green-600">Last Month</p>
                <p className="text-xl font-bold text-green-900">
                  ₹{Math.floor(reportData.trendsComparison?.lastMonth || 0).toString()}
                </p>
                <p className="text-xs text-gray-500">{new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <p className="text-sm text-purple-600">Same Month Last Year</p>
                <p className="text-xl font-bold text-purple-900">
                  ₹{Math.floor(reportData.trendsComparison?.lastYear || 0).toString()}
                </p>
                <p className="text-xs text-gray-500">{new Date(new Date().getFullYear() - 1, new Date().getMonth(), 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <CustomLineChart 
                  data={[
                    { 
                      name: new Date(new Date().getFullYear() - 1, new Date().getMonth(), 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), 
                      value: reportData.trendsComparison?.lastYear || 0 
                    },
                    { 
                      name: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), 
                      value: reportData.trendsComparison?.lastMonth || 0 
                    },
                    { 
                      name: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), 
                      value: reportData.trendsComparison?.currentMonth || 0 
                    }
                  ]}
                  title="Transaction Amounts Over Time"
                />
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-center">
                  <h3 className="text-lg font-medium mb-4">Growth Analysis</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Month over Month:</span>
                      <span className={`font-bold ${(reportData.trendsComparison?.monthOverMonth || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(reportData.trendsComparison?.monthOverMonth || 0).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Year over Year:</span>
                      <span className={`font-bold ${(reportData.trendsComparison?.yearOverYear || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(reportData.trendsComparison?.yearOverYear || 0).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
