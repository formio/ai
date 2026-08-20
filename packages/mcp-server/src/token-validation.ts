import { FormioConfig } from './config.js';
import { getAuthHeader } from './auth-header.js';

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
  const url = `${config.baseUrl}/current`;
  const response = await fetch(url, { headers: getAuthHeader(config) });
  return response.ok;
}
