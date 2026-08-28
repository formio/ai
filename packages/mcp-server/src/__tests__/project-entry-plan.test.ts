import { describe, expect, it } from 'vitest';
import { planProjectEntry } from '../project-entry-plan.js';

// A record holds a project and its deployment as a PAIR.
//
// Everything this file used to test — a stored pairing, a re-point guard, a carry
// rule, an environment gate keyed on the project's shape — existed because a record
// could hold half a configuration: the base-URL repair wrote a deployment with no
// project, and nothing in that record said which project it belonged to. Answering
// that question at read time needed a binding every writer had to maintain and every
// reader had to police, and three consecutive reviews found the two disagreeing.
//
// The pair removes the question. A write leaves a complete record or it fails; the
// base URL is derived at save time from the project it is stored beside; and a
// project URL that names no deployment must arrive with one, which costs the user
// nothing because the caller answering that report already holds the project URL.
const CWD = '/w/app';

const plan = (overrides: {
  requested?: { projectUrl?: string; baseUrl?: string };
  existing?: { env: Record<string, string> } | null;
  committedProjectUrl?: string;
  environmentProjectUrl?: string;
}) =>
  planProjectEntry({
    cwd: CWD,
    requested: overrides.requested ?? {},
    record: {
      projectUrl: overrides.existing?.env.FORMIO_PROJECT_URL,
      baseUrl: overrides.existing?.env.FORMIO_BASE_URL,
    },
    elsewhere: {
      committed: overrides.committedProjectUrl
        ? { projectUrl: overrides.committedProjectUrl, filePath: `${CWD}/formio.json` }
        : undefined,
      environment: overrides.environmentProjectUrl,
    },
  });

const pair = (projectUrl: string, baseUrl: string) => ({
  env: { FORMIO_PROJECT_URL: projectUrl, FORMIO_BASE_URL: baseUrl },
});

describe('recording a project', () => {
  it('stores the deployment derived for it', () => {
    const result = plan({ requested: { projectUrl: 'https://examples.form.io' } });

    expect(result.outcome === 'write' && result.entry.env).toEqual({
      FORMIO_PROJECT_URL: 'https://examples.form.io',
      FORMIO_BASE_URL: 'https://api.form.io',
    });
  });

  it('derives a sub-directory deployment from the parent path', () => {
    const result = plan({ requested: { projectUrl: 'https://forms.mysite.com/one/two' } });

    expect(result.outcome === 'write' && result.entry.env.FORMIO_BASE_URL).toBe(
      'https://forms.mysite.com/one'
    );
  });

  // The one shape where a supplied deployment is the answer rather than a
  // contradiction: a path-less customer project derives nothing, so the caller's
  // value is the only one there is. Wherever a deployment IS derivable — a hosted
  // project, or one addressed as a sub-directory — a differing value cannot be right
  // and is refused instead of preferred.
  it('records the deployment a caller supplied where none can be derived', () => {
    const result = plan({
      requested: {
        projectUrl: 'https://myproject.mysite.com',
        baseUrl: 'https://api.mysite.com',
      },
    });

    expect(result.outcome === 'write' && result.entry.env.FORMIO_BASE_URL).toBe(
      'https://api.mysite.com'
    );
  });

  it('normalizes both halves', () => {
    const result = plan({
      requested: { projectUrl: 'https://examples.form.io/', baseUrl: 'https://api.form.io/' },
    });

    expect(result.outcome === 'write' && result.entry.env).toEqual({
      FORMIO_PROJECT_URL: 'https://examples.form.io',
      FORMIO_BASE_URL: 'https://api.form.io',
    });
  });

  it('rejects a URL the caller typed', () => {
    expect(() => plan({ requested: { projectUrl: 'not-a-url' } })).toThrow(/projectUrl/);
  });
});

// The one shape derivation cannot answer. Recording the project alone would leave a
// record naming a project and no deployment — half a configuration, which is what
// this design exists to prevent — so the write is refused and says what it needs.
describe('recording a project that names no deployment', () => {
  it('refuses the write rather than storing half a pair', () => {
    const result = plan({ requested: { projectUrl: 'https://myproject.mysite.com' } });

    expect(result.outcome).toBe('base-url-required');
  });

  it('accepts it when the deployment comes with it', () => {
    const result = plan({
      requested: { projectUrl: 'https://myproject.mysite.com', baseUrl: 'https://api.mysite.com' },
    });

    expect(result.outcome === 'write' && result.entry.env).toEqual({
      FORMIO_PROJECT_URL: 'https://myproject.mysite.com',
      FORMIO_BASE_URL: 'https://api.mysite.com',
    });
  });

  it('names the project it could not derive from', () => {
    const result = plan({ requested: { projectUrl: 'https://myproject.mysite.com' } });

    expect(result.outcome === 'base-url-required' && result.projectUrl).toBe(
      'https://myproject.mysite.com'
    );
  });
});

describe('re-pointing a directory', () => {
  it('replaces the whole pair', () => {
    const result = plan({
      requested: { projectUrl: 'https://examples.form.io' },
      existing: pair('https://old.mysite.com', 'https://api.mysite.com'),
    });

    expect(result.outcome === 'write' && result.entry.env).toEqual({
      FORMIO_PROJECT_URL: 'https://examples.form.io',
      FORMIO_BASE_URL: 'https://api.form.io',
    });
  });

  // No carry: the previous deployment belonged to the previous project, and this
  // record now describes a different one.
  it('never carries the previous deployment onto the new project', () => {
    const result = plan({
      requested: {
        projectUrl: 'https://newproj.mysite.com',
        baseUrl: 'https://new-api.mysite.com',
      },
      existing: pair('https://old.mysite.com', 'https://old-api.mysite.com'),
    });

    expect(result.outcome === 'write' && result.entry.env.FORMIO_BASE_URL).toBe(
      'https://new-api.mysite.com'
    );
  });

  it('still refuses when the new project names no deployment', () => {
    const result = plan({
      requested: { projectUrl: 'https://newproj.mysite.com' },
      existing: pair('https://old.mysite.com', 'https://api.mysite.com'),
    });

    expect(result.outcome).toBe('base-url-required');
  });
});

// A deployment alone amends the pair in the record that holds the project. Where the
// project lives somewhere this call cannot write, the write is refused rather than
// leaving a deployment in one record and its project in another.
describe('recording a deployment alone', () => {
  it('updates the pair when the mapping holds the project', () => {
    const result = plan({
      requested: { baseUrl: 'https://new-api.mysite.com' },
      existing: pair('https://myproject.mysite.com', 'https://api.mysite.com'),
    });

    expect(result.outcome === 'write' && result.entry.env).toEqual({
      FORMIO_PROJECT_URL: 'https://myproject.mysite.com',
      FORMIO_BASE_URL: 'https://new-api.mysite.com',
    });
  });

  it('refuses when a committed file holds the project', () => {
    const result = plan({
      requested: { baseUrl: 'https://api.mysite.com' },
      committedProjectUrl: 'https://committed.mysite.com',
    });

    expect(result.outcome).toBe('wrong-record');
    expect(result.outcome === 'wrong-record' && result.record).toBe('committed');
    expect(result.outcome === 'wrong-record' && result.projectUrl).toBe(
      'https://committed.mysite.com'
    );
  });

  it('refuses when only the environment holds the project', () => {
    const result = plan({
      requested: { baseUrl: 'https://api.mysite.com' },
      environmentProjectUrl: 'https://env.mysite.com',
    });

    expect(result.outcome === 'wrong-record' && result.record).toBe('environment');
  });

  it('reports a required project when nothing holds one at all', () => {
    const result = plan({ requested: { baseUrl: 'https://api.mysite.com' } });

    expect(result.outcome).toBe('project-required');
  });
});

describe('what the planner refuses outright', () => {
  it('reports no values when neither URL is supplied', () => {
    expect(plan({}).outcome).toBe('no-values');
  });
});

describe('whether anything changed', () => {
  it('is unchanged when the planned pair matches what is stored', () => {
    const result = plan({
      requested: { projectUrl: 'https://examples.form.io' },
      existing: pair('https://examples.form.io', 'https://api.form.io'),
    });

    expect(result.outcome).toBe('unchanged');
  });

  it('is a write when the deployment differs', () => {
    const result = plan({
      requested: {
        projectUrl: 'https://myproject.mysite.com',
        baseUrl: 'https://api.mysite.com',
      },
      existing: pair('https://myproject.mysite.com', 'https://forms.mysite.com'),
    });

    expect(result.outcome).toBe('write');
  });

  it('reports what the mapping held before, for a caller that says "was X"', () => {
    const result = plan({
      requested: { projectUrl: 'https://new.form.io' },
      existing: pair('https://old.form.io', 'https://api.form.io'),
    });

    expect(result.outcome === 'write' && result.previousProjectUrl).toBe('https://old.form.io');
  });

  // An unusable stored value is data, not the caller's typing, and this write is what
  // repairs it. It must not fail on the value it is replacing.
  it('replaces a stored pair that is not usable', () => {
    const result = plan({
      requested: { projectUrl: 'https://good.mysite.com', baseUrl: 'https://api.mysite.com' },
      existing: { env: { FORMIO_PROJECT_URL: 'not-a-url', FORMIO_BASE_URL: 'also-not-a-url' } },
    });

    expect(result.outcome === 'write' && result.entry.env).toEqual({
      FORMIO_PROJECT_URL: 'https://good.mysite.com',
      FORMIO_BASE_URL: 'https://api.mysite.com',
    });
  });

  it('does not let an unusable stored project stand in for a missing one', () => {
    const result = plan({
      requested: { baseUrl: 'https://api.mysite.com' },
      existing: { env: { FORMIO_PROJECT_URL: 'not-a-url' } },
    });

    expect(result.outcome).toBe('project-required');
  });
});

// The record a caller sends the user to when this call writes no project of its own.
describe('naming the record that holds the project', () => {
  it('names the committed file when that holds it', () => {
    const result = plan({
      requested: { baseUrl: 'https://api.mysite.com' },
      committedProjectUrl: 'https://committed.mysite.com',
      existing: pair('https://mapped.mysite.com', 'https://api.mysite.com'),
    });

    expect(result.outcome === 'wrong-record' && result.record).toBe('committed');
  });

  it('prefers the record that actually governs over the one that merely exists', () => {
    const result = plan({
      requested: { baseUrl: 'https://api.mysite.com' },
      committedProjectUrl: 'https://committed.mysite.com',
      environmentProjectUrl: 'https://env.mysite.com',
    });

    expect(result.outcome === 'wrong-record' && result.record).toBe('committed');
  });
});

// A base URL identical to the project URL is not a configuration this toolset can
// serve. The Open Source server has no project layer — one server, one set of forms,
// addressed at its own root — so the two URLs collapse onto each other. Every tool
// here addresses a project under a deployment, so the pair is refused at the point it
// is formed rather than left to fail later as a string of confusing 404s.
describe('a deployment that is the project', () => {
  it('refuses a base URL identical to the project URL', () => {
    const result = plan({
      requested: {
        projectUrl: 'https://forms.mysite.com',
        baseUrl: 'https://forms.mysite.com',
      },
    });

    expect(result.outcome).toBe('open-source-deployment');
  });

  it('compares them after normalization', () => {
    const result = plan({
      requested: {
        projectUrl: 'https://forms.mysite.com',
        baseUrl: 'https://forms.mysite.com/',
      },
    });

    expect(result.outcome).toBe('open-source-deployment');
  });

  it('carries the value so the caller can name it', () => {
    const result = plan({
      requested: {
        projectUrl: 'https://forms.mysite.com',
        baseUrl: 'https://forms.mysite.com',
      },
    });

    expect(result.outcome === 'open-source-deployment' && result.url).toBe(
      'https://forms.mysite.com'
    );
  });

  // The same collapse reached through a deployment-only call against a project the
  // mapping already holds.
  it('refuses it when the project comes from the record being amended', () => {
    const result = plan({
      requested: { baseUrl: 'https://myproject.mysite.com' },
      existing: pair('https://myproject.mysite.com', 'https://api.mysite.com'),
    });

    expect(result.outcome).toBe('open-source-deployment');
  });

  it('accepts a deployment that actually hosts the project', () => {
    const result = plan({
      requested: {
        projectUrl: 'https://myproject.mysite.com',
        baseUrl: 'https://api.mysite.com',
      },
    });

    expect(result.outcome).toBe('write');
  });

  // Derived pairs can never collide — a deployment is always the project's parent or
  // api.form.io — so nothing that derives is caught by this.
  it('never fires on a derived pair', () => {
    expect(plan({ requested: { projectUrl: 'https://examples.form.io' } }).outcome).toBe('write');
    expect(plan({ requested: { projectUrl: 'https://forms.mysite.com/p' } }).outcome).toBe('write');
  });
});

// The mapping is documented as the fallback if a committed file goes away, so it has
// to be maintainable while that file governs. A deployment-only call was refused
// whenever a committed file existed — including when the mapping holds the SAME
// project, where the refusal's own wording ("not in this directory's mapping") was
// false, and where there was nothing ambiguous to refuse.
describe('a deployment alone under a committed file', () => {
  it('amends the mapping when both records name the same project', () => {
    const result = plan({
      requested: { baseUrl: 'https://new-api.mysite.com' },
      committedProjectUrl: 'https://same.mysite.com',
      existing: pair('https://same.mysite.com', 'https://api.mysite.com'),
    });

    expect(result.outcome === 'write' && result.entry.env).toEqual({
      FORMIO_PROJECT_URL: 'https://same.mysite.com',
      FORMIO_BASE_URL: 'https://new-api.mysite.com',
    });
  });

  // Different projects is the ambiguous case: the report the caller is answering was
  // about the committed project, so the deployment belongs beside THAT one.
  it('still refuses when the two records name different projects', () => {
    const result = plan({
      requested: { baseUrl: 'https://api.mysite.com' },
      committedProjectUrl: 'https://committed.mysite.com',
      existing: pair('https://mapped.mysite.com', 'https://old-api.mysite.com'),
    });

    expect(result.outcome).toBe('wrong-record');
    expect(result.outcome === 'wrong-record' && result.projectUrl).toBe(
      'https://committed.mysite.com'
    );
  });

  it('refuses when the mapping holds no project of its own', () => {
    const result = plan({
      requested: { baseUrl: 'https://api.mysite.com' },
      committedProjectUrl: 'https://committed.mysite.com',
    });

    expect(result.outcome).toBe('wrong-record');
  });
});

// Pasting the deployment URL where the Project URL goes is the most likely mistake on
// this surface, and a hosted-cloud API root derives itself: api.form.io is a form.io
// host, so the pair collapses and the Open Source refusal fires. That diagnosis is
// wrong in a way that sends the reader looking at their server, when the guidance the
// server already carries says exactly what happened.
describe('the hosted-cloud API root pasted as a project', () => {
  it('is not diagnosed as an Open Source deployment', () => {
    const result = plan({ requested: { projectUrl: 'https://api.form.io' } });

    expect(result.outcome).toBe('not-a-project-url');
  });

  it('says what that URL actually is', () => {
    const result = plan({ requested: { projectUrl: 'https://api.form.io/' } });

    expect(result.outcome === 'not-a-project-url' && result.url).toBe('https://api.form.io');
  });

  it('leaves a real hosted project alone', () => {
    expect(plan({ requested: { projectUrl: 'https://examples.form.io' } }).outcome).toBe('write');
  });
});
