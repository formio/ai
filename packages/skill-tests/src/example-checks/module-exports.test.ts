import { describe, expect, it } from 'vitest';
import { exportsOf } from './module-exports.js';

describe('exportsOf', () => {
  it('reads @formio/js from its declarations', () => {
    const names = exportsOf('@formio/js');
    expect(names).toContain('Formio');
    expect(names).toContain('Webform');
    expect(names).not.toContain('login');
  });

  it('reads a subpath that has no types condition of its own', () => {
    expect(exportsOf('@formio/js/utils')).toContain('Utils');
  });

  it('reads @formio/core and @formio/react', () => {
    expect(exportsOf('@formio/core')).toContain('jsonLogic');
    expect(exportsOf('@formio/react')).toContain('FormioProvider');
  });

  it('reports a module it cannot resolve as undefined', () => {
    expect(exportsOf('@formio/not-a-package')).toBeUndefined();
  });
});
