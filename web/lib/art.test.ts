import { SHIPS, STRUCTURES, TECHNOLOGIES } from '#shared/catalog.ts';
import { blueprintFor, iconFor, illustrationFor, silhouetteFor } from './art.ts';

describe('catalog art', () => {
  it('gives every Structure its own icon and illustration', () => {
    const icons = STRUCTURES.map((s) => iconFor(s.art));
    const scenes = STRUCTURES.map((s) => illustrationFor(s.art));
    expect(new Set(icons).size).toBe(STRUCTURES.length);
    expect(new Set(scenes).size).toBe(STRUCTURES.length);
  });

  it('gives every Technology its own icon', () => {
    const icons = TECHNOLOGIES.map((t) => iconFor(t.icon));
    expect(new Set(icons).size).toBe(TECHNOLOGIES.length);
  });

  it('gives every ship its own silhouette and blueprint', () => {
    const silhouettes = SHIPS.map((s) => silhouetteFor(s.art));
    const blueprints = SHIPS.map((s) => blueprintFor(s.art));
    expect(new Set(silhouettes).size).toBe(SHIPS.length);
    expect(new Set(blueprints).size).toBe(SHIPS.length);
  });

  it('draws the new items too', () => {
    for (const key of ['depot', 'vault', 'tank', 'terraformer', 'satellite']) {
      expect(iconFor(key).stroke).not.toBe('');
    }
    expect(illustrationFor('terraformer').main).not.toBe('');
    expect(silhouetteFor('Solar Satellite').hull).not.toBe('');
    expect(blueprintFor('Solar Satellite').callout.label).toBe('PANEL');
  });

  it('throws for a key with no art, so a gap fails loudly', () => {
    expect(() => iconFor('nope')).toThrow(/nope/);
    expect(() => blueprintFor('nope')).toThrow(/nope/);
  });
});
