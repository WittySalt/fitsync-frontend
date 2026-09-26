import { parseSseChunk } from './sse';

/**
 * The frame parser, against the chunk boundaries a real body produces.
 *
 * The property that matters is that a boundary landing anywhere, including mid-line, yields the
 * same frames as the whole text at once. Everything else here is the parts of the SSE format the
 * coach actually uses.
 */
describe('parseSseChunk', () => {
  const body = 'event:tool_started\ndata:{"tool":"readFacts"}\n\nevent:answer\ndata:{"answer":"ok"}\n\n';

  it('splits a complete body into named frames', () => {
    const { frames, carry } = parseSseChunk(body);

    expect(frames).toEqual([
      { event: 'tool_started', data: '{"tool":"readFacts"}' },
      { event: 'answer', data: '{"answer":"ok"}' }
    ]);
    expect(carry).toBe('');
  });

  it('yields the same frames whatever the chunk boundaries are', () => {
    for (let cut = 1; cut < body.length; cut++) {
      const first = parseSseChunk(body.slice(0, cut));
      const second = parseSseChunk(body.slice(cut), first.carry);
      const frames = [...first.frames, ...second.frames];

      expect(frames).withContext(`cut at ${cut}`).toEqual(parseSseChunk(body).frames);
      expect(second.carry).withContext(`cut at ${cut}`).toBe('');
    }
  });

  it('carries an incomplete frame to the next call rather than emitting half of it', () => {
    const { frames, carry } = parseSseChunk('event:thinking\ndata:{"kind":');

    expect(frames).toEqual([]);
    expect(carry).toBe('event:thinking\ndata:{"kind":');
  });

  it('strips exactly one leading space after the colon, as the format specifies', () => {
    const { frames } = parseSseChunk('event: answer\ndata:  two spaces\n\n');

    expect(frames[0]).toEqual({ event: 'answer', data: ' two spaces' });
  });

  it('joins multi-line data with newlines', () => {
    const { frames } = parseSseChunk('data:first\ndata:second\n\n');

    expect(frames[0]).toEqual({ event: 'message', data: 'first\nsecond' });
  });

  it('ignores comment lines and frames without data', () => {
    const { frames } = parseSseChunk(':keep-alive\n\nevent:orphan\n\ndata:real\n\n');

    expect(frames).toEqual([{ event: 'message', data: 'real' }]);
  });

  it('accepts CRLF line endings', () => {
    const { frames } = parseSseChunk('event:answer\r\ndata:x\r\n\r\n');

    expect(frames).toEqual([{ event: 'answer', data: 'x' }]);
  });
});
