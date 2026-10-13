// Form.io's PUT (resourcejs) loads the stored document and sets the body onto it, so
// a top-level field the body leaves out keeps its stored value, and an array or
// object the body carries is stored as given rather than merged. The update tools
// describe that, not a full replacement that would drop omitted fields.

import { describe, expect, it } from 'vitest';
import { registerAllTools } from '../tools/index.js';
import { connectTools, TEST_CONFIG } from './test-helpers.js';

describe('update tools describe what Form.io keeps', () => {
  it.each(['form_update', 'role_update', 'action_update'])(
    '%s says omitted fields keep their stored value',
    async (name) => {
      const client = await connectTools((server) => registerAllTools(server, TEST_CONFIG));
      const { tools } = await client.listTools();
      const description = tools.find((tool) => tool.name === name)?.description ?? '';

      expect(description).not.toMatch(/full replacement|^Replace/i);
      expect(description).toMatch(/left out keep/);
      // Arrays and objects are replaced whole, said once and briefly: the sentence
      // repeats on three tools in a list every client reads on connect.
      expect(description).toMatch(/arrays and objects (are replaced )?whole/i);
      expect(description).not.toMatch(/stored as given, not merged/);
    }
  );
});
