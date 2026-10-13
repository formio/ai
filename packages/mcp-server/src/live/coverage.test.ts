// Runs in the default suite, with no deployment: a tool registered without a live case
// fails here, at review time, rather than going untested against a real project.

import { describe, expect, it } from 'vitest';
import { connectTools, TEST_CONFIG } from '../__tests__/test-helpers.js';
import { registerAllTools } from '../tools/index.js';
import { LIVE_CASES } from './cases.js';
import { coverageGaps } from './guards.js';

describe('live tool coverage', () => {
  it('every registered tool has at least one live case', async () => {
    const client = await connectTools((server) => registerAllTools(server, TEST_CONFIG));
    const { tools } = await client.listTools();
    const gaps = coverageGaps({
      registered: tools.map((tool) => tool.name),
      covered: LIVE_CASES.map((liveCase) => liveCase.tool),
    });
    expect(gaps, `registered tools with no live case in src/live/cases.ts`).toEqual([]);
  });

  it('names every case uniquely', () => {
    const names = LIVE_CASES.map((liveCase) => liveCase.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
