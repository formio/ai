import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResolvedFormioConfig } from '../config.js';

vi.mock('../token-cache.js', () => ({
  readToken: vi.fn(),
  saveToken: vi.fn(),
  clearToken: vi.fn(),
}));

vi.mock('../token-validation.js', () => ({
  validateToken: vi.fn(),
}));

vi.mock('../auth.js', () => ({
  authenticate: vi.fn(),
}));

import { ensureAuthenticated, resetAuthState } from '../ensure-auth.js';
import { readToken } from '../token-cache.js';
import { validateToken } from '../token-validation.js';
import { authenticate } from '../auth.js';
import { requireBaseUrl } from '../project-resolver.js';

const mockReadToken = vi.mocked(readToken);
const mockValidateToken = vi.mocked(validateToken);
const mockAuthenticate = vi.mocked(authenticate);

// A project URL resolves and its deployment does not. The base URL is read only
// to authenticate, so the demand for one belongs at that read — not at
// resolution, which would fail calls that never needed it.
describe('an unresolved base URL is demanded where it is used', () => {
  const unresolved: ResolvedFormioConfig = {
    projectUrl: 'https://myproject.mysite.com',
    baseUrl: undefined,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    resetAuthState();
  });

  describe('requireBaseUrl', () => {
    it('names project_set, its baseUrl argument, and the project it applies to', () => {
      let message = '';
      try {
        requireBaseUrl(unresolved);
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }

      expect(message).toContain('project_set');
      expect(message).toContain('baseUrl');
      expect(message).toContain('https://myproject.mysite.com');
    });

    // Reusing the unset-project wording would send the agent to interview both
    // URLs, when the project URL is already right and only the deployment is
    // missing.
    it('does not claim the project is unconfigured', () => {
      expect(() => requireBaseUrl(unresolved)).toThrow(/base url/i);
      expect(() => requireBaseUrl(unresolved)).not.toThrow(/No Form\.io project is configured/);
    });

    it('does not offer https://api.form.io as the answer', () => {
      let message = '';
      try {
        requireBaseUrl(unresolved);
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }

      expect(message).not.toContain('https://api.form.io');
    });

    it('returns the value unchanged when one is resolved', () => {
      expect(requireBaseUrl({ ...unresolved, baseUrl: 'https://forms.mysite.com' })).toBe(
        'https://forms.mysite.com'
      );
    });
  });

  describe('the JWT path', () => {
    it('raises the actionable error instead of authenticating against a guessed host', async () => {
      await expect(ensureAuthenticated({ ...unresolved })).rejects.toThrow(/baseUrl/);
    });

    it('opens no login flow and reads no token cache', async () => {
      await expect(ensureAuthenticated({ ...unresolved })).rejects.toThrow();

      expect(mockAuthenticate).not.toHaveBeenCalled();
      expect(mockReadToken).not.toHaveBeenCalled();
      expect(mockValidateToken).not.toHaveBeenCalled();
    });
  });

  // The regression this group exists to prevent. An API-key deployment returns
  // before any base-URL read, so it must keep working in the shape that has
  // none — the value it never uses cannot be the thing that fails its calls.
  describe('the API-key path', () => {
    it('completes with no base URL and no error', async () => {
      await expect(
        ensureAuthenticated({ ...unresolved, apiKey: 'secret-key' })
      ).resolves.toBeUndefined();

      expect(mockAuthenticate).not.toHaveBeenCalled();
      expect(mockReadToken).not.toHaveBeenCalled();
    });

    it('never reaches the ${baseUrl}/current validation with an undefined host', async () => {
      await ensureAuthenticated({ ...unresolved, apiKey: 'secret-key' });

      expect(mockValidateToken).not.toHaveBeenCalled();
    });
  });
});
