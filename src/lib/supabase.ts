import { createBrowserClient } from '@supabase/ssr';

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create Supabase client for browser context
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);