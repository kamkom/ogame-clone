import { z } from 'zod';

// A boolean parsed from an env string: "true"/"1"/"yes"/"on" are true, "false"/"0"/"no"/"off" false.
const TRUE_VALUES = ['true', '1', 'yes', 'on'];
const FALSE_VALUES = ['false', '0', 'no', 'off'];

const envBool = (defaultValue: boolean) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (v === undefined) return defaultValue;
      const s = v.trim().toLowerCase();
      if (TRUE_VALUES.includes(s)) return true;
      if (FALSE_VALUES.includes(s)) return false;
      ctx.addIssue({ code: 'custom', message: `expected a boolean, got "${v}"` });
      return z.NEVER;
    });

// An integer env var with a default and a minimum.
const envInt = (defaultValue: number, min: number) =>
  z.coerce.number().int().min(min).default(defaultValue);

export const configSchema = z.object({
  PORT: envInt(3000, 1),
  HOST: z.string().min(1).default('127.0.0.1'),
  DB_PATH: z.string().min(1).default('./data/ogame.sqlite'),
  UNIVERSE_SPEED: z.coerce.number().positive().default(1),
  GALAXIES: envInt(9, 1),
  SYSTEMS: envInt(499, 1),
  SERVE_WEB: envBool(true),
});

export type Config = z.infer<typeof configSchema>;

/**
 * Validate the environment once, at startup. Throws with a readable, multi-line
 * message listing every invalid variable so the operator can fix them all at once.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    const lines = result.error.issues.map((issue) => {
      const key = issue.path.join('.') || '(root)';
      return `  - ${key}: ${issue.message}`;
    });
    throw new Error(`Invalid configuration:\n${lines.join('\n')}`);
  }
  return result.data;
}
