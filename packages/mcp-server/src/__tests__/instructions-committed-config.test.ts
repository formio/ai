import { describe, expect, it } from 'vitest';
import { SERVER_INSTRUCTIONS } from '../server.js';
import { COMMITTED_CONFIG_FILE } from '../committed-config.js';

// The instructions are the only configuration guidance a stand-alone agent gets,
// so a source it cannot learn about here is a source it will never use.
describe('the instructions describe the committed configuration', () => {
  it('names the file', () => {
    expect(SERVER_INSTRUCTIONS).toContain(COMMITTED_CONFIG_FILE);
  });

  it('says it is versioned with the code', () => {
    expect(SERVER_INSTRUCTIONS).toMatch(/commit|version|tracked/i);
  });

  // Bounded rather than period-delimited: the sentence carries a JSON example
  // whose `"..."` placeholders are dots.
  it('states the precedence order, committed before mapping before environment', () => {
    expect(SERVER_INSTRUCTIONS).toMatch(
      new RegExp(`${COMMITTED_CONFIG_FILE}[\\s\\S]{0,240}mapping[\\s\\S]{0,160}environment`, 'i')
    );
  });

  it('no longer claims FORMIO_PROJECT_URL pins the server', () => {
    expect(SERVER_INSTRUCTIONS).not.toMatch(/FORMIO_PROJECT_URL is the opposite — it pins/);
    expect(SERVER_INSTRUCTIONS).not.toMatch(/project_set cannot redirect it/);
  });
});
