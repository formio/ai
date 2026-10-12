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

// The SDK keeps one token per namespace and sends it with every request whatever
// the host, so a form loaded by full URL from another deployment receives the
// first deployment's end-user token.
describe('a second deployment', () => {
  it('is not reached by passing full URLs through the same SDK', () => {
    const doc = read('references/provider.md');
    expect(doc).not.toMatch(/reach one by passing full URLs/);
    expect(doc).toMatch(/sends? (it|that token) with every request/);
  });
});
