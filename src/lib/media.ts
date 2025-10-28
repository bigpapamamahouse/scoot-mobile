
import { ENV } from '../lib/env';
export function mediaUrlFromKey(key?: string | null){
  if(!key) return null;
  const base = ENV.MEDIA_BASE.replace(/^https?:\/\//, '');
  return `https://${base}/${encodeURIComponent(key)}`;
}
