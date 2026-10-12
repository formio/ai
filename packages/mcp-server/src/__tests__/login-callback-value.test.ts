/**
 * The local login page and its `/callback` belong to one login: the page carries a
 * value generated for that login, the page's script sends it back with the token,
 * and `/callback` takes the token only when the value matches. Any other post is
 * answered 403 and the login keeps waiting for the page's own post until it times
 * out.
 *
 * The login-form URL is written into the page's script as a JSON string literal, so
 * every character a URL can carry stays part of the string.
 */

import { describe, expect, it, vi } from 'vitest';
import { authenticate } from '../auth.js';
import { ResolvedFormioConfig } from '../config.js';
import { loginPageState, postLoginCallback, postLoginToken } from './test-helpers.js';

vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({ on: vi.fn(), unref: vi.fn() })),
}));

// An explicit login form, so serving the page probes nothing.
const CONFIG: ResolvedFormioConfig = {
  baseUrl: 'https://formio.invalid/sub',
  projectUrl: 'https://formio.invalid/sub/example',
  loginFormUrl: 'https://formio.invalid/sub/formio/user/login',
  forceBrowser: true,
};

async function servedPage(config: ResolvedFormioConfig): Promise<string> {
  let html = '';
  await authenticate(config, {
    onReady: async (port) => {
      html = await (await fetch(`http://127.0.0.1:${port}/`)).text();
      await postLoginToken(port, 'jwt');
    },
  });
  return html;
}

describe('the per-login value', () => {
  it('is carried by the served page: at least 128 bits, as hex', async () => {
    let state: string | undefined;
    await authenticate(CONFIG, {
      onReady: async (port) => {
        state = await loginPageState(port);
        await postLoginToken(port, 'jwt');
      },
    });
    expect(state).toMatch(/^[0-9a-f]{32,}$/);
  });

  it('differs from one login to the next', async () => {
    const values: (string | undefined)[] = [];
    for (let i = 0; i < 2; i += 1) {
      await authenticate(CONFIG, {
        onReady: async (port) => {
          values.push(await loginPageState(port));
          await postLoginToken(port, 'jwt');
        },
      });
    }
    expect(values[0]).toMatch(/^[0-9a-f]+$/);
    expect(values[1]).not.toBe(values[0]);
  });

  it('is the same on every load of one login page', async () => {
    const values: (string | undefined)[] = [];
    await authenticate(CONFIG, {
      onReady: async (port) => {
        values.push(await loginPageState(port), await loginPageState(port));
        await postLoginToken(port, 'jwt');
      },
    });
    expect(values[0]).toMatch(/^[0-9a-f]+$/);
    expect(values[1]).toBe(values[0]);
  });

  it('is sent back by the page script with the token', async () => {
    expect(await servedPage(CONFIG)).toContain('JSON.stringify({ token: token, state: state })');
  });
});

describe('/callback', () => {
  it('completes the login when the post carries the page value', async () => {
    let posted: Promise<Response> | undefined;
    const jwt = await authenticate(CONFIG, {
      onReady: (port) => {
        posted = postLoginToken(port, 'the-token');
      },
    });
    expect((await posted)?.status).toBe(200);
    expect(jwt).toBe('the-token');
  });

  it('answers a post without the value with 403 and keeps waiting', async () => {
    let status = 0;
    const jwt = await authenticate(CONFIG, {
      onReady: async (port) => {
        status = (await postLoginCallback(port, { token: 'unaccompanied' })).status;
        await postLoginToken(port, 'the-token');
      },
    });
    expect(status).toBe(403);
    expect(jwt).toBe('the-token');
  });

  it('answers a post with a different value with 403 and keeps waiting', async () => {
    let status = 0;
    const jwt = await authenticate(CONFIG, {
      onReady: async (port) => {
        const state = (await loginPageState(port)) ?? '';
        const other = state.replace(/^./, (c) => (c === '0' ? '1' : '0'));
        status = (await postLoginCallback(port, { token: 'other', state: other })).status;
        await postLoginToken(port, 'the-token');
      },
    });
    expect(status).toBe(403);
    expect(jwt).toBe('the-token');
  });

  it('answers a post with a value of another length with 403', async () => {
    let status = 0;
    await authenticate(CONFIG, {
      onReady: async (port) => {
        const state = (await loginPageState(port)) ?? '';
        status = (await postLoginCallback(port, { token: 'other', state: `${state}00` })).status;
        await postLoginToken(port, 'the-token');
      },
    });
    expect(status).toBe(403);
  });

  it('answers a post whose value is not a string with 403', async () => {
    let status = 0;
    await authenticate(CONFIG, {
      onReady: async (port) => {
        status = (await postLoginCallback(port, { token: 'other', state: 42 })).status;
        await postLoginToken(port, 'the-token');
      },
    });
    expect(status).toBe(403);
  });

  it('leaves a login that only ever receives other posts to its timeout', async () => {
    let status = 0;
    await expect(
      authenticate(
        { ...CONFIG, authTimeoutMs: 500 },
        {
          onReady: async (port) => {
            status = (await postLoginCallback(port, { token: 'unaccompanied' })).status;
          },
        }
      )
    ).rejects.toMatchObject({ code: 'AUTH_REQUIRED', message: expect.stringMatching(/Timed out/) });
    expect(status).toBe(403);
  });
});

describe('the login-form URL in the page script', () => {
  it('is written as a JSON string literal', async () => {
    const html = await servedPage(CONFIG);
    expect(html).toContain(
      `Formio.createForm(document.getElementById('formio'), ${JSON.stringify(CONFIG.loginFormUrl)})`
    );
  });

  it("passes a URL containing ' whole", async () => {
    const loginFormUrl = "https://formio.invalid/sub/it's/login";
    const html = await servedPage({ ...CONFIG, loginFormUrl });
    const literal = html.match(
      /Formio\.createForm\(document\.getElementById\('formio'\), ("(?:[^"\\]|\\.)*")\)/
    )?.[1];
    expect(literal).toBeDefined();
    expect(JSON.parse(literal ?? '""')).toBe(loginFormUrl);
  });
});
