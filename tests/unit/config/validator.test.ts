/**
 * Tests for Configuration Validator
 *
 * Tests the health check and validation functions.
 */

import { describe, it, expect } from 'vitest';
import {
  checkConfigHealth,
  validateConfigDetailed,
  type ConfigHealthResult,
  type ConfigValidationResult,
} from '@/config/validator.js';
import type { ConfigInput } from '@/config/schema.js';

describe('checkConfigHealth', () => {
  const createValidConfig = (): ConfigInput => ({
    notebookUrl: '',
    headless: true,
    browserTimeout: 30000,
    viewport: { width: 1024, height: 768 },
    maxSessions: 10,
    sessionTimeout: 900,
    autoLoginEnabled: false,
    loginEmail: '',
    loginPassword: '',
    autoLoginTimeoutMs: 120000,
    stealthEnabled: true,
    stealthRandomDelays: true,
    stealthHumanTyping: true,
    stealthMouseMovements: true,
    typingWpmMin: 160,
    typingWpmMax: 240,
    minDelayMs: 100,
    maxDelayMs: 400,
    configDir: '/path/to/config',
    dataDir: '/path/to/data',
    browserStateDir: '/path/to/browser',
    chromeProfileDir: '/path/to/chrome',
    chromeInstancesDir: '/path/to/instances',
    notebookDescription: 'Test notebook',
    notebookTopics: ['test'],
    notebookContentTypes: ['docs'],
    notebookUseCases: ['testing'],
    profileStrategy: 'auto',
    cloneProfileOnIsolated: false,
    cleanupInstancesOnStartup: true,
    cleanupInstancesOnShutdown: true,
    instanceProfileTtlHours: 72,
    instanceProfileMaxCount: 20,
  });

  describe('valid configuration', () => {
    it('should return success for valid config', () => {
      const config = createValidConfig();
      const result = checkConfigHealth(config);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return no warnings for optimal config', () => {
      const config = createValidConfig();
      const result = checkConfigHealth(config);

      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('invalid configuration', () => {
    it('should return failure for invalid config', () => {
      const config = createValidConfig();
      config.browserTimeout = -1000;
      const result = checkConfigHealth(config);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should format error messages with path', () => {
      const config = createValidConfig();
      config.browserTimeout = -1000;
      const result: ConfigHealthResult = checkConfigHealth(config);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('browserTimeout');
    });

    it('should return multiple errors for multiple invalid values', () => {
      const config = createValidConfig();
      config.browserTimeout = -1000;
      config.maxSessions = 0;
      config.sessionTimeout = 30;
      const result = checkConfigHealth(config);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('warnings for non-optimal values', () => {
    it('should warn when maxSessions > 50', () => {
      const config = createValidConfig();
      config.maxSessions = 75;
      const result = checkConfigHealth(config);

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('maxSessions (75) > 50 may cause performance issues');
    });

    it('should warn when browserTimeout > 120000', () => {
      const config = createValidConfig();
      config.browserTimeout = 180000;
      const result = checkConfigHealth(config);

      expect(result.success).toBe(true);
      expect(result.warnings.some((w) => w.includes('browserTimeout') && w.includes('120s'))).toBe(
        true
      );
    });

    it('should warn when stealthEnabled is false', () => {
      const config = createValidConfig();
      config.stealthEnabled = false;
      const result = checkConfigHealth(config);

      expect(result.success).toBe(true);
      expect(result.warnings).toContain(
        'stealthEnabled is false - this may increase detection risk'
      );
    });

    it('should warn when sessionTimeout < 300', () => {
      const config = createValidConfig();
      config.sessionTimeout = 180;
      const result = checkConfigHealth(config);

      expect(result.success).toBe(true);
      expect(result.warnings.some((w) => w.includes('sessionTimeout') && w.includes('300s'))).toBe(
        true
      );
    });

    it('should warn when instanceProfileMaxCount > 50', () => {
      const config = createValidConfig();
      config.instanceProfileMaxCount = 75;
      const result = checkConfigHealth(config);

      expect(result.success).toBe(true);
      expect(result.warnings.some((w) => w.includes('instanceProfileMaxCount'))).toBe(true);
    });

    it('should return multiple warnings for multiple non-optimal values', () => {
      const config = createValidConfig();
      config.maxSessions = 75;
      config.stealthEnabled = false;
      const result = checkConfigHealth(config);

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('edge cases', () => {
    it('should handle config at boundary values', () => {
      const config = createValidConfig();
      config.maxSessions = 50; // at warning threshold
      config.browserTimeout = 120000; // at warning threshold
      const result = checkConfigHealth(config);

      expect(result.success).toBe(true);
    });

    it('should handle null config', () => {
      const result = checkConfigHealth(null);

      expect(result.success).toBe(false);
    });

    it('should handle undefined config', () => {
      const result = checkConfigHealth(undefined);

      expect(result.success).toBe(false);
    });

    it('should handle empty object', () => {
      const result = checkConfigHealth({});

      expect(result.success).toBe(false);
    });
  });
});

describe('validateConfigDetailed', () => {
  const createValidConfig = (): ConfigInput => ({
    notebookUrl: '',
    headless: true,
    browserTimeout: 30000,
    viewport: { width: 1024, height: 768 },
    maxSessions: 10,
    sessionTimeout: 900,
    autoLoginEnabled: false,
    loginEmail: '',
    loginPassword: '',
    autoLoginTimeoutMs: 120000,
    stealthEnabled: true,
    stealthRandomDelays: true,
    stealthHumanTyping: true,
    stealthMouseMovements: true,
    typingWpmMin: 160,
    typingWpmMax: 240,
    minDelayMs: 100,
    maxDelayMs: 400,
    configDir: '/path/to/config',
    dataDir: '/path/to/data',
    browserStateDir: '/path/to/browser',
    chromeProfileDir: '/path/to/chrome',
    chromeInstancesDir: '/path/to/instances',
    notebookDescription: 'Test notebook',
    notebookTopics: ['test'],
    notebookContentTypes: ['docs'],
    notebookUseCases: ['testing'],
    profileStrategy: 'auto',
    cloneProfileOnIsolated: false,
    cleanupInstancesOnStartup: true,
    cleanupInstancesOnShutdown: true,
    instanceProfileTtlHours: 72,
    instanceProfileMaxCount: 20,
  });

  describe('successful validation', () => {
    it('should return success with data', () => {
      const config = createValidConfig();
      const result: ConfigValidationResult = validateConfigDetailed(config);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toBeInstanceOf(Array);
    });

    it('should include validated data in result', () => {
      const config = createValidConfig();
      const result = validateConfigDetailed(config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.headless).toBe(true);
        expect(result.data?.maxSessions).toBe(10);
      }
    });
  });

  describe('failed validation', () => {
    it('should return failure with error details', () => {
      const config = createValidConfig();
      config.browserTimeout = -1000;
      const result: ConfigValidationResult = validateConfigDetailed(config);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toEqual(['browserTimeout']);
      expect(result.errors[0].message).toBeDefined();
      expect(result.errors[0].code).toBeDefined();
    });

    it('should include multiple errors for multiple issues', () => {
      const config = createValidConfig();
      config.browserTimeout = -1000;
      config.maxSessions = -5;
      config.sessionTimeout = 30;
      const result = validateConfigDetailed(config);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('detailed warnings', () => {
    it('should include warning codes', () => {
      const config = createValidConfig();
      config.maxSessions = 75;
      const result = validateConfigDetailed(config);

      expect(result.success).toBe(true);
      if (result.success) {
        const maxSessionsWarning = result.warnings.find((w) => w.path.includes('maxSessions'));
        expect(maxSessionsWarning?.code).toBe('HIGH_MAX_SESSIONS');
      }
    });

    it('should include warning paths', () => {
      const config = createValidConfig();
      config.maxSessions = 75;
      const result = validateConfigDetailed(config);

      expect(result.success).toBe(true);
      if (result.success) {
        const maxSessionsWarning = result.warnings.find((w) => w.path.includes('maxSessions'));
        expect(maxSessionsWarning?.path).toEqual(['maxSessions']);
      }
    });

    it('should warn about auto-login without credentials', () => {
      const config = createValidConfig();
      config.autoLoginEnabled = true;
      config.loginEmail = '';
      const result = validateConfigDetailed(config);

      expect(result.success).toBe(true);
      if (result.success) {
        const autoLoginWarning = result.warnings.find(
          (w) => w.code === 'AUTO_LOGIN_NO_CREDENTIALS'
        );
        expect(autoLoginWarning).toBeDefined();
        expect(autoLoginWarning?.message).toContain('loginEmail');
      }
    });
  });

  describe('warning codes', () => {
    it('should use HIGH_MAX_SESSIONS code', () => {
      const config = createValidConfig();
      config.maxSessions = 75;
      const result = validateConfigDetailed(config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.warnings.some((w) => w.code === 'HIGH_MAX_SESSIONS')).toBe(true);
      }
    });

    it('should use HIGH_BROWSER_TIMEOUT code', () => {
      const config = createValidConfig();
      config.browserTimeout = 180000;
      const result = validateConfigDetailed(config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.warnings.some((w) => w.code === 'HIGH_BROWSER_TIMEOUT')).toBe(true);
      }
    });

    it('should use STEALTH_DISABLED code', () => {
      const config = createValidConfig();
      config.stealthEnabled = false;
      const result = validateConfigDetailed(config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.warnings.some((w) => w.code === 'STEALTH_DISABLED')).toBe(true);
      }
    });

    it('should use LOW_SESSION_TIMEOUT code', () => {
      const config = createValidConfig();
      config.sessionTimeout = 180;
      const result = validateConfigDetailed(config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.warnings.some((w) => w.code === 'LOW_SESSION_TIMEOUT')).toBe(true);
      }
    });

    it('should use HIGH_INSTANCE_MAX_COUNT code', () => {
      const config = createValidConfig();
      config.instanceProfileMaxCount = 75;
      const result = validateConfigDetailed(config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.warnings.some((w) => w.code === 'HIGH_INSTANCE_MAX_COUNT')).toBe(true);
      }
    });
  });
});
