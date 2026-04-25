import { FormioConfig } from './config.js';

export function getAuthHeader(config: FormioConfig): Record<string, string> {
  if (config.jwt) {
    return { 'x-jwt-token': config.jwt };
  }
  if (config.apiKey) {
    return { 'x-token': config.apiKey };
  }
  return {};
}
