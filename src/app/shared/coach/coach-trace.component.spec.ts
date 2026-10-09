import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CoachTurn } from '../../core/coach/coach.models';
import { CoachTraceComponent } from './coach-trace.component';

function turn(overrides: Partial<CoachTurn>): CoachTurn {
  return {
    turnId: 't1',
    seq: 1,
    role: 'ASSISTANT',
    content: 'ok',
    tier: 2,
    model: null,
    promptTokens: null,
    completionTokens: null,
    latencyMs: 4312,
    guardrailVerdict: 'PASSED',
    tools: [],
    createdAt: '',
    ...overrides
  };
}

describe('CoachTraceComponent', () => {
  let fixture: ComponentFixture<CoachTraceComponent>;
  let element: HTMLElement;

  const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  function render(value: CoachTurn): void {
    fixture = TestBed.createComponent(CoachTraceComponent);
    fixture.componentRef.setInput('turn', value);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  }

  function styles(): string {
    return ((CoachTraceComponent as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? []).join('').replace(/\[_ngcontent-%COMP%\]/g, '');
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CoachTraceComponent] }).compileComponents();
  });

  it('labels a model answer as a model, not a local one', () => {
    render(turn({ tier: 2 }));

    expect(text(element.querySelector('.tier'))).toBe('tier 2 · model');
    expect(element.textContent).not.toContain('local');
  });

  it('names the model in short when the turn recorded one', () => {
    render(turn({ model: 'global.anthropic.claude-haiku-4-5-20251001-v1:0' }));

    const model = element.querySelector('.trace-model');
    expect(text(model)).toBe('claude-haiku-4-5');
    expect(model?.getAttribute('title')).toBe('global.anthropic.claude-haiku-4-5-20251001-v1:0');
  });

  it('keeps the tool name whole and in its own element, apart from a long summary', () => {
    const summary = 'goal progress 2026-09-12 to 2026-10-09 · 3 goals across weight, sessions and protein';
    render(
      turn({
        tools: [{ seq: 1, tool: 'readGoalProgress', args: '{"goalId":"g-1"}', resultSummary: summary, latencyMs: 269, ok: true, error: null }]
      })
    );

    const row = element.querySelector('.trace-row');
    expect(text(row?.querySelector('.trace-tool') ?? null)).toBe('readGoalProgress');
    expect(text(row?.querySelector('.args') ?? null)).toBe('(g-1)');
    const result = row?.querySelector('.trace-result');
    expect(text(result ?? null)).toBe(`${summary} · 269 ms`);
    expect(result?.getAttribute('title')).toBe(`${summary} · 269 ms`);
  });

  it('never lets the tool name shrink; the arguments and the summary give way instead', () => {
    const css = styles();
    const tool = /\.trace-tool \{[^}]*\}/.exec(css)?.[0] ?? '';
    const result = /\.trace-result \{[^}]*\}/.exec(css)?.[0] ?? '';
    const args = /\.trace-row\s+\.args\s*\{[^}]*\}/.exec(css)?.[0] ?? '';

    expect(tool).toMatch(/flex: none|flex-shrink: 0/);
    for (const rule of [result, args]) {
      expect(rule).toContain('min-width: 0');
      expect(rule).toContain('text-overflow: ellipsis');
      expect(rule).toContain('overflow: hidden');
    }
  });
});
