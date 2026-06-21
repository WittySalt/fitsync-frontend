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

  it('does not render unsupported or invalid URLs', () => {
    fixture.componentRef.setInput('videoUrl', 'javascript:alert(1)');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.exercise-video')).toBeNull();
  });
});
