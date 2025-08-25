import { NextResponse } from 'next/server';

export async function GET() {
  const requiredEnvVars = [
    'DATABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ];
  
  const envStatus = requiredEnvVars.map(varName => ({
    name: varName,
    isSet: !!process.env[varName],
    value: process.env[varName] ? '***' + process.env[varName]!.slice(-4) : 'NOT SET'
  }));
  
  const missingVars = envStatus.filter(v => !v.isSet);
  
  if (missingVars.length > 0) {
    return NextResponse.json({
      status: 'error',
      message: 'Missing required environment variables',
      missing: missingVars.map(v => v.name),
      all: envStatus
    }, { status: 500 });
  }
  
  return NextResponse.json({
    status: 'success',
    message: 'All required environment variables are set',
    envStatus
  });
}
