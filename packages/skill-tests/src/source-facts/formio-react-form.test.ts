// What formio-react-form tells an agent about FormioProvider and wizard page
// events, checked against @formio/react 6.2.x (contexts/FormioContext.tsx,
// components/Form.tsx): the provider's `Formio` prop is the SDK class, and the
// page handlers' declared type disagrees with the payload the Wizard emits.

import { describe, expect, it } from 'vitest';
import { skillReader } from './skill-text.js';

const read = skillReader('formio-react/formio-react-form');

describe('provider.md', () => {
  const doc = read('references/provider.md');

  it('says the Formio prop takes the static class, not an instance', () => {
    expect(doc).not.toMatch(/accepts a `Formio` instance/);
    expect(doc).toMatch(/takes the SDK \*\*class\*\*/);
  });

  it('says a second provider does not isolate a second deployment', () => {
    expect(doc).toMatch(/share one configuration/);
  });
});

describe('mounting.md wizard handlers', () => {
  const doc = read('references/mounting.md');

  it('neither page handler destructures { page } from its argument', () => {
    expect(doc).not.toMatch(/on(Next|Prev)Page=\{\(\{ page \}\)/);
    expect(doc).toMatch(/onNextPage=\{\(\) => setPage\(wizard\.current\?\.page \?\? 0\)\}/);
  });
});
