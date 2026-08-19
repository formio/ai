import { describe, it, expect } from 'vitest';
import { SERVER_INSTRUCTIONS } from '../server.js';
import { BASE_URL_UNRESOLVED_GUIDANCE } from '../config.js';

// The instructions are the only guidance a stand-alone agent gets, and the
// resolver now derives a base URL from a sub-directory project URL. What it
// derives is the project URL's PARENT, so a deployment may be mounted at a
// sub-path — guidance that implies otherwise contradicts the server's own
// behavior.
describe('the instructions describe what the resolver actually does', () => {
  it('never claims a Base URL carries no path', () => {
    expect(SERVER_INSTRUCTIONS).not.toMatch(/Base URL never carries a path/i);
    expect(SERVER_INSTRUCTIONS).not.toMatch(/Base URL.{0,40}no path of its own/i);
  });

  // The sub-path fact belongs with the message that asks for a base URL, not with
  // the instructions: a reader of the instructions is being asked for a project URL
  // and never has to reason about how a base URL is composed.
  it('states that a sub-directory project is served by its parent path', () => {
    expect(BASE_URL_UNRESOLVED_GUIDANCE).toMatch(/parent path/i);
    expect(BASE_URL_UNRESOLVED_GUIDANCE).toContain('https://forms.mysite.com/one');
  });

  it('says a path-carrying Project URL yields a derivable Base URL', () => {
    expect(SERVER_INSTRUCTIONS).toMatch(
      /derived by dropping|drop(ping)? its (final|last) (path )?segment/i
    );
  });

  // Still true, and the reason the sub-domain shape is the one that must be
  // asked for rather than guessed.
  it('keeps forbidding derivation from a path-less Project URL', () => {
    expect(BASE_URL_UNRESOLVED_GUIDANCE).toMatch(/carries no path/i);
    expect(BASE_URL_UNRESOLVED_GUIDANCE).toMatch(/Ask the user/i);
  });

  // api.form.io belongs to exactly one of the three shapes, and the resolver
  // reports it as DERIVED rather than defaulted — there is no `default` source. A
  // "default" reads as a guess the server made, which is the wrong-host failure
  // the shape rules refuse, so the instructions must not call it one.
  it('presents api.form.io as derived for hosted-cloud projects, not as a default', () => {
    expect(SERVER_INSTRUCTIONS).toMatch(
      /DERIVED rather than defaulted: https:\/\/api\.form\.io for a project on a form\.io host/i
    );
    expect(SERVER_INSTRUCTIONS).not.toMatch(/defaults to https:\/\/api\.form\.io/i);
  });
});
