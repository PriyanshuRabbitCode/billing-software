"use client";

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#8DD1E1', '#D084A0', '#87CEEB', '#FFB6C1'];
// Extended color palette for city distribution
const CITY_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', 
  '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
  '#8395A7', '#00B894', '#E17055', '#FDCB6E', '#6C5CE7',
  '#A29BFE', '#FD79A8', '#FDCB6E', '#E84393', '#00B894'
];

interface PieChartData {
  name: string;
  value: number;
  color?: string;
}

interface BarChartData {
  name: string;
  value: number;
  [key: string]: any;
}

interface LineChartData {
  name: string;
  value: number;
  [key: string]: any;
}

export function CustomPieChart({ data, title }: { data: PieChartData[]; title: string }) {
  // Use city colors for customer distribution charts
  const usesCityColors = title.toLowerCase().includes('city') || title.toLowerCase().includes('customer distribution');
  const colorPalette = usesCityColors ? CITY_COLORS : COLORS;
  
  // Custom label renderer for better readability
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    // Only show label if percentage is >= 5% to avoid clutter
    if (percent < 0.05) return null;

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // Custom tooltip formatter
  const customTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const currentData = payload[0];
      const total = data.reduce((sum: number, item: any) => sum + item.value, 0);
      const isFinancialChart = title.toLowerCase().includes('mdr') || title.toLowerCase().includes('tax');
      
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium text-gray-800">{currentData.payload.name}</p>
          {isFinancialChart ? (
            <p className="text-blue-600">Amount: ₹{currentData.payload.value.toLocaleString()}</p>
          ) : (
            <p className="text-blue-600">Count: {currentData.payload.value}</p>
          )}
          <p className="text-gray-600">Percentage: {((currentData.payload.value / total) * 100).toFixed(1)}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-80">
      <h3 className="text-lg font-medium mb-4 text-center">{title}</h3>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={100}
            innerRadius={20}
            fill="#8884d8"
            dataKey="value"
            stroke="#fff"
            strokeWidth={2}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={colorPalette[index % colorPalette.length]}
              />
            ))}
          </Pie>
          <Tooltip content={customTooltip} />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            formatter={(value, entry: any) => (
              <span style={{ color: entry.color, fontWeight: 'medium' }}>
                {value} ({entry.payload.value})
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CustomBarChart({ data, title, dataKey = "value" }: { 
  data: BarChartData[]; 
  title: string; 
  dataKey?: string;
}) {
  // Custom tooltip for customer data
  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isCustomerChart = title.toLowerCase().includes('customer');
      
      if (isCustomerChart && data.totalDeposits !== undefined) {
        return (
          <div className="bg-white p-3 border rounded-lg shadow-lg">
            <p className="font-medium text-gray-800">{label}</p>
            <p className="text-blue-600">Net Deposits: ₹{data.value?.toLocaleString()}</p>
            <p className="text-green-600">Total Deposits: ₹{data.totalDeposits?.toLocaleString()}</p>
            <p className="text-red-600">Total Withdrawals: ₹{data.totalWithdrawals?.toLocaleString()}</p>
          </div>
        );
      }
      
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium text-gray-800">{label}</p>
          <p className="text-blue-600">Value: {Math.floor(Number(payload[0].value)).toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-80">
      <h3 className="text-lg font-medium mb-4 text-center">{title}</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="name" 
            angle={-45}
            textAnchor="end"
            height={80}
            fontSize={12}
          />
          <YAxis 
            tickFormatter={(value) => `₹${value.toLocaleString()}`}
          />
          <Tooltip content={customTooltip} />
          <Legend />
          <Bar 
            dataKey={dataKey} 
            fill="#8884d8"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CustomMultiColorBarChart({ data, title, dataKey = "value" }: { 
  data: BarChartData[]; 
  title: string; 
  dataKey?: string;
}) {
  const getBarColor = (name: string) => {
    switch (name.toLowerCase()) {
      case 'deposits':
        return '#00C49F'; // Green
      case 'withdrawals':
        return '#FF8042'; // Orange/Red
      case 'pending':
        return '#FFBB28'; // Yellow
      default:
        return '#8884D8'; // Default purple
    }
  };

  return (
    <div className="w-full h-64">
      <h3 className="text-lg font-medium mb-4 text-center">{title}</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip formatter={(value) => [Math.floor(Number(value)).toString(), '']} />
          <Legend />
          {data.map((entry, index) => (
            <Bar 
              key={`bar-${index}`} 
              dataKey={dataKey} 
              fill={getBarColor(entry.name)}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CustomLineChart({ data, title, dataKey = "value" }: { 
  data: LineChartData[]; 
  title: string; 
  dataKey?: string;
}) {
  return (
    <div className="w-full h-64">
      <h3 className="text-lg font-medium mb-4 text-center">{title}</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey={dataKey} stroke="#8884d8" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CustomAreaChart({ data, title, dataKey = "value" }: { 
  data: LineChartData[]; 
  title: string; 
  dataKey?: string;
}) {
  return (
    <div className="w-full h-64">
      <h3 className="text-lg font-medium mb-4 text-center">{title}</h3>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Area type="monotone" dataKey={dataKey} stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MultiBarChart({ data, title, dataKeys }: { 
  data: BarChartData[]; 
  title: string; 
  dataKeys: string[];
}) {
  return (
    <div className="w-full h-64">
      <h3 className="text-lg font-medium mb-4 text-center">{title}</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          {dataKeys.map((key, index) => (
            <Bar key={key} dataKey={key} fill={COLORS[index % COLORS.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MultiLineChart({ data, title, dataKeys }: { 
  data: LineChartData[]; 
  title: string; 
  dataKeys: string[];
}) {
  return (
    <div className="w-full h-64">
      <h3 className="text-lg font-medium mb-4 text-center">{title}</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          {dataKeys.map((key, index) => (
            <Line 
              key={key} 
              type="monotone" 
              dataKey={key} 
              stroke={COLORS[index % COLORS.length]} 
              strokeWidth={2} 
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
