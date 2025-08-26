import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Type-safe error handling utilities
export function isError(value: unknown): value is Error {
  return value instanceof Error
}

export function getErrorMessage(error: unknown): string {
  return isError(error) ? error.message : 'An unknown error occurred'
}

// Type-safe API response utilities
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export function createApiResponse<T>(data: T): ApiResponse<T> {
  return { success: true, data }
}

export function createApiError(message: string): ApiResponse {
  return { success: false, error: message }
}

// Type-safe validation utilities
export function isValidId(id: unknown): id is number {
  return typeof id === 'number' && Number.isFinite(id) && id > 0
}

export function parseNumericId(id: string): number | null {
  const num = Number(id)
  return isValidId(num) ? num : null
}

// Type-safe object utilities
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function safeJsonParse<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T
  } catch {
    return null
  }
}

// Currency formatting utility
export function formatCurrency(amount: number | string | null | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (typeof num !== 'number' || isNaN(num)) return '₹0.00'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(num)
}

// Validation utilities
export function validateRequired(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null || value === '') {
    return `${fieldName} is required`
  }
  return null
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validatePhone(phone: string): boolean {
  const phoneRegex = /^[6-9]\d{9}$/
  return phoneRegex.test(phone.replace(/\D/g, ''))
}

export function validatePAN(pan: string): boolean {
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
  return panRegex.test(pan)
}

export function validateAadhaar(aadhaar: string): boolean {
  const aadhaarRegex = /^\d{12}$/
  return aadhaarRegex.test(aadhaar)
}
