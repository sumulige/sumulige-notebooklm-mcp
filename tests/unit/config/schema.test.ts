/**
 * Tests for Config Schema
 *
 * Tests Zod schema validation including:
 * - Type validation
 * - Range constraints
 * - Logical constraints (min <= max)
 * - Enum validation
 */

import { describe, it, expect } from 'vitest';
import {
  ConfigSchema,
  ProfileStrategyEnum,
  ViewportSchema,
  validateConfig,
  type ConfigInput,
  type ConfigOutput,
} from '@/config/schema.js';

describe('ConfigSchema', () => {
  // A valid minimal config for testing
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

  describe('basic validation', () => {
    it('should accept valid configuration', () => {
      const config = createValidConfig();
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(true);
    });

    it('should use defaults for optional fields', () => {
      const minimalConfig = {
        configDir: '/path/to/config',
        dataDir: '/path/to/data',
        browserStateDir: '/path/to/browser',
        chromeProfileDir: '/path/to/chrome',
        chromeInstancesDir: '/path/to/instances',
      };

      const result = ConfigSchema.safeParse(minimalConfig);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.headless).toBe(true);
        expect(result.data.browserTimeout).toBe(30000);
        expect(result.data.maxSessions).toBe(10);
      }
    });
  });

  describe('browser settings validation', () => {
    it('should accept valid browser timeout', () => {
      const config = createValidConfig();
      config.browserTimeout = 60000;
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(true);
    });

    it('should reject negative browser timeout', () => {
      const config = createValidConfig();
      config.browserTimeout = -1000;
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('positive');
      }
    });

    it('should reject browser timeout exceeding maximum', () => {
      const config = createValidConfig();
      config.browserTimeout = 400000;
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('300000');
      }
    });

    it('should reject non-integer browser timeout', () => {
      const config = createValidConfig();
      config.browserTimeout = 30000.5;
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('integer');
      }
    });
  });

  describe('viewport validation', () => {
    it('should accept valid viewport dimensions', () => {
      const viewport = { width: 1920, height: 1080 };
      const result = ViewportSchema.safeParse(viewport);

      expect(result.success).toBe(true);
    });

    it('should reject width below minimum', () => {
      const viewport = { width: 300, height: 1080 };
      const result = ViewportSchema.safeParse(viewport);

      expect(result.success).toBe(false);
    });

    it('should reject width above maximum', () => {
      const viewport = { width: 4000, height: 1080 };
      const result = ViewportSchema.safeParse(viewport);

      expect(result.success).toBe(false);
    });

    it('should reject height below minimum', () => {
      const viewport = { width: 1920, height: 200 };
      const result = ViewportSchema.safeParse(viewport);

      expect(result.success).toBe(false);
    });

    it('should reject height above maximum', () => {
      const viewport = { width: 1920, height: 3000 };
      const result = ViewportSchema.safeParse(viewport);

      expect(result.success).toBe(false);
    });

    it('should reject non-integer dimensions', () => {
      const viewport = { width: 1920.5, height: 1080 };
      const result = ViewportSchema.safeParse(viewport);

      expect(result.success).toBe(false);
    });
  });

  describe('session management validation', () => {
    it('should accept valid max sessions', () => {
      const config = createValidConfig();
      config.maxSessions = 50;
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(true);
    });

    it('should reject max sessions below minimum', () => {
      const config = createValidConfig();
      config.maxSessions = 0;
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(false);
    });

    it('should reject max sessions above maximum', () => {
      const config = createValidConfig();
      config.maxSessions = 150;
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(false);
    });

    it('should accept valid session timeout', () => {
      const config = createValidConfig();
      config.sessionTimeout = 1800;
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(true);
    });

    it('should reject session timeout below minimum', () => {
      const config = createValidConfig();
      config.sessionTimeout = 30;
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(false);
    });

    it('should reject session timeout above maximum', () => {
      const config = createValidConfig();
      config.sessionTimeout = 100000;
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(false);
    });
  });

  describe('stealth settings validation', () => {
    it('should accept valid typing WPM range', () => {
      const config = createValidConfig();
      config.typingWpmMin = 100;
      config.typingWpmMax = 200;
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(true);
    });

    it('should accept equal min and max typing WPM', () => {
      const config = createValidConfig();
      config.typingWpmMin = 150;
      config.typingWpmMax = 150;
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(true);
    });

    it('should reject typing WPM min above max', () => {
      const config = createValidConfig();
      config.typingWpmMin = 300;
      config.typingWpmMax = 200;
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessages = result.error.errors.map((e) => e.message);
        expect(errorMessages.some((m) => m.includes('typingWpmMin'))).toBe(true);
      }
    });

    it('should reject typing WPM min below minimum', () => {
      const config = createValidConfig();
      config.typingWpmMin = 30;
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(false);
    });

    it('should reject typing WPM max above maximum', () => {
      const config = createValidConfig();
      config.typingWpmMax = 400;
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(false);
    });

    it('should accept valid delay range', () => {
      const config = createValidConfig();
      config.minDelayMs = 50;
      config.maxDelayMs = 500;
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(true);
    });

    it('should reject delay min above max', () => {
      const config = createValidConfig();
      config.minDelayMs = 1000;
      config.maxDelayMs = 500;
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessages = result.error.errors.map((e) => e.message);
        expect(errorMessages.some((m) => m.includes('minDelayMs'))).toBe(true);
      }
    });

    it('should reject negative delay values', () => {
      const config = createValidConfig();
      config.minDelayMs = -100;
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(false);
    });
  });

  describe('profile strategy validation', () => {
    it('should accept valid profile strategies', () => {
      const strategies = ['auto', 'single', 'isolated'] as const;

      for (const strategy of strategies) {
        const config = createValidConfig();
        config.profileStrategy = strategy;
        const result = ConfigSchema.safeParse(config);

        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid profile strategy', () => {
      const config = createValidConfig();
      config.profileStrategy = 'invalid';
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(false);
    });

    it('should provide helpful error message for invalid strategy', () => {
      const result = ProfileStrategyEnum.safeParse('invalid');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('auto');
        expect(result.error.message).toContain('single');
        expect(result.error.message).toContain('isolated');
      }
    });
  });

  describe('instance management validation', () => {
    it('should accept valid instance TTL', () => {
      const config = createValidConfig();
      config.instanceProfileTtlHours = 48;
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(true);
    });

    it('should reject instance TTL below minimum', () => {
      const config = createValidConfig();
      config.instanceProfileTtlHours = 0;
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(false);
    });

    it('should reject instance TTL above maximum', () => {
      const config = createValidConfig();
      config.instanceProfileTtlHours = 1000;
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(false);
    });

    it('should accept valid instance max count', () => {
      const config = createValidConfig();
      config.instanceProfileMaxCount = 30;
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(true);
    });

    it('should reject instance max count below minimum', () => {
      const config = createValidConfig();
      config.instanceProfileMaxCount = 0;
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(false);
    });

    it('should reject instance max count above maximum', () => {
      const config = createValidConfig();
      config.instanceProfileMaxCount = 150;
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(false);
    });
  });

  describe('path validation', () => {
    it('should accept valid paths', () => {
      const config = createValidConfig();
      config.configDir = '/valid/path';
      config.dataDir = '/valid/data';
      config.browserStateDir = '/valid/browser';
      config.chromeProfileDir = '/valid/chrome';
      config.chromeInstancesDir = '/valid/instances';
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(true);
    });

    it('should reject empty configDir', () => {
      const config = createValidConfig();
      config.configDir = '';
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(false);
    });

    it('should reject empty dataDir', () => {
      const config = createValidConfig();
      config.dataDir = '';
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(false);
    });
  });

  describe('validateConfig helper', () => {
    it('should return success for valid config', () => {
      const config = createValidConfig();
      const result = validateConfig(config);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for invalid config', () => {
      const config = createValidConfig();
      config.browserTimeout = -1000;
      config.maxSessions = 0;
      const result = validateConfig(config);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].path).toBeDefined();
      expect(result.errors[0].message).toBeDefined();
    });

    it('should format error paths correctly', () => {
      const config = createValidConfig();
      config.browserTimeout = -1000;
      const result = validateConfig(config);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].path).toEqual(['browserTimeout']);
      }
    });
  });

  describe('type inference', () => {
    it('should infer correct types from schema', () => {
      const config = createValidConfig();
      const result = ConfigSchema.safeParse(config);

      expect(result.success).toBe(true);
      if (result.success) {
        const data: ConfigOutput = result.data;

        // Type checking - these should compile without errors
        expect(typeof data.headless).toBe('boolean');
        expect(typeof data.browserTimeout).toBe('number');
        expect(typeof data.profileStrategy).toBe('string');

        // profileStrategy should be narrowed to the union type
        const validStrategies: Array<'auto' | 'single' | 'isolated'> = [
          'auto',
          'single',
          'isolated',
        ];
        expect(validStrategies).toContain(data.profileStrategy);
      }
    });
  });
});
