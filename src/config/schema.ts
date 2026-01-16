/**
 * Configuration Schema Definition
 *
 * Uses Zod for runtime validation and type inference.
 * Provides validation rules for all configuration values.
 */

import { z } from 'zod';

/**
 * Profile strategy enum
 */
export const ProfileStrategyEnum = z.enum(['auto', 'single', 'isolated'], {
  errorMap: () => ({ message: 'Must be one of: auto, single, isolated' }),
});

/**
 * Viewport schema with min/max bounds
 */
export const ViewportSchema = z.object({
  width: z
    .number({
      errorMap: () => ({ message: 'Viewport width must be a number' }),
    })
    .int({ message: 'Viewport width must be an integer' })
    .min(320, { message: 'Viewport width must be at least 320px' })
    .max(3840, { message: 'Viewport width must not exceed 3840px (4K)' }),

  height: z
    .number({
      errorMap: () => ({ message: 'Viewport height must be a number' }),
    })
    .int({ message: 'Viewport height must be an integer' })
    .min(240, { message: 'Viewport height must be at least 240px' })
    .max(2160, { message: 'Viewport height must not exceed 2160px (4K)' }),
});

/**
 * Full configuration schema with all validation rules
 */
export const ConfigSchema = z
  .object({
    // NotebookLM - optional, used for legacy default notebook
    notebookUrl: z.string().default(''),

    // Browser Settings
    headless: z.boolean().default(true),
    browserTimeout: z
      .number({
        required_error: 'Browser timeout is required',
        invalid_type_error: 'Browser timeout must be a number',
      })
      .int({ message: 'Browser timeout must be an integer' })
      .positive({ message: 'Browser timeout must be positive' })
      .max(300000, { message: 'Browser timeout must not exceed 300000ms (5 minutes)' })
      .default(30000),

    viewport: ViewportSchema.default({ width: 1024, height: 768 }),

    // Session Management
    maxSessions: z
      .number({
        required_error: 'Max sessions is required',
        invalid_type_error: 'Max sessions must be a number',
      })
      .int({ message: 'Max sessions must be an integer' })
      .min(1, { message: 'Max sessions must be at least 1' })
      .max(100, { message: 'Max sessions must not exceed 100' })
      .default(10),

    sessionTimeout: z
      .number({
        required_error: 'Session timeout is required',
        invalid_type_error: 'Session timeout must be a number',
      })
      .int({ message: 'Session timeout must be an integer' })
      .min(60, { message: 'Session timeout must be at least 60 seconds' })
      .max(86400, { message: 'Session timeout must not exceed 86400 seconds (24 hours)' })
      .default(900),

    // Authentication
    autoLoginEnabled: z.boolean().default(false),
    loginEmail: z
      .string()
      .refine((val) => val === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
        message: 'Invalid email format',
      })
      .default(''),
    loginPassword: z.string().default(''),
    autoLoginTimeoutMs: z
      .number({
        required_error: 'Auto login timeout is required',
        invalid_type_error: 'Auto login timeout must be a number',
      })
      .int({ message: 'Auto login timeout must be an integer' })
      .positive({ message: 'Auto login timeout must be positive' })
      .max(600000, { message: 'Auto login timeout must not exceed 600000ms (10 minutes)' })
      .default(120000),

    // Stealth Settings
    stealthEnabled: z.boolean().default(true),
    stealthRandomDelays: z.boolean().default(true),
    stealthHumanTyping: z.boolean().default(true),
    stealthMouseMovements: z.boolean().default(true),

    typingWpmMin: z
      .number({
        required_error: 'Typing WPM min is required',
        invalid_type_error: 'Typing WPM min must be a number',
      })
      .int({ message: 'Typing WPM min must be an integer' })
      .min(40, { message: 'Typing WPM min must be at least 40' })
      .max(200, { message: 'Typing WPM min must not exceed 200' })
      .default(160),

    typingWpmMax: z
      .number({
        required_error: 'Typing WPM max is required',
        invalid_type_error: 'Typing WPM max must be a number',
      })
      .int({ message: 'Typing WPM max must be an integer' })
      .min(40, { message: 'Typing WPM max must be at least 40' })
      .max(300, { message: 'Typing WPM max must not exceed 300' })
      .default(240),

    minDelayMs: z
      .number({
        required_error: 'Min delay is required',
        invalid_type_error: 'Min delay must be a number',
      })
      .int({ message: 'Min delay must be an integer' })
      .min(0, { message: 'Min delay must be non-negative' })
      .max(10000, { message: 'Min delay must not exceed 10000ms' })
      .default(100),

    maxDelayMs: z
      .number({
        required_error: 'Max delay is required',
        invalid_type_error: 'Max delay must be a number',
      })
      .int({ message: 'Max delay must be an integer' })
      .min(0, { message: 'Max delay must be non-negative' })
      .max(30000, { message: 'Max delay must not exceed 30000ms' })
      .default(400),

    // Paths
    configDir: z.string().min(1, { message: 'Config dir path is required' }),
    dataDir: z.string().min(1, { message: 'Data dir path is required' }),
    browserStateDir: z.string().min(1, { message: 'Browser state dir path is required' }),
    chromeProfileDir: z.string().min(1, { message: 'Chrome profile dir path is required' }),
    chromeInstancesDir: z.string().min(1, { message: 'Chrome instances dir path is required' }),

    // Library Configuration
    notebookDescription: z.string().default('General knowledge base'),
    notebookTopics: z.array(z.string()).default(['General topics']),
    notebookContentTypes: z.array(z.string()).default(['documentation', 'examples']),
    notebookUseCases: z.array(z.string()).default(['General research']),

    // Multi-instance strategy
    profileStrategy: ProfileStrategyEnum.default('auto'),
    cloneProfileOnIsolated: z.boolean().default(false),
    cleanupInstancesOnStartup: z.boolean().default(true),
    cleanupInstancesOnShutdown: z.boolean().default(true),

    instanceProfileTtlHours: z
      .number({
        required_error: 'Instance TTL is required',
        invalid_type_error: 'Instance TTL must be a number',
      })
      .int({ message: 'Instance TTL must be an integer' })
      .positive({ message: 'Instance TTL must be positive' })
      .max(720, { message: 'Instance TTL must not exceed 720 hours (30 days)' })
      .default(72),

    instanceProfileMaxCount: z
      .number({
        required_error: 'Instance max count is required',
        invalid_type_error: 'Instance max count must be a number',
      })
      .int({ message: 'Instance max count must be an integer' })
      .positive({ message: 'Instance max count must be positive' })
      .max(100, { message: 'Instance max count must not exceed 100' })
      .default(20),
  })
  // Logical constraints: typingWpmMin <= typingWpmMax
  .refine((data) => data.typingWpmMin <= data.typingWpmMax, {
    message: 'typingWpmMin must be less than or equal to typingWpmMax',
    path: ['typingWpmMin'],
  })
  // Logical constraints: minDelayMs <= maxDelayMs
  .refine((data) => data.minDelayMs <= data.maxDelayMs, {
    message: 'minDelayMs must be less than or equal to maxDelayMs',
    path: ['minDelayMs'],
  });

/**
 * Type inference from schema
 */
export type ConfigInput = z.input<typeof ConfigSchema>;
export type ConfigOutput = z.output<typeof ConfigSchema>;

/**
 * Validate a configuration object
 */
export function validateConfig(config: unknown): {
  success: boolean;
  data?: ConfigOutput;
  errors: Array<{ path: string[]; message: string }>;
} {
  const result = ConfigSchema.safeParse(config);

  if (result.success) {
    return {
      success: true,
      data: result.data,
      errors: [],
    };
  }

  return {
    success: false,
    errors: result.error.errors.map((e) => ({
      path: e.path.map(String),
      message: e.message,
    })),
  };
}
