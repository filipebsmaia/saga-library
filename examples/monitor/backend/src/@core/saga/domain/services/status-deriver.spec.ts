import { describe, it, expect } from 'vitest';
import { deriveStatus } from './status-deriver';
import { SagaStatus } from '../types/saga-status.enum';

describe('deriveStatus', () => {
  describe('from undefined current status (first event)', () => {
    it('should return RUNNING for step hint', () => {
      expect(deriveStatus('step', undefined)).toBe(SagaStatus.RUNNING);
    });

    it('should return RUNNING for fork hint', () => {
      expect(deriveStatus('fork', undefined)).toBe(SagaStatus.RUNNING);
    });

    it('should return COMPENSATING for compensation hint', () => {
      expect(deriveStatus('compensation', undefined)).toBe(SagaStatus.COMPENSATING);
    });

    it('should return COMPLETED for final hint', () => {
      expect(deriveStatus('final', undefined)).toBe(SagaStatus.COMPLETED);
    });

    it('should return RUNNING for undefined hint', () => {
      expect(deriveStatus(undefined, undefined)).toBe(SagaStatus.RUNNING);
    });
  });

  describe('from RUNNING status', () => {
    it('should stay RUNNING for step hint', () => {
      expect(deriveStatus('step', SagaStatus.RUNNING)).toBe(SagaStatus.RUNNING);
    });

    it('should transition to COMPENSATING for compensation hint', () => {
      expect(deriveStatus('compensation', SagaStatus.RUNNING)).toBe(SagaStatus.COMPENSATING);
    });

    it('should transition to COMPLETED for final hint', () => {
      expect(deriveStatus('final', SagaStatus.RUNNING)).toBe(SagaStatus.COMPLETED);
    });

    it('should stay RUNNING for fork hint', () => {
      expect(deriveStatus('fork', SagaStatus.RUNNING)).toBe(SagaStatus.RUNNING);
    });
  });

  describe('from COMPENSATING status', () => {
    it('should stay COMPENSATING for step hint (sticky)', () => {
      expect(deriveStatus('step', SagaStatus.COMPENSATING)).toBe(SagaStatus.COMPENSATING);
    });

    it('should stay COMPENSATING for fork hint (sticky)', () => {
      expect(deriveStatus('fork', SagaStatus.COMPENSATING)).toBe(SagaStatus.COMPENSATING);
    });

    it('should stay COMPENSATING for compensation hint', () => {
      expect(deriveStatus('compensation', SagaStatus.COMPENSATING)).toBe(SagaStatus.COMPENSATING);
    });

    it('should transition to COMPLETED for final hint', () => {
      expect(deriveStatus('final', SagaStatus.COMPENSATING)).toBe(SagaStatus.COMPLETED);
    });

    it('should stay COMPENSATING for undefined hint (sticky)', () => {
      expect(deriveStatus(undefined, SagaStatus.COMPENSATING)).toBe(SagaStatus.COMPENSATING);
    });
  });

  describe('from COMPLETED status', () => {
    it('should return RUNNING for step hint (re-entry)', () => {
      expect(deriveStatus('step', SagaStatus.COMPLETED)).toBe(SagaStatus.RUNNING);
    });

    it('should return COMPLETED for final hint', () => {
      expect(deriveStatus('final', SagaStatus.COMPLETED)).toBe(SagaStatus.COMPLETED);
    });
  });

});
