/**
 * A server-sent-events frame parser for a body read through fetch.
 *
 * EventSource cannot POST, and the coach's stream needs the message in a body, so the stream is
 * read with fetch and split into frames here. Pure, so it can be tested with a handful of strings
 * rather than a fake network: the only state is the text carried between chunks, because a chunk
 * boundary can land anywhere, including halfway through a line.
 */

export interface SseFrame {
  event: string;
  data: string;
}

export interface SseParseResult {
  frames: SseFrame[];
  /** Text after the last complete frame, to be prepended to the next chunk. */
  carry: string;
}

/**
 * @param chunk the newly received text
 * @param carry whatever the previous call could not complete
 */
export function parseSseChunk(chunk: string, carry = ''): SseParseResult {
  const text = carry + chunk;
  const frames: SseFrame[] = [];

  // A frame ends at a blank line. Normalise CRLF first so both line endings split the same way.
  const normalised = text.replace(/\r\n/g, '\n');
  const blocks = normalised.split('\n\n');
  // The final block is complete only if the text ended with a blank line; otherwise it is carry.
  const remainder = normalised.endsWith('\n\n') ? '' : (blocks.pop() ?? '');

  for (const block of blocks) {
    const frame = parseBlock(block);
    if (frame) {
      frames.push(frame);
    }
  }
  return { frames, carry: remainder };
}

function parseBlock(block: string): SseFrame | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of block.split('\n')) {
    if (line === '' || line.startsWith(':')) {
      continue;
    }
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    // The spec strips exactly one leading space after the colon, and no more.
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) {
      value = value.slice(1);
    }
    if (field === 'event') {
      event = value;
    } else if (field === 'data') {
      dataLines.push(value);
    }
  }
  if (dataLines.length === 0) {
    return null;
  }
  return { event, data: dataLines.join('\n') };
}
