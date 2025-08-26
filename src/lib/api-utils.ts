import { NextRequest, NextResponse } from 'next/server'
import { getErrorMessage, createApiResponse, createApiError, parseNumericId, isRecord } from './utils'

// Centralized API error handler
export function handleApiError(error: unknown, context: string = 'API'): NextResponse {
  console.error(`${context} error:`, error)
  const message = getErrorMessage(error)
  return NextResponse.json(createApiError(message), { status: 500 })
}

// Centralized API response formatter
export function createSuccessResponse<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(createApiResponse(data), { status })
}

export function createErrorResponse(message: string, status: number = 400): NextResponse {
  return NextResponse.json(createApiError(message), { status })
}

// Type-safe request body parser
export async function parseRequestBody<T = Record<string, unknown>>(req: NextRequest): Promise<T | null> {
  try {
    const body = await req.json()
    return isRecord(body) ? body as T : null
  } catch {
    return null
  }
}

// Type-safe route parameters parser
export function parseRouteParams(params: unknown): Record<string, string> {
  if (isRecord(params)) {
    return Object.fromEntries(
      Object.entries(params).map(([key, value]) => [key, String(value)])
    )
  }
  return {}
}

// Type-safe ID validation
export function validateRouteId(id: string): number | null {
  return parseNumericId(id)
}



// Type-safe database result validator
export function validateDbResult<T>(result: unknown): result is { rows: T[] } {
  return isRecord(result) && Array.isArray((result as { rows: unknown }).rows)
}

// Common validation patterns
export function validateRequiredFields(
  body: Record<string, unknown>, 
  requiredFields: string[]
): string[] {
  const missing: string[] = []
  for (const field of requiredFields) {
    const value = body[field]
    if (value === undefined || value === null || value === '') {
      missing.push(field)
    }
  }
  return missing
}

// Type-safe query parameter extraction
export function getQueryParam(req: NextRequest, key: string): string | null {
  const value = req.nextUrl.searchParams.get(key)
  return value || null
}

// Type-safe query parameter with default
export function getQueryParamWithDefault(req: NextRequest, key: string, defaultValue: string): string {
  return getQueryParam(req, key) || defaultValue
}
