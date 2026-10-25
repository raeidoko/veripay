import path from 'node:path';

export const governancePath = path.resolve(process.env.VERIPAY_ADMIN_DATA_DIR || path.join(process.cwd(), 'data', 'governance'));
export const localDatabasePath = path.resolve(process.env.VERIPAY_DB_PATH || path.join(governancePath, 'veripay.sqlite'));
export function serverPort() {
  const port = Number(process.env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535');
  return port;
}
