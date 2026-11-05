import type { RequestHandler } from 'express';

export function requestOriginGuard(publicOrigin?: string): RequestHandler {
  let configuredOrigin: string | undefined;
  if (publicOrigin) {
    const url = new URL(publicOrigin);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('VERIPAY_PUBLIC_ORIGIN must be an HTTP or HTTPS origin without a path');
    }
    configuredOrigin = url.origin;
  }
  return (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) { next(); return; }
    const origin = req.get('Origin');
    const host = req.get('Host');
    // TLS can terminate at a reverse proxy while Express receives HTTP.
    // Keep the host and port exact; never trust arbitrary forwarded headers.
    const allowed = !origin || origin === `${req.protocol}://${host}` ||
      (req.protocol === 'http' && origin === `https://${host}`) || origin === configuredOrigin;
    if (req.get('Sec-Fetch-Site') === 'cross-site' || !allowed) {
      res.status(403).json({ error: 'Cross-site requests are not allowed' });
      return;
    }
    next();
  };
}
