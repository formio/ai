import { describe, expect, it } from 'vitest';
import { BrowserEnvironment, browserlessReason } from '../browser-availability.js';

function environment(overrides: Partial<BrowserEnvironment> = {}): BrowserEnvironment {
  return {
    env: {},
    hasContainerMarker: false,
    ...overrides,
  };
}

describe('browserlessReason', () => {
  it('reports CI as browserless', () => {
    expect(browserlessReason(environment({ env: { CI: 'true' } }))).toMatch(/CI/i);
  });

  it('treats CI=false as a normal environment', () => {
    expect(browserlessReason(environment({ env: { CI: 'false' } }))).toBeNull();
  });

  // A missing DISPLAY on its own proves nothing about the user: an agent started
  // from a systemd user unit or a tmux session predating the graphical login has
  // no display variable and a perfectly usable browser one loopback away. The
  // situations where the browser really is elsewhere — CI, a container, a remote
  // shell — each have their own signal, so this one only ever cost a desktop
  // Linux user the stderr login URL that used to work.
  it('accepts a host with no display server, which is not evidence of a missing browser', () => {
    expect(browserlessReason(environment())).toBeNull();
  });

  it('still reports a displayless container as browserless', () => {
    expect(browserlessReason(environment({ hasContainerMarker: true }))).toMatch(/container/i);
  });

  it('still reports a displayless CI runner as browserless', () => {
    expect(browserlessReason(environment({ env: { CI: 'true' } }))).toMatch(/CI/i);
  });

  it('accepts a host with DISPLAY set', () => {
    expect(browserlessReason(environment({ env: { DISPLAY: ':0' } }))).toBeNull();
  });

  it('accepts a host with WAYLAND_DISPLAY set', () => {
    expect(browserlessReason(environment({ env: { WAYLAND_DISPLAY: 'wayland-0' } }))).toBeNull();
  });

  it('reports an SSH session with no display as browserless', () => {
    expect(
      browserlessReason(environment({ env: { SSH_CONNECTION: '10.0.0.1 22 10.0.0.2 22' } }))
    ).toMatch(/remote|ssh/i);
  });

  it('reports an SSH_TTY session with no display as browserless', () => {
    expect(browserlessReason(environment({ env: { SSH_TTY: '/dev/pts/0' } }))).toMatch(
      /remote|ssh/i
    );
  });

  it('accepts an SSH session that forwards a display', () => {
    expect(
      browserlessReason(environment({ env: { SSH_CONNECTION: 'x', DISPLAY: 'localhost:10.0' } }))
    ).toBeNull();
  });

  it('reports a container as browserless', () => {
    expect(browserlessReason(environment({ hasContainerMarker: true }))).toMatch(/container/i);
  });

  it('reports a container declared by environment variable as browserless', () => {
    expect(browserlessReason(environment({ env: { container: 'podman' } }))).toMatch(/container/i);
  });

  // A dev container started with the host's X socket shared into it
  // (docker run -e DISPLAY=:0 -v /tmp/.X11-unix:/tmp/.X11-unix) opens the user's
  // own browser and sets none of the editor-forwarding markers. Answering
  // "container" before the display was consulted failed the login outright on a
  // host that can present one — and failed it before the port was bound, so the
  // login URL never reached the user either.
  it('accepts a container that has a display', () => {
    expect(
      browserlessReason(environment({ hasContainerMarker: true, env: { DISPLAY: ':0' } }))
    ).toBeNull();
  });

  it('accepts a container declared by environment variable that has a Wayland display', () => {
    expect(
      browserlessReason(environment({ env: { container: 'podman', WAYLAND_DISPLAY: 'wayland-0' } }))
    ).toBeNull();
  });

  // The remedy the error text offers — publish the login port and reach it from
  // the host's browser — has to actually unblock the login, or it is advice that
  // returns the identical error.
  it('accepts a container whose login endpoint is published', () => {
    expect(
      browserlessReason(environment({ hasContainerMarker: true }), { publishedLoginEndpoint: true })
    ).toBeNull();
  });

  it('accepts a remote shell whose login endpoint is published', () => {
    expect(
      browserlessReason(environment({ env: { SSH_CONNECTION: 'x' } }), {
        publishedLoginEndpoint: true,
      })
    ).toBeNull();
  });

  // A devcontainer or a Codespace is a container whose editor forwards ports
  // automatically — the browser is on the user's own machine and the login URL
  // printed on stderr opens there. Auto-forwarding sets neither FORMIO_AUTH_HOST
  // nor FORMIO_AUTH_PORT, so without these markers the exemption meant to spare
  // those users blocked exactly them, and before the port was even bound.
  it('accepts a container inside a Codespace', () => {
    expect(
      browserlessReason(environment({ hasContainerMarker: true, env: { CODESPACES: 'true' } }))
    ).toBeNull();
  });

  it('accepts a container inside a VS Code devcontainer', () => {
    expect(
      browserlessReason(
        environment({ hasContainerMarker: true, env: { REMOTE_CONTAINERS: 'true' } })
      )
    ).toBeNull();
  });

  it('accepts a container attached to a VS Code session', () => {
    expect(
      browserlessReason(
        environment({
          hasContainerMarker: true,
          env: { VSCODE_IPC_HOOK_CLI: '/tmp/vscode-ipc.sock' },
        })
      )
    ).toBeNull();
  });

  it('accepts a remote shell attached to a VS Code session', () => {
    expect(
      browserlessReason(
        environment({ env: { SSH_CONNECTION: 'x', VSCODE_IPC_HOOK_CLI: '/tmp/vscode-ipc.sock' } })
      )
    ).toBeNull();
  });

  // Nobody is watching a runner, whatever editor variables the image happens to
  // carry.
  it('still reports CI as browserless inside a Codespace', () => {
    expect(browserlessReason(environment({ env: { CI: 'true', CODESPACES: 'true' } }))).toMatch(
      /CI/i
    );
  });

  it('still reports CI as browserless when a login endpoint is published', () => {
    expect(
      browserlessReason(environment({ env: { CI: 'true' } }), { publishedLoginEndpoint: true })
    ).toMatch(/CI/i);
  });

  it('accepts a clean desktop', () => {
    expect(browserlessReason(environment())).toBeNull();
  });
});
