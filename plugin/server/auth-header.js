export function getAuthHeader(config) {
    if (config.jwt) {
        return { 'x-jwt-token': config.jwt };
    }
    if (config.apiKey) {
        return { 'x-token': config.apiKey };
    }
    return {};
}
