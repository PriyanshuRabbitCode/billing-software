/**
 * Global Error Handling System
 * Provides consistent error handling across the application
 */

export interface ErrorInfo {
  message: string;
  code?: string;
  details?: any;
  timestamp: string;
  userFriendly: boolean;
}

export interface ApiError extends Error {
  status?: number;
  code?: string;
  details?: any;
}

export class AppError extends Error implements ApiError {
  public status: number;
  public code: string;
  public details?: any;
  public userFriendly: boolean;

  constructor(
    message: string,
    status: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: any,
    userFriendly: boolean = false
  ) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.userFriendly = userFriendly;
  }
}

/**
 * Convert various error types to user-friendly messages
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.userFriendly ? error.message : 'An unexpected error occurred. Please try again.';
  }

  if (error instanceof Error) {
    // Handle specific error types
    if (error.message.includes('Invalid login credentials')) {
      return 'Invalid email or password. Please check your credentials and try again.';
    }
    
    if (error.message.includes('Email not confirmed')) {
      return 'Please verify your email address before logging in. Check your inbox for a confirmation email.';
    }
    
    if (error.message.includes('User already registered')) {
      return 'An account with this email already exists. Please try logging in instead.';
    }
    
    if (error.message.includes('Password should be at least')) {
      return 'Password must be at least 6 characters long.';
    }
    
    if (error.message.includes('Invalid email')) {
      return 'Please enter a valid email address.';
    }
    
    if (error.message.includes('Network')) {
      return 'Network error. Please check your internet connection and try again.';
    }
    
    if (error.message.includes('fetch')) {
      return 'Unable to connect to the server. Please try again later.';
    }
    
    // For development, show the actual error message
    if (process.env.NODE_ENV === 'development') {
      return error.message;
    }
    
    // For production, show generic message
    return 'An unexpected error occurred. Please try again.';
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Log error for debugging (server-side only)
 */
export function logError(error: unknown, context?: string): void {
  if (typeof window !== 'undefined') {
    // Client-side logging
    console.error(`[${context || 'Client'}] Error:`, error);
    return;
  }

  // Server-side logging
  const errorInfo: ErrorInfo = {
    message: error instanceof Error ? error.message : String(error),
    code: error instanceof AppError ? error.code : 'UNKNOWN',
    details: error instanceof AppError ? error.details : undefined,
    timestamp: new Date().toISOString(),
    userFriendly: error instanceof AppError ? error.userFriendly : false,
  };

  console.error(`[${context || 'Server'}] Error:`, JSON.stringify(errorInfo, null, 2));
}

/**
 * Handle API errors consistently
 */
export async function handleApiError(response: Response): Promise<never> {
  let errorMessage = 'An unexpected error occurred';
  let errorCode = 'API_ERROR';
  let errorDetails: any = undefined;

  try {
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
      errorCode = errorData.code || errorCode;
      errorDetails = errorData.details;
    } else {
      const text = await response.text();
      if (text) {
        errorMessage = text;
      }
    }
  } catch (parseError) {
    // If we can't parse the error response, use status-based messages
    switch (response.status) {
      case 400:
        errorMessage = 'Invalid request. Please check your input and try again.';
        errorCode = 'BAD_REQUEST';
        break;
      case 401:
        errorMessage = 'Authentication required. Please log in and try again.';
        errorCode = 'UNAUTHORIZED';
        break;
      case 403:
        errorMessage = 'You do not have permission to perform this action.';
        errorCode = 'FORBIDDEN';
        break;
      case 404:
        errorMessage = 'The requested resource was not found.';
        errorCode = 'NOT_FOUND';
        break;
      case 409:
        errorMessage = 'A conflict occurred. The resource may already exist.';
        errorCode = 'CONFLICT';
        break;
      case 422:
        errorMessage = 'Validation error. Please check your input.';
        errorCode = 'VALIDATION_ERROR';
        break;
      case 429:
        errorMessage = 'Too many requests. Please wait a moment and try again.';
        errorCode = 'RATE_LIMITED';
        break;
      case 500:
        errorMessage = 'Server error. Please try again later.';
        errorCode = 'INTERNAL_ERROR';
        break;
      case 502:
      case 503:
      case 504:
        errorMessage = 'Service temporarily unavailable. Please try again later.';
        errorCode = 'SERVICE_UNAVAILABLE';
        break;
      default:
        errorMessage = `Request failed with status ${response.status}`;
        errorCode = 'HTTP_ERROR';
    }
  }

  const error = new AppError(errorMessage, response.status, errorCode, errorDetails, true);
  logError(error, 'API');
  throw error;
}

/**
 * Safe API call wrapper
 */
export async function safeApiCall<T>(
  apiCall: () => Promise<T>,
  context?: string
): Promise<T> {
  try {
    return await apiCall();
  } catch (error) {
    logError(error, context);
    
    if (error instanceof AppError) {
      throw error;
    }
    
    // Convert unknown errors to AppError
    const message = getErrorMessage(error);
    throw new AppError(message, 500, 'UNKNOWN_ERROR', error, false);
  }
}

/**
 * Database error handler
 */
export function handleDatabaseError(error: unknown, operation: string): never {
  logError(error, `Database: ${operation}`);
  
  if (error instanceof Error) {
    // Handle specific database errors
    if (error.message.includes('duplicate key')) {
      throw new AppError(
        'A record with this information already exists.',
        409,
        'DUPLICATE_KEY',
        error,
        true
      );
    }
    
    if (error.message.includes('foreign key')) {
      throw new AppError(
        'Cannot perform this action due to related data constraints.',
        400,
        'FOREIGN_KEY_VIOLATION',
        error,
        true
      );
    }
    
    if (error.message.includes('not null')) {
      throw new AppError(
        'Required fields are missing.',
        400,
        'NULL_CONSTRAINT',
        error,
        true
      );
    }
    
    if (error.message.includes('unique constraint')) {
      throw new AppError(
        'This value already exists and must be unique.',
        409,
        'UNIQUE_CONSTRAINT',
        error,
        true
      );
    }
  }
  
  // Generic database error
  throw new AppError(
    'Database operation failed. Please try again.',
    500,
    'DATABASE_ERROR',
    error,
    true
  );
}
