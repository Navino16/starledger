const TOKEN_PATH =
  /^(\/invite|\/reset|\/api\/site\/invitations|\/api\/site\/password-resets)\/[^/?#]+/;

// Invitation and reset tokens are bearer secrets: keep them out of logs.
export const redactUrl = (url: string) => url.replace(TOKEN_PATH, '$1/[redacted]');
