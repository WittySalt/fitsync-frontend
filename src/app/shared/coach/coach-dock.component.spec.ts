import { isBuildRequest } from './coach-dock.component';

/**
 * Which messages take the drafting path rather than the chat loop.
 *
 * The rule is a literal keyword match, so the cases here are the contract: the suggested
 * generative question routes to drafting, ordinary questions do not, and a message that names a
 * session without asking to build one is still a question.
 */
describe('isBuildRequest', () => {
  it('routes the suggested build question to drafting', () => {
    expect(isBuildRequest('Build me a session for today')).toBeTrue();
  });

  it('accepts the usual ways of asking for one', () => {
    for (const text of [
      'make me a workout for tonight',
      'Can you create a training plan for chest?',
      'draft a session, I have a barbell',
      'put together a routine for my shoulders'
    ]) {
      expect(isBuildRequest(text)).withContext(text).toBeTrue();
    }
  });

  it('leaves questions about training as questions', () => {
    for (const text of ['Should I train today?', 'How was my last session?', 'What should I eat tonight?']) {
      expect(isBuildRequest(text)).withContext(text).toBeFalse();
    }
  });

  it('needs both the verb and the subject', () => {
    expect(isBuildRequest('build me something')).toBeFalse();
    expect(isBuildRequest('my workout was hard')).toBeFalse();
  });
});
