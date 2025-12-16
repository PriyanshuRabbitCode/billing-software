import { supabase } from './supabase';
import { AppError, logError, safeApiCall } from './errorHandling';

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
  return safeApiCall(async () => {
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
      logError(error, 'Auth: SignUp');
      
      // Convert Supabase errors to user-friendly messages
      if (error.message.includes('User already registered')) {
        throw new AppError(
          'An account with this email already exists. Please try logging in instead.',
          409,
          'USER_EXISTS',
          error,
          true
        );
      }
      
      if (error.message.includes('Password should be at least')) {
        throw new AppError(
          'Password must be at least 6 characters long.',
          400,
          'WEAK_PASSWORD',
          error,
          true
        );
      }
      
      if (error.message.includes('Invalid email')) {
        throw new AppError(
          'Please enter a valid email address.',
          400,
          'INVALID_EMAIL',
          error,
          true
        );
      }
      
      throw new AppError(
        'Failed to create account. Please try again.',
        500,
        'SIGNUP_FAILED',
        error,
        true
      );
    }

    return data;
  }, 'Auth: SignUp');
};

export const signIn = async ({ email, password }: SignInCredentials) => {
  return safeApiCall(async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      logError(error, 'Auth: SignIn');
      
      // Convert Supabase errors to user-friendly messages
      if (error.message.includes('Invalid login credentials')) {
        throw new AppError(
          'Invalid email or password. Please check your credentials and try again.',
          401,
          'INVALID_CREDENTIALS',
          error,
          true
        );
      }
      
      if (error.message.includes('Email not confirmed')) {
        throw new AppError(
          'Please verify your email address before logging in. Check your inbox for a confirmation email.',
          401,
          'EMAIL_NOT_CONFIRMED',
          error,
          true
        );
      }
      
      if (error.message.includes('Too many requests')) {
        throw new AppError(
          'Too many login attempts. Please wait a moment and try again.',
          429,
          'RATE_LIMITED',
          error,
          true
        );
      }
      
      throw new AppError(
        'Login failed. Please try again.',
        500,
        'SIGNIN_FAILED',
        error,
        true
      );
    }

    // Check if email is confirmed
    if (data.user && !data.user.email_confirmed_at) {
      throw new AppError(
        'Please verify your email address before logging in. Check your inbox for a confirmation email.',
        401,
        'EMAIL_NOT_CONFIRMED',
        null,
        true
      );
    }

    return data;
  }, 'Auth: SignIn');
};

export const signOut = async () => {
  return safeApiCall(async () => {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      logError(error, 'Auth: SignOut');
      throw new AppError(
        'Failed to sign out. Please try again.',
        500,
        'SIGNOUT_FAILED',
        error,
        true
      );
    }
  }, 'Auth: SignOut');
};

export const getCurrentUser = async () => {
  return safeApiCall(async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      logError(error, 'Auth: GetCurrentUser');
      // Don't throw error for getCurrentUser as it's used for checking auth state
      return null;
    }
    
    return session?.user || null;
  }, 'Auth: GetCurrentUser');
};