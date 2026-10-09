import { FormioConfig } from './config.js';
import { getAuthHeader } from './auth-header.js';
import { send } from './formio-client.js';

// baseUrl is required here and the type cannot say so: FormioConfig leaves it
// optional, and template interpolation would happily fetch "undefined/current"
// rather than fail — the one place an absent deployment URL becomes a request
// instead of an error. Checked explicitly for that reason.
export async function validateToken(config: FormioConfig): Promise<boolean> {
  if (!config.baseUrl) {
    throw new Error(
      'validateToken requires a resolved Base URL; the auth path must call requireBaseUrl before validating a token.'
    );
  }
  const url = new URL(`${config.baseUrl}/current`);
  // Not followed: a redirect would carry the token to wherever it points. A request
  // that gets no response is a NETWORK_ERROR naming the cause and URL, as every
  // other Form.io request reports it.
  const response = await send(url, { headers: getAuthHeader(config), redirect: 'manual' });
  return response.ok;
}
