import { Observable, Subject, of, throwError } from 'rxjs';

import { WorkoutSessionDetail, WorkoutSessionSegment } from '../../../core/fitsync.models';
import { SegmentWriteQueue } from './segment-queue';

const settled = { position: 1, actualSeconds: 300, startedAt: '2026-10-04T10:00:00Z', status: 'DONE' as const };

function answer(segments: Partial<WorkoutSessionSegment>[] = []): WorkoutSessionDetail {
  return { segments } as WorkoutSessionDetail;
}

describe('SegmentWriteQueue', () => {
  it('sends a write at once when the entry id is known', () => {
    const send = jasmine.createSpy('send').and.returnValue(of(answer()));
    const queue = new SegmentWriteQueue(send);
    queue.learn([{ entryId: 'e1', position: 1 }] as WorkoutSessionSegment[]);
    queue.push([settled]);
    expect(send).toHaveBeenCalledOnceWith('e1', { actualSeconds: 300, startedAt: settled.startedAt, status: 'DONE' });
    expect(queue.pending).toBe(0);
  });

  it('holds a write whose id is missing and sends it when an answer brings the id', () => {
    const send = jasmine.createSpy('send').and.returnValue(of(answer()));
    const queue = new SegmentWriteQueue(send);
    queue.push([settled]);
    expect(send).not.toHaveBeenCalled();
    expect(queue.pending).toBe(1);
    queue.learn([{ entryId: 'e1', position: 1 }] as WorkoutSessionSegment[]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(queue.pending).toBe(0);
  });

  it('keeps a failed write and sends it again on the next flush', () => {
    let fail = true;
    const send = jasmine.createSpy('send').and.callFake((): Observable<WorkoutSessionDetail> => (fail ? throwError(() => new Error('down')) : of(answer())));
    const queue = new SegmentWriteQueue(send);
    queue.learn([{ entryId: 'e1', position: 1 }] as WorkoutSessionSegment[]);
    queue.push([settled]);
    expect(queue.pending).toBe(1);
    fail = false;
    queue.flush();
    expect(send).toHaveBeenCalledTimes(2);
    expect(queue.pending).toBe(0);
  });

  it('does not send the same segment twice while a write is in flight, and keeps the newest', () => {
    const reply = new Subject<WorkoutSessionDetail>();
    const send = jasmine.createSpy('send').and.returnValue(reply);
    const queue = new SegmentWriteQueue(send);
    queue.learn([{ entryId: 'e1', position: 1 }] as WorkoutSessionSegment[]);
    queue.push([settled]);
    queue.push([{ ...settled, actualSeconds: 330 }]);
    expect(send).toHaveBeenCalledTimes(1);
    reply.next(answer());
    expect(queue.pending).toBe(1);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.calls.mostRecent().args[1].actualSeconds).toBe(330);
  });
});
