import { Component, Input, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

export type ExerciseVideoKind = 'file' | 'youtube' | 'vimeo';

export interface ExerciseVideoSource {
  kind: ExerciseVideoKind;
  sourceUrl: string;
  embedUrl?: string;
  thumbUrl?: string;
}

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
  'www.youtu.be'
]);
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);

export function parseExerciseVideoUrl(rawUrl: string | null | undefined): ExerciseVideoSource | null {
  const trimmed = rawUrl?.trim();
  if (!trimmed) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (YOUTUBE_HOSTS.has(host)) {
    const id = extractYoutubeId(url);
    if (!id) {
      return null;
    }
    return {
      kind: 'youtube',
      sourceUrl: url.toString(),
      embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`,
      thumbUrl: `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`
    };
  }

  if (VIMEO_HOSTS.has(host)) {
    const id = extractVimeoId(url);
    if (!id) {
      return null;
    }
    return {
      kind: 'vimeo',
      sourceUrl: url.toString(),
      embedUrl: `https://player.vimeo.com/video/${encodeURIComponent(id)}`,
      thumbUrl: `https://vumbnail.com/${encodeURIComponent(id)}.jpg`
    };
  }

  return {
    kind: 'file',
    sourceUrl: url.toString()
  };
}

export function isAllowedEmbedVideoUrl(rawUrl: string | null | undefined): boolean {
  const parsed = parseExerciseVideoUrl(rawUrl);
  return parsed?.kind === 'youtube' || parsed?.kind === 'vimeo';
}

function extractYoutubeId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);
  const candidate = youtubeIdCandidate(host, segments, url);
  return candidate && /^[a-zA-Z0-9_-]{6,64}$/.test(candidate) ? candidate : null;
}

function youtubeIdCandidate(host: string, segments: string[], url: URL): string | null {
  if (host.endsWith('youtu.be')) {
    return segments[0] ?? null;
  }
  if (['embed', 'shorts'].includes(segments[0] ?? '')) {
    return segments[1] ?? null;
  }
  return url.searchParams.get('v');
}

function extractVimeoId(url: URL): string | null {
  const segments = url.pathname.split('/').filter(Boolean);
  const candidate = url.hostname.toLowerCase() === 'player.vimeo.com' && segments[0] === 'video'
    ? segments[1]
    : segments[0];
  return candidate && /^\d{4,20}$/.test(candidate) ? candidate : null;
}

@Component({
  selector: 'app-exercise-video',
  imports: [],
  templateUrl: './exercise-video.component.html',
  styleUrl: './exercise-video.component.scss'
})
export class ExerciseVideoComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly videoUrlValue = signal<string | null>(null);

  @Input() set videoUrl(value: string | null | undefined) {
    this.videoUrlValue.set(value?.trim() || null);
    // A new video starts as its preview again; the embed loads only after a tap.
    this.activated.set(false);
  }
  @Input() title = 'Exercise video';

  readonly activated = signal(false);
  readonly source = computed(() => parseExerciseVideoUrl(this.videoUrlValue()));
  readonly safeEmbedUrl = computed<SafeResourceUrl | null>(() => {
    const embedUrl = this.source()?.embedUrl;
    if (!embedUrl || !this.activated()) {
      return null;
    }
    // embedUrl is reconstructed from validated YouTube/Vimeo IDs and fixed allowlisted hosts.
    return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl); // NOSONAR
  });

  activate(): void {
    if (this.source()?.embedUrl) {
      this.activated.set(true);
    }
  }
}
