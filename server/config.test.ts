import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.ts';

describe('loadConfig', () => {
  it('applies defaults when the environment is empty', () => {
    const config = loadConfig({});
    expect(config).toMatchObject({
      PORT: 3000,
      HOST: '127.0.0.1',
      DB_PATH: './data/ogame.sqlite',
      UNIVERSE_SPEED: 1,
      GALAXIES: 9,
      SYSTEMS: 499,
      SERVE_WEB: true,
    });
  });

  it('parses provided values', () => {
    const config = loadConfig({
      PORT: '8080',
      HOST: '0.0.0.0',
      UNIVERSE_SPEED: '8',
      SERVE_WEB: 'false',
    });
    expect(config.PORT).toBe(8080);
    expect(config.HOST).toBe('0.0.0.0');
    expect(config.UNIVERSE_SPEED).toBe(8);
    expect(config.SERVE_WEB).toBe(false);
  });

  it('rejects a non-positive UNIVERSE_SPEED with a clear message', () => {
    expect(() => loadConfig({ UNIVERSE_SPEED: '0' })).toThrow(/UNIVERSE_SPEED/);
    expect(() => loadConfig({ UNIVERSE_SPEED: '-2' })).toThrow(/Invalid configuration/);
  });

  it('rejects a non-numeric PORT', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(/PORT/);
  });

  it('rejects an unparseable SERVE_WEB', () => {
    expect(() => loadConfig({ SERVE_WEB: 'maybe' })).toThrow(/SERVE_WEB/);
  });
});
