import { ComponentFixture, TestBed } from '@angular/core/testing';

import {
  ExerciseVideoComponent,
  isAllowedEmbedVideoUrl,
  parseExerciseVideoUrl
} from './exercise-video.component';

describe('ExerciseVideoComponent', () => {
  let fixture: ComponentFixture<ExerciseVideoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExerciseVideoComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ExerciseVideoComponent);
  });

  it('parses allowed YouTube and Vimeo URLs into embed sources', () => {
    expect(parseExerciseVideoUrl('https://www.youtube.com/watch?v=abc123def45')).toEqual(
      jasmine.objectContaining({
        kind: 'youtube',
        embedUrl: 'https://www.youtube-nocookie.com/embed/abc123def45',
        thumbUrl: 'https://img.youtube.com/vi/abc123def45/hqdefault.jpg'
      })
    );
    expect(parseExerciseVideoUrl('https://vimeo.com/123456789')).toEqual(
      jasmine.objectContaining({
        kind: 'vimeo',
        embedUrl: 'https://player.vimeo.com/video/123456789'
      })
    );
    expect(isAllowedEmbedVideoUrl('https://example.test/video.mp4')).toBeFalse();
    expect(isAllowedEmbedVideoUrl('https://youtu.be/abc123def45')).toBeTrue();
  });

  it('parses alternate YouTube and Vimeo embed shapes', () => {
    expect(parseExerciseVideoUrl('https://youtube-nocookie.com/embed/abc123def45')).toEqual(
      jasmine.objectContaining({
        kind: 'youtube',
        embedUrl: 'https://www.youtube-nocookie.com/embed/abc123def45'
      })
    );
    expect(parseExerciseVideoUrl('https://m.youtube.com/shorts/abc123def45')).toEqual(
      jasmine.objectContaining({
        kind: 'youtube',
        embedUrl: 'https://www.youtube-nocookie.com/embed/abc123def45'
      })
    );
    expect(parseExerciseVideoUrl('https://player.vimeo.com/video/123456789')).toEqual(
      jasmine.objectContaining({
        kind: 'vimeo',
        embedUrl: 'https://player.vimeo.com/video/123456789'
      })
    );
  });

  it('rejects missing, malformed, and provider URLs without valid ids', () => {
    expect(parseExerciseVideoUrl(null)).toBeNull();
    expect(parseExerciseVideoUrl('   ')).toBeNull();
    expect(parseExerciseVideoUrl('not a url')).toBeNull();
    expect(parseExerciseVideoUrl('ftp://media.example.test/demo.mp4')).toBeNull();
    expect(parseExerciseVideoUrl('https://youtu.be/')).toBeNull();
    expect(parseExerciseVideoUrl('https://www.youtube.com/watch?v=bad!')).toBeNull();
    expect(parseExerciseVideoUrl('https://vimeo.com/not-digits')).toBeNull();
    expect(parseExerciseVideoUrl('https://player.vimeo.com/video/not-digits')).toBeNull();
  });

  it('renders self-hosted media with a video element', () => {
    fixture.componentRef.setInput('videoUrl', 'https://media.example.test/exercises/demo.mp4');
    fixture.detectChanges();

    const video = fixture.nativeElement.querySelector('video') as HTMLVideoElement;
    expect(video).not.toBeNull();
    expect(video.getAttribute('src')).toBe('https://media.example.test/exercises/demo.mp4');
    expect(fixture.nativeElement.querySelector('iframe')).toBeNull();
  });

  it('lazy-loads YouTube embeds behind a preview button', () => {
    fixture.componentRef.setInput('videoUrl', 'https://www.youtube.com/watch?v=abc123def45');
    fixture.componentRef.setInput('title', 'Goblet squat video');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.video-preview')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('iframe')).toBeNull();

    (fixture.nativeElement.querySelector('.video-preview') as HTMLButtonElement).click();
    fixture.detectChanges();

    const iframe = fixture.nativeElement.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe).not.toBeNull();
    expect(iframe.title).toBe('Goblet squat video');
  });

  it('renders Vimeo previews and resets activation when the input changes', () => {
    fixture.componentRef.setInput('videoUrl', 'https://vimeo.com/123456789');
    fixture.detectChanges();

    const previewImage = fixture.nativeElement.querySelector('.video-preview img') as HTMLImageElement;
    expect(previewImage.src).toBe('https://vumbnail.com/123456789.jpg');

    (fixture.nativeElement.querySelector('.video-preview') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('iframe')).not.toBeNull();

    fixture.componentRef.setInput('videoUrl', 'https://media.example.test/exercises/demo.mp4');
    fixture.detectChanges();

    expect(fixture.componentInstance.activated()).toBeFalse();
    expect(fixture.nativeElement.querySelector('video')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('iframe')).toBeNull();
  });

  it('does not activate iframe mode for self-hosted files', () => {
    fixture.componentRef.setInput('videoUrl', 'https://media.example.test/exercises/demo.mp4');
    fixture.detectChanges();

    fixture.componentInstance.activate();
    fixture.detectChanges();

    expect(fixture.componentInstance.activated()).toBeFalse();
    expect(fixture.componentInstance.safeEmbedUrl()).toBeNull();
  });

  it('does not render unsupported or invalid URLs', () => {
    fixture.componentRef.setInput('videoUrl', 'javascript:alert(1)');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.exercise-video')).toBeNull();
  });
});
