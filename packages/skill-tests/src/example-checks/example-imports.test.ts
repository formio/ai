// Every name a skill example imports from a Form.io package is one the installed
// package exports. An example that imports a name the package does not have
// teaches an agent to write code that fails at its first line.

import { describe, expect, it } from 'vitest';
import { importProblems } from './import-problems.js';
import { skillExamples } from './skill-examples.js';

const example = (code: string) => ({
  doc: 'ref.md',
  index: 2,
  lang: 'ts' as const,
  line: 40,
  code,
  fragment: false,
});

describe('importProblems', () => {
  it('names the document, example, and missing export', () => {
    expect(importProblems([example("import { Formio, login } from '@formio/js';")])).toEqual([
      'ref.md example 2 (line 40): @formio/js exports no login',
    ]);
  });

  it('names a Form.io module that does not resolve', () => {
    expect(importProblems([example("import { x } from '@formio/js/nothing-here';")])).toEqual([
      'ref.md example 2 (line 40): @formio/js/nothing-here does not resolve',
    ]);
  });

  it('ignores packages it does not check', () => {
    expect(importProblems([example("import React from 'react';")])).toEqual([]);
  });
});

describe('skill examples import what the installed packages export', () => {
  const examples = skillExamples();

  it('finds examples to check', () => {
    expect(examples.length).toBeGreaterThan(100);
  });

  it('every checked import resolves to an export', () => {
    expect(importProblems(examples)).toEqual([]);
  });
});
