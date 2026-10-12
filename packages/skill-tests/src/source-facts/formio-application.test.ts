// Framework selection runs through FRAMEWORK.md's registry, which has more than
// one row. Wording that presents Angular as the only framework routes an agent
// past the registry.

import { describe, expect, it } from 'vitest';
import { readSkillFile } from './skill-text.js';

const read = readSkillFile;

describe('framework wording names the registry', () => {
  it.each(['formio-application/INTENT.md', 'formio-angular/SKILL.md'])(
    '%s does not present Angular as the only framework',
    (path) => {
      const text = read(path);
      expect(text).not.toMatch(/Angular today/);
      expect(text).not.toMatch(/`formio-angular` today/);
      expect(text).toMatch(/FRAMEWORK\.md/);
    }
  );
});
