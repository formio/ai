import { FormioConfig } from './config.js';
import { getAuthHeader } from './auth-header.js';

export async function validateToken(config: FormioConfig): Promise<boolean> {
  const url = `${config.baseUrl}/current`;
  const response = await fetch(url, { headers: getAuthHeader(config) });
  return response.ok;
}
