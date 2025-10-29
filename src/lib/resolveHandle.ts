export function resolveHandle(entity: any): string | undefined {
  if (!entity) {
    return undefined;
  }

  const candidates: unknown[] = [
    entity.handle,
    entity.user?.handle,
    entity.author?.handle,
    entity.profile?.handle,
    entity.username,
    entity.user?.username,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed) {
        return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
      }
    }
  }

  return undefined;
}
