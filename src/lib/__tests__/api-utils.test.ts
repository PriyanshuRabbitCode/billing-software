import {
  parseRouteParams,
  validateRouteId,
  validateDbResult,
  validateRequiredFields,
} from '../api-utils'

describe('API Utilities', () => {
  describe('parseRouteParams', () => {
    it('should parse route parameters', () => {
      const params = { id: '123', table: 'customers' }
      const result = parseRouteParams(params)
      
      expect(result).toEqual({ id: '123', table: 'customers' })
    })

    it('should handle non-object params', () => {
      expect(parseRouteParams(null)).toEqual({})
      expect(parseRouteParams(undefined)).toEqual({})
      expect(parseRouteParams('string')).toEqual({})
    })
  })

  describe('validateRouteId', () => {
    it('should validate valid IDs', () => {
      expect(validateRouteId('1')).toBe(1)
      expect(validateRouteId('100')).toBe(100)
    })

    it('should return null for invalid IDs', () => {
      expect(validateRouteId('0')).toBe(null)
      expect(validateRouteId('-1')).toBe(null)
      expect(validateRouteId('abc')).toBe(null)
      expect(validateRouteId('')).toBe(null)
    })
  })

  describe('validateDbResult', () => {
    it('should validate valid database results', () => {
      const result = { rows: [{ id: 1, name: 'test' }] }
      expect(validateDbResult(result)).toBe(true)
    })

    it('should reject invalid database results', () => {
      expect(validateDbResult(null)).toBe(false)
      expect(validateDbResult({})).toBe(false)
      expect(validateDbResult({ rows: 'not array' })).toBe(false)
    })
  })

  describe('validateRequiredFields', () => {
    it('should return empty array for valid body', () => {
      const body = { name: 'test', email: 'test@example.com' }
      const required = ['name', 'email']
      
      const missing = validateRequiredFields(body, required)
      expect(missing).toEqual([])
    })

    it('should return missing fields', () => {
      const body = { name: 'test' }
      const required = ['name', 'email', 'phone']
      
      const missing = validateRequiredFields(body, required)
      expect(missing).toEqual(['email', 'phone'])
    })

    it('should handle empty values', () => {
      const body = { name: '', email: null, phone: undefined }
      const required = ['name', 'email', 'phone']
      
      const missing = validateRequiredFields(body, required)
      expect(missing).toEqual(['name', 'email', 'phone'])
    })
  })
})
