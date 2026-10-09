import { Component, Input } from '@angular/core';

import { CoachTurn, ToolInvocation, modelLabel, tierLabel } from '../../core/coach/coach.models';

/**
 * How an answer was produced, under the answer.
 *
 * Rendered from the persisted turn rather than from anything the client saw go by, so what the
 * trace shows is what the server recorded. The tier pill says which tier answered; the rows are
 * the tools in the order they ran, with what each found and how long it took.
 */
@Component({
  selector: 'app-coach-trace',
  template: `
    <details class="trace">
      <summary>How this was answered</summary>
      <div class="trace-body">
        <div class="trace-hdr">
          <span class="tier" [class.model]="(turn.tier ?? 0) >= 2">tier {{ turn.tier ?? '?' }} · {{ tier() }}</span>
          @if (model(); as name) {
            <span class="mono trace-model" [attr.title]="turn.model">{{ name }}</span>
          }
          @if (turn.latencyMs != null) {
            <span class="mono">{{ turn.latencyMs }} ms</span>
          }
          @if (turn.guardrailVerdict) {
            <span class="mono">{{ turn.guardrailVerdict.toLowerCase() }}</span>
          }
        </div>
        @for (tool of turn.tools; track tool.seq) {
          <div class="trace-row" [class.failed]="!tool.ok">
            <b class="trace-tool">{{ tool.tool }}</b>
            <span class="args">{{ argsLabel(tool.args) }}</span>
            <span class="trace-result" [attr.title]="resultLabel(tool)">{{ resultLabel(tool) }}</span>
          </div>
        }
        @if (!turn.tools.length) {
          <div class="trace-row"><b class="trace-tool">no tools</b><span class="trace-result">answered from the conversation alone</span></div>
        }
      </div>
    </details>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .trace {
        margin-top: 9px;
        border-top: 1px dashed var(--border);
        padding-top: 8px;
      }
      summary {
        cursor: pointer;
        font-size: var(--text-xs);
        font-weight: var(--fw-medium);
        color: var(--text-muted);
        list-style: none;
      }
      summary::-webkit-details-marker {
        display: none;
      }
      summary::before {
        content: '▸ ';
      }
      .trace[open] summary::before {
        content: '▾ ';
      }
      .trace-body {
        margin-top: 7px;
        font-size: var(--text-xs);
        line-height: 1.7;
        color: var(--text-muted);
        font-variant-numeric: tabular-nums;
      }
      .trace-hdr {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        margin-bottom: 4px;
      }
      .tier {
        display: inline-block;
        font-size: 10px;
        font-weight: var(--fw-semibold);
        letter-spacing: 0.06em;
        padding: 3px 5px;
        border-radius: var(--radius-sm);
        background: var(--accent-subtle);
        color: var(--accent-text);
        text-transform: uppercase;
      }
      .tier.model {
        background: color-mix(in srgb, var(--amber-500) 16%, var(--surface));
        color: var(--amber-500);
      }
      .mono {
        color: var(--text-secondary);
      }
      .trace-row {
        display: flex;
        align-items: baseline;
        min-width: 0;
      }
      .trace-tool {
        flex: none;
        color: var(--text-secondary);
        font-weight: var(--fw-medium);
        white-space: nowrap;
      }
      .trace-row .args {
        flex: 0 3 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--text-muted);
      }
      .trace-result {
        flex: 1 1 auto;
        min-width: 0;
        margin-left: 8px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-align: right;
      }
      .trace-row.failed .trace-result {
        color: var(--danger);
      }
    `
  ]
})
export class CoachTraceComponent {
  @Input({ required: true }) turn!: CoachTurn;

  tier(): string {
    return tierLabel(this.turn.tier);
  }

  /** The model's short name, or null when the turn recorded none. */
  model(): string | null {
    return modelLabel(this.turn.model);
  }

  /** What a tool found, or why it failed, with how long it took. */
  resultLabel(tool: ToolInvocation): string {
    const outcome = tool.ok ? (tool.resultSummary ?? 'ok') : (tool.error ?? 'failed');
    return `${outcome} · ${tool.latencyMs} ms`;
  }

  /** Arguments as a short parenthesised list, or nothing when the call took none. */
  argsLabel(args: string): string {
    try {
      const parsed: unknown = JSON.parse(args || '{}');
      if (!parsed || typeof parsed !== 'object') {
        return '';
      }
      const entries = Object.entries(parsed as Record<string, unknown>).filter(([, v]) => v != null && v !== '');
      if (!entries.length) {
        return '';
      }
      return `(${entries.map(([, v]) => String(v)).join(', ')})`;
    } catch {
      return '';
    }
  }
}
