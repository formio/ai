import { describe, it, expect } from 'vitest';
import { writeProjectEntry } from '../project-map.js';
import { requireBaseUrl, resolveProjectConfig } from '../project-resolver.js';

// The skills library no longer restates how to choose these URLs, and an agent
// using the server stand-alone never had a document to read. So each error has to
// be actionable on its own: name the exact remedy command, and carry enough
// guidance for the user to answer it.
describe('configuration errors are self-sufficient', () => {
  function messageFrom(run: () => unknown): string {
    try {
      run();
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    throw new Error('expected the call to throw');
  }

  describe('when no project URL resolves', () => {
    const unset = () => resolveProjectConfig('/w/unmapped', {});

    it('names a runnable project set command including the cwd it searched', () => {
      const message = messageFrom(unset);

      expect(message).toContain('project set --project-url');
      expect(message).toContain('/w/unmapped');
    });

    it('states the three valid URL shapes so the user can answer', () => {
      const message = messageFrom(unset);

      expect(message).toMatch(/hosted cloud/i);
      expect(message).toContain('https://examples.form.io');
      expect(message).toContain('https://myproject.mysite.com');
      expect(message).toContain('https://forms.mysite.com/myproject');
    });

    // The base URL that will be needed depends on the project URL the user has
    // not given yet — a hosted-cloud answer needs none at all. Asking for both
    // presents a compound task and asks for a value that may never be required.
    it('does not ask for the base URL in the same message', () => {
      const message = messageFrom(unset);

      expect(message).not.toMatch(/project set --base-url/);
    });

    it('still names the project_set tool for an agent that has tools rather than a shell', () => {
      expect(messageFrom(unset)).toContain('project_set');
    });
  });

  describe('when the project URL resolves and its base URL cannot be determined', () => {
    const half = () =>
      requireBaseUrl({
        projectUrl: 'https://myproject.mysite.com',
        baseUrl: undefined,
      });

    it('names a runnable project set --base-url command', () => {
      expect(messageFrom(half)).toContain('project set --base-url');
    });

    it('echoes the project URL it applies to', () => {
      expect(messageFrom(half)).toContain('https://myproject.mysite.com');
    });

    it('says why the value cannot be derived', () => {
      expect(messageFrom(half)).toMatch(/sibling sub-?domain/i);
    });

    it('does not report the project as unset', () => {
      const message = messageFrom(half);

      expect(message).not.toContain('project set --project-url');
      expect(message).not.toMatch(/No Form\.io project is configured/);
    });
  });

  // Fixing the first surfaces the second. The two are never reported together.
  it('reports the project URL first and the base URL only after it is supplied', () => {
    const first = messageFrom(() => resolveProjectConfig('/w/staged', {}));
    expect(first).toContain('project set --project-url');

    writeProjectEntry({
      cwd: '/w/staged',
      env: { FORMIO_PROJECT_URL: 'https://myproject.mysite.com' },
    });

    const resolved = resolveProjectConfig('/w/staged', {});
    expect(resolved.projectUrl).toBe('https://myproject.mysite.com');

    const second = messageFrom(() => requireBaseUrl(resolved));
    expect(second).toContain('project set --base-url');
    expect(second).not.toContain('project set --project-url');
  });
});
