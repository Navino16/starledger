import type { Observation } from '@app/shared';

export function exportQueue(
  doc: Document,
  observations: Observation[],
  clientVersion: string,
): void {
  const exportedAt = new Date().toISOString();
  const json = JSON.stringify({ exportedAt, clientVersion, observations }, null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = doc.createElement('a');
  link.href = url;
  link.download = `starledger-queue-${exportedAt.replace(/[:.]/g, '-')}.json`;
  doc.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
