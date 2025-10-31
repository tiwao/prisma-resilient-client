/**
 * Unit tests for utility functions
 */

import {
  isConnectionError,
  isRetryableError,
  getErrorMessage,
  calculateBackoff,
  getHeapUsagePercent,
} from '../src/utils';

describe('Error utilities', () => {
  describe('isConnectionError', () => {
    it('should detect Prisma connection error codes', () => {
      expect(isConnectionError({ code: 'P1001', message: 'Error' })).toBe(true);
      expect(isConnectionError({ code: 'P1008', message: 'Error' })).toBe(true);
      expect(isConnectionError({ code: 'P1017', message: 'Error' })).toBe(true);
      expect(isConnectionError({ code: 'P2024', message: 'Error' })).toBe(true);
    });

    it('should detect connection keywords in error messages', () => {
      expect(isConnectionError({ message: 'Connection refused' })).toBe(true);
      expect(isConnectionError({ message: 'ECONNREFUSED' })).toBe(true);
      expect(isConnectionError({ message: 'Socket timeout' })).toBe(true);
      expect(isConnectionError({ message: 'Network error' })).toBe(true);
    });

    it('should return false for non-connection errors', () => {
      expect(isConnectionError({ code: 'P2002', message: 'Unique constraint' })).toBe(false);
      expect(isConnectionError({ message: 'Invalid input' })).toBe(false);
      expect(isConnectionError(null)).toBe(false);
      expect(isConnectionError('string error')).toBe(false);
    });
  });

  describe('isRetryableError', () => {
    it('should consider connection errors as retryable', () => {
      expect(isRetryableError({ code: 'P1001', message: 'Error' })).toBe(true);
      expect(isRetryableError({ message: 'Connection lost' })).toBe(true);
    });

    it('should not consider non-connection errors as retryable', () => {
      expect(isRetryableError({ message: 'Invalid data' })).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('should extract message from Error object', () => {
      expect(getErrorMessage(new Error('Test error'))).toBe('Test error');
    });

    it('should handle string errors', () => {
      expect(getErrorMessage('String error')).toBe('String error');
    });

    it('should handle object with message property', () => {
      expect(getErrorMessage({ message: 'Object error' })).toBe('Object error');
    });

    it('should handle unknown error types', () => {
      expect(getErrorMessage(null)).toBe('Unknown error');
      expect(getErrorMessage(undefined)).toBe('Unknown error');
      expect(getErrorMessage(123)).toBe('123');
    });
  });
});

describe('Backoff utilities', () => {
  describe('calculateBackoff', () => {
    it('should calculate exponential backoff correctly', () => {
      expect(calculateBackoff(1, 1000, 10000, 'exponential')).toBe(1000); // 1000 * 2^0
      expect(calculateBackoff(2, 1000, 10000, 'exponential')).toBe(2000); // 1000 * 2^1
      expect(calculateBackoff(3, 1000, 10000, 'exponential')).toBe(4000); // 1000 * 2^2
      expect(calculateBackoff(4, 1000, 10000, 'exponential')).toBe(8000); // 1000 * 2^3
    });

    it('should calculate linear backoff correctly', () => {
      expect(calculateBackoff(1, 1000, 10000, 'linear')).toBe(1000); // 1000 * 1
      expect(calculateBackoff(2, 1000, 10000, 'linear')).toBe(2000); // 1000 * 2
      expect(calculateBackoff(3, 1000, 10000, 'linear')).toBe(3000); // 1000 * 3
    });

    it('should respect maxDelay cap', () => {
      expect(calculateBackoff(10, 1000, 5000, 'exponential')).toBe(5000);
      expect(calculateBackoff(10, 1000, 5000, 'linear')).toBe(5000);
    });
  });
});

describe('Memory utilities', () => {
  describe('getHeapUsagePercent', () => {
    it('should return a value between 0 and 1', () => {
      const usage = getHeapUsagePercent();
      expect(usage).toBeGreaterThanOrEqual(0);
      expect(usage).toBeLessThanOrEqual(1);
    });
  });
});
