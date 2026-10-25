import type { RequestHandler } from 'express';
import type { Dispute } from '../../shared/types.ts';

export const asyncRoute = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  res.locals.backendPending = (res.locals.backendPending || 0) + 1;
  Promise.resolve().then(() => handler(req, res, next)).catch(next).finally(() => {
    res.locals.backendPending--;
    if (res.destroyed && !res.writableEnded) res.end();
  });
};
export function visibleDispute(dispute: Dispute, staff: boolean) {
  if (staff) return dispute;
  const { aiRecommendation, ...visible } = dispute;
  return visible;
}
