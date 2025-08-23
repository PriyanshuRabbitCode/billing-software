import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  // Create a response object to modify
  let response = NextResponse.next();
  
  // Create a Supabase client configured to use cookies
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // If Supabase envs are not configured, bypass auth middleware in local/dev
  if (!supabaseUrl || !supabaseKey) {
    return response;
  }
  // Create a cookies container from the request
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name) {
        return request.cookies.get(name)?.value;
      },
      set(name, value, options) {
        // If we're setting a cookie, update the response
        response.cookies.set({ name, value, ...options });
        return;
      },
      remove(name, options) {
        // If we're removing a cookie, update the response
        response.cookies.set({ name, value: '', ...options });
        return;
      },
    },
  });

  // Get the user from the cookie
  const { data: { session } } = await supabase.auth.getSession();

  // If the user is not signed in and the current path is not /login or /register
  // redirect the user to /login
  if (!session && !request.nextUrl.pathname.startsWith('/login') && !request.nextUrl.pathname.startsWith('/register')) {
    const redirectUrl = new URL('/login', request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // If the user is signed in and the current path is /login or /register
  // redirect the user to /dashboard
  if (session && (request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/register'))) {
    const redirectUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};