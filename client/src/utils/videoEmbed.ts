export type VideoEmbedKind = 'youtube' | 'vimeo' | 'direct' | 'none';

export interface ResolvedVideoEmbed {
  kind: VideoEmbedKind;
  /** iframe src for YouTube/Vimeo */
  embedUrl?: string;
  /** native video src for mp4/webm */
  src?: string;
}

function youtubeIdFromUrl(url: URL): string | null {
  if (url.hostname.includes('youtu.be')) {
    const id = url.pathname.replace(/^\//, '').split('/')[0];
    return id || null;
  }
  if (url.hostname.includes('youtube.com')) {
    const fromQuery = url.searchParams.get('v');
    if (fromQuery) return fromQuery;
    const parts = url.pathname.split('/').filter(Boolean);
    const embedIdx = parts.indexOf('embed');
    if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
    const shortsIdx = parts.indexOf('shorts');
    if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];
  }
  return null;
}

function vimeoIdFromUrl(url: URL): string | null {
  if (!url.hostname.includes('vimeo.com')) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[parts.length - 1];
  return id && /^\d+$/.test(id) ? id : null;
}

/** Resolve a public video URL into an embeddable player target. */
export function resolveVideoEmbed(
  rawUrl: string | undefined | null,
  opts?: { maxSeconds?: number }
): ResolvedVideoEmbed {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return { kind: 'none' };

  if (trimmed.startsWith('/')) {
    return { kind: 'direct', src: trimmed };
  }

  try {
    const url = new URL(trimmed);
    const youtubeId = youtubeIdFromUrl(url);
    if (youtubeId) {
      const end = opts?.maxSeconds ? `&end=${opts.maxSeconds}` : '';
      return {
        kind: 'youtube',
        embedUrl: `https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1&start=0${end}`,
      };
    }
    const vimeoId = vimeoIdFromUrl(url);
    if (vimeoId) {
      return {
        kind: 'vimeo',
        embedUrl: `https://player.vimeo.com/video/${vimeoId}?title=0&byline=0&portrait=0`,
      };
    }
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(url.pathname)) {
      return { kind: 'direct', src: trimmed };
    }
  } catch {
    // fall through
  }

  return { kind: 'none' };
}
