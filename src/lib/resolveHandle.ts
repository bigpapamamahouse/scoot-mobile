export function resolveHandle(entity: any): string | undefined {
  if (!entity) {
    return undefined;
  }

  const candidates: unknown[] = [
    entity.handle,
    entity.userHandle,
    entity.authorHandle,
    entity.commenterHandle,
    entity.createdByHandle,
    entity.user?.handle,
    entity.user?.profile?.handle,
    entity.user?.username,
    entity.author?.handle,
    entity.author?.profile?.handle,
    entity.author?.username,
    entity.commenter?.handle,
    entity.commenter?.profile?.handle,
    entity.commenter?.username,
    entity.createdBy?.handle,
    entity.createdBy?.profile?.handle,
    entity.createdBy?.username,
    entity.profile?.handle,
    entity.profile?.username,
    entity.username,
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
