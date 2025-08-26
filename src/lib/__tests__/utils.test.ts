import {
  isError,
  getErrorMessage,
  isValidId,
  parseNumericId,
  isRecord,
  safeJsonParse,
  formatCurrency,
  validateRequired,
  validateEmail,
  validatePhone,
  validatePAN,
  validateAadhaar,
} from '../utils'

describe('Utility Functions', () => {
  describe('isError', () => {
    it('should return true for Error instances', () => {
      expect(isError(new Error('test error'))).toBe(true)
    })

    it('should return false for non-Error values', () => {
      expect(isError('string')).toBe(false)
      expect(isError(123)).toBe(false)
      expect(isError({})).toBe(false)
      expect(isError(null)).toBe(false)
      expect(isError(undefined)).toBe(false)
    })
  })

  describe('getErrorMessage', () => {
    it('should return error message for Error instances', () => {
      expect(getErrorMessage(new Error('test error'))).toBe('test error')
    })

    it('should return default message for non-Error values', () => {
      expect(getErrorMessage('string')).toBe('An unknown error occurred')
      expect(getErrorMessage(123)).toBe('An unknown error occurred')
      expect(getErrorMessage(null)).toBe('An unknown error occurred')
    })
  })

  describe('isValidId', () => {
    it('should return true for valid numeric IDs', () => {
      expect(isValidId(1)).toBe(true)
      expect(isValidId(100)).toBe(true)
    })

    it('should return false for invalid IDs', () => {
      expect(isValidId(0)).toBe(false)
      expect(isValidId(-1)).toBe(false)
      expect(isValidId(NaN)).toBe(false)
      expect(isValidId(Infinity)).toBe(false)
      expect(isValidId('1')).toBe(false)
      expect(isValidId(null)).toBe(false)
    })
  })

  describe('parseNumericId', () => {
    it('should parse valid numeric strings', () => {
      expect(parseNumericId('1')).toBe(1)
      expect(parseNumericId('100')).toBe(100)
    })

    it('should return null for invalid strings', () => {
      expect(parseNumericId('0')).toBe(null)
      expect(parseNumericId('-1')).toBe(null)
      expect(parseNumericId('abc')).toBe(null)
      expect(parseNumericId('')).toBe(null)
    })
  })

  describe('isRecord', () => {
    it('should return true for plain objects', () => {
      expect(isRecord({})).toBe(true)
      expect(isRecord({ key: 'value' })).toBe(true)
    })

    it('should return false for non-objects', () => {
      expect(isRecord(null)).toBe(false)
      expect(isRecord(undefined)).toBe(false)
      expect(isRecord('string')).toBe(false)
      expect(isRecord(123)).toBe(false)
      expect(isRecord([])).toBe(false)
    })
  })

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      expect(safeJsonParse('{"key": "value"}')).toEqual({ key: 'value' })
      expect(safeJsonParse('[1, 2, 3]')).toEqual([1, 2, 3])
    })

    it('should return null for invalid JSON', () => {
      expect(safeJsonParse('invalid json')).toBe(null)
      expect(safeJsonParse('')).toBe(null)
    })
  })

  describe('formatCurrency', () => {
    it('should format numbers correctly', () => {
      expect(formatCurrency(1000)).toBe('₹1,000.00')
      expect(formatCurrency(1234.56)).toBe('₹1,234.56')
    })

    it('should handle string inputs', () => {
      expect(formatCurrency('1000')).toBe('₹1,000.00')
      expect(formatCurrency('1234.56')).toBe('₹1,234.56')
    })

    it('should handle invalid inputs', () => {
      expect(formatCurrency(null)).toBe('₹0.00')
      expect(formatCurrency(undefined)).toBe('₹0.00')
      expect(formatCurrency('invalid')).toBe('₹0.00')
      expect(formatCurrency(NaN)).toBe('₹0.00')
    })
  })

  describe('validateRequired', () => {
    it('should return null for valid values', () => {
      expect(validateRequired('value', 'field')).toBe(null)
      expect(validateRequired(0, 'field')).toBe(null)
      expect(validateRequired(false, 'field')).toBe(null)
    })

    it('should return error message for invalid values', () => {
      expect(validateRequired('', 'field')).toBe('field is required')
      expect(validateRequired(null, 'field')).toBe('field is required')
      expect(validateRequired(undefined, 'field')).toBe('field is required')
    })
  })

  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      expect(validateEmail('test@example.com')).toBe(true)
      expect(validateEmail('user.name@domain.co.uk')).toBe(true)
    })

    it('should reject invalid email formats', () => {
      expect(validateEmail('invalid-email')).toBe(false)
      expect(validateEmail('test@')).toBe(false)
      expect(validateEmail('@example.com')).toBe(false)
      expect(validateEmail('')).toBe(false)
    })
  })

  describe('validatePhone', () => {
    it('should validate correct phone numbers', () => {
      expect(validatePhone('9876543210')).toBe(true)
      expect(validatePhone('98765 43210')).toBe(true)
      expect(validatePhone('98765-43210')).toBe(true)
    })

    it('should reject invalid phone numbers', () => {
      expect(validatePhone('1234567890')).toBe(false) // doesn't start with 6-9
      expect(validatePhone('987654321')).toBe(false) // too short
      expect(validatePhone('98765432101')).toBe(false) // too long
      expect(validatePhone('')).toBe(false)
    })
  })

  describe('validatePAN', () => {
    it('should validate correct PAN formats', () => {
      expect(validatePAN('ABCDE1234F')).toBe(true)
      expect(validatePAN('XYZAB5678C')).toBe(true)
    })

    it('should reject invalid PAN formats', () => {
      expect(validatePAN('ABCD1234F')).toBe(false) // wrong length
      expect(validatePAN('ABCDE12345')).toBe(false) // wrong format
      expect(validatePAN('12345ABCDE')).toBe(false) // wrong format
      expect(validatePAN('')).toBe(false)
    })
  })

  describe('validateAadhaar', () => {
    it('should validate correct Aadhaar numbers', () => {
      expect(validateAadhaar('123456789012')).toBe(true)
      expect(validateAadhaar('987654321098')).toBe(true)
    })

    it('should reject invalid Aadhaar numbers', () => {
      expect(validateAadhaar('12345678901')).toBe(false) // too short
      expect(validateAadhaar('1234567890123')).toBe(false) // too long
      expect(validateAadhaar('12345678901a')).toBe(false) // contains letters
      expect(validateAadhaar('')).toBe(false)
    })
  })
})
