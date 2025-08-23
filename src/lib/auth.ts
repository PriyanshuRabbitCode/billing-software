import { supabase } from './supabase';

export interface SignUpCredentials {
  email_id: string;
  password: string;
  full_name: string;
}

export interface SignInCredentials {
  email: string;
  password: string;
}

export const signUp = async ({ 
  email_id, 
  password, 
  full_name
}: SignUpCredentials) => {
  // Only handle Supabase Auth signup, no customer data creation
  const { data, error } = await supabase.auth.signUp({
    email: email_id,
    password,
    options: {
      data: {
        full_name,
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
};

export const signIn = async ({ email, password }: SignInCredentials) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  // Check if email is confirmed
  if (data.user && !data.user.email_confirmed_at) {
    throw new Error('Email not verified. Please check your inbox and verify your email before logging in.');
  }

  // Log the session data for debugging
  console.log('Sign in successful:', data);
  
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    throw error;
  }
};

export const getCurrentUser = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user;
};