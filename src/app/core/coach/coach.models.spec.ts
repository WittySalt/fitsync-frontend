import { modelLabel, tierLabel } from './coach.models';

describe('coach model labels', () => {
  it('names the rule and template tiers', () => {
    expect(tierLabel(0)).toBe('rule');
    expect(tierLabel(1)).toBe('template');
  });

  it('calls a model answer a model, whichever provider served it', () => {
    // Tier 2 is recorded for every provider (Anthropic, Bedrock, Ollama), so "local" would be untrue.
    expect(tierLabel(2)).toBe('model');
    expect(tierLabel(3)).toBe('model');
  });

  it('says the model was off, or that the tier is unknown', () => {
    expect(tierLabel(-1)).toBe('model off');
    expect(tierLabel(null)).toBe('unknown');
    expect(tierLabel(undefined)).toBe('unknown');
    expect(tierLabel(7)).toBe('unknown');
  });

  it('shortens a Bedrock inference-profile id to the model name', () => {
    expect(modelLabel('global.anthropic.claude-haiku-4-5-20251001-v1:0')).toBe('claude-haiku-4-5');
    expect(modelLabel('us.anthropic.claude-sonnet-4-5-20250929-v1:0')).toBe('claude-sonnet-4-5');
    expect(modelLabel('anthropic.claude-3-haiku-20240307-v1:0')).toBe('claude-3-haiku');
    expect(modelLabel('arn:aws:bedrock:ap-southeast-1:123456789012:inference-profile/global.anthropic.claude-haiku-4-5-20251001-v1:0')).toBe(
      'claude-haiku-4-5'
    );
  });

  it('keeps ids that are already short, such as Anthropic and Ollama names', () => {
    expect(modelLabel('claude-sonnet-4-6')).toBe('claude-sonnet-4-6');
    expect(modelLabel('claude-haiku-4-5-20251001')).toBe('claude-haiku-4-5');
    expect(modelLabel('llama3.1:8b')).toBe('llama3.1:8b');
  });

  it('is null when there is no model to name', () => {
    expect(modelLabel(null)).toBeNull();
    expect(modelLabel(undefined)).toBeNull();
    expect(modelLabel('   ')).toBeNull();
  });
});
