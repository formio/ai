// Content contract for the build lane and the enrichment rules: the pipeline order,
// the conversion classes, overlay provenance, the allow-list, and the line between
// what this skill documents and what it links to.

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const skillDir = join(repoRoot, 'plugin/skills/formio-pdf-form');
const read = (rel: string) => readFileSync(join(skillDir, rel), 'utf8');

function allDocs(dir = skillDir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return allDocs(full);
    return entry.name.endsWith('.md') ? [full] : [];
  });
}

const ALLOW_LIST = [
  'textfield',
  'number',
  'password',
  'email',
  'phoneNumber',
  'currency',
  'checkbox',
  'signature',
  'select',
  'textarea',
  'datetime',
  'file',
  'htmlelement',
  'signrequestsignature',
];

describe('build lane', () => {
  const build = () => read('references/build.md');

  it('runs collect → inspect → upload → classify → enrich → gate → save in order', () => {
    const headings = ['Collect', 'Inspect', 'Upload', 'Classify', 'Enrich', 'Gate', 'Save'].map(
      (step) => build().search(new RegExp(`^## \\d\\. ${step}`, 'm'))
    );
    expect(headings.every((index) => index >= 0)).toBe(true);
    expect([...headings].sort((a, b) => a - b)).toEqual(headings);
  });

  it('names the tools it calls', () => {
    expect(build()).toContain('`pdf_upload`');
    expect(build()).toContain('`form_create`');
  });

  it('documents the three conversion classes and the empty-conversion off-ramps', () => {
    expect(build()).toContain('nonFillableConversionUsed');
    expect(build()).toMatch(/AcroForm transfer/);
    expect(build()).toMatch(/recognized/i);
    expect(build()).toMatch(/exactly two off-ramps/i);
  });

  it('creates the form once, already enriched, and saves nothing on a declined gate', () => {
    expect(build()).toMatch(/exactly once/i);
    expect(build()).toMatch(/declined gate saves nothing/i);
    expect(build()).toMatch(/derived `pdf` object/);
  });

  it('lets an available PDF skill help the inspect step, and never installs one', () => {
    expect(build()).toMatch(/already available/i);
    expect(build()).toMatch(/never install/i);
  });
});

describe('enrichment rules', () => {
  const enrich = () => read('references/enrich.md');

  it('orders label sources: server label, then acroform tooltip, then the page', () => {
    const text = enrich();
    const server = text.search(/server already made human-readable/);
    const tooltip = text.search(/`tooltip`/);
    const page = text.search(/inspect notes/);
    expect(server).toBeGreaterThanOrEqual(0);
    expect(tooltip).toBeGreaterThan(server);
    expect(page).toBeGreaterThan(tooltip);
  });

  it('orders required-flag sources: conversion, then acroform, then a visible marker', () => {
    expect(enrich()).toMatch(/`validate\.required` from the conversion[^.]*`required`[^.]*marker/);
  });

  it('keeps a PDF radio group as checkbox radios with their shared name', () => {
    expect(enrich()).toContain('inputType: "radio"');
    expect(enrich()).toMatch(/shared `name`/);
    expect(enrich()).toMatch(/not.{0,40}`radio` component/i);
  });

  it('lists the PDF overlay allow-list and states the hidden downgrade', () => {
    for (const type of ALLOW_LIST) {
      expect(enrich(), `${type} missing`).toContain(`\`${type}\``);
    }
    expect(enrich()).toMatch(/rewrites any other input type to `hidden`/);
  });

  it('states overlay provenance, as SKILL.md does', () => {
    for (const text of [enrich(), read('SKILL.md')]) {
      expect(text).toMatch(/verbatim from a PDF-server conversion/);
    }
  });

  it('defines the gate table', () => {
    expect(enrich()).toMatch(
      /\| Field \| Label \(source\) \| Key \| Type \| Validation \| Condition \|/
    );
  });
});

describe('what the skill links to instead of documenting', () => {
  it('links formio-form for conditional and validation semantics, and the links resolve', () => {
    const enrich = read('references/enrich.md');
    for (const ref of ['conditionals.md', 'validation.md']) {
      const link = `../../formio-form/references/${ref}`;
      expect(enrich).toContain(link);
      expect(existsSync(join(skillDir, 'references', link))).toBe(true);
    }
  });

  it('documents no conditional, validate.json, or calculateValue syntax of its own', () => {
    for (const path of allDocs()) {
      const fences = readFileSync(path, 'utf8').match(/```[\s\S]*?```/g) ?? [];
      for (const fence of fences) {
        expect(fence, path).not.toMatch(/"conditional"|"calculateValue"|"json"\s*:/);
      }
    }
  });

  it('carries no package-install command and no unrouted upload path', () => {
    for (const path of allDocs()) {
      const text = readFileSync(path, 'utf8');
      expect(text, path).not.toMatch(/\b(pip3?|npm|pnpm|yarn|brew|apt(-get)?) (install|add)\b/);
      expect(text, path).not.toMatch(/npx skills add/);
      expect(text, path).not.toContain('pdf-proxy/upload');
    }
  });
});
