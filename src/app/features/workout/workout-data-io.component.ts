import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { ImportResult, ImportSessionRow, WorkoutExport } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';

@Component({
  selector: 'app-workout-data-io',
  imports: [ReactiveFormsModule],
  templateUrl: './workout-data-io.component.html',
  styleUrl: './workout-data-io.component.scss'
})
export class WorkoutDataIoComponent {
  private readonly dataService = inject(FitSyncDataService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  @Output() imported = new EventEmitter<ImportResult>();

  readonly exporting = signal(false);
  readonly importing = signal(false);
  readonly result = signal<ImportResult | null>(null);

  readonly importForm = this.fb.nonNullable.group({
    importText: ['', Validators.required]
  });

  exportData(): void {
    if (this.exporting()) {
      return;
    }

    this.exporting.set(true);
    this.dataService.exportWorkoutData().subscribe({
      next: (data) => {
        this.downloadExport(data);
        this.toast.success('Workout data exported.');
      },
      error: () => {
        this.toast.error('Unable to export workout data. Please retry.');
        this.exporting.set(false);
      },
      complete: () => this.exporting.set(false)
    });
  }

  importData(): void {
    this.importForm.markAllAsTouched();
    if (this.importForm.invalid || this.importing()) {
      return;
    }

    let rows: ImportSessionRow[];
    try {
      rows = this.parseRows(this.importForm.controls.importText.value);
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Unable to parse workout import JSON.');
      return;
    }

    this.importing.set(true);
    this.dataService.importSessions(rows).subscribe({
      next: (result) => {
        this.result.set(result);
        this.toast.success('Workout import finished.');
        this.imported.emit(result);
      },
      error: () => {
        this.toast.error('Unable to import workout sessions. Please check the file and retry.');
        this.importing.set(false);
      },
      complete: () => this.importing.set(false)
    });
  }

  handleFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.importForm.controls.importText.setValue(String(reader.result ?? ''));
    };
    reader.onerror = () => this.toast.error('Unable to read the selected file.');
    reader.readAsText(file);
  }

  formatStatus(status: string): string {
    return status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  }

  statusClass(status: string): string {
    return status.toLowerCase().replaceAll('_', '-');
  }

  private parseRows(text: string): ImportSessionRow[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Import JSON is not valid.');
    }

    let sessions: unknown[] | null = null;
    if (Array.isArray(parsed)) {
      sessions = parsed;
    } else if (this.isRecord(parsed) && Array.isArray(parsed['sessions'])) {
      sessions = parsed['sessions'];
    }

    if (!sessions) {
      throw new Error('Import JSON must be an array or an object with a sessions array.');
    }
    if (sessions.length > 100) {
      throw new Error('Import is limited to 100 sessions at a time.');
    }

    return sessions.map((row, index) => this.normalizeRow(row, index));
  }

  private normalizeRow(row: unknown, index: number): ImportSessionRow {
    if (!this.isRecord(row)) {
      throw new Error(`Row ${index + 1} must be an object.`);
    }

    const required = ['externalId', 'source', 'name', 'workoutType', 'status', 'startedAt'];
    for (const field of required) {
      if (typeof row[field] !== 'string' || !String(row[field]).trim()) {
        throw new Error(`Row ${index + 1} is missing ${field}.`);
      }
    }

    const status = String(row['status']);
    const hasCompletedAt = typeof row['completedAt'] === 'string' && String(row['completedAt']).trim().length > 0;
    if (status === 'COMPLETED' && !hasCompletedAt) {
      throw new Error(`Row ${index + 1} must include completedAt when status is COMPLETED.`);
    }
    if (status !== 'COMPLETED' && hasCompletedAt) {
      throw new Error(`Row ${index + 1} must omit completedAt unless status is COMPLETED.`);
    }

    const normalized: ImportSessionRow = {
      externalId: String(row['externalId']).trim(),
      source: String(row['source']).trim(),
      planId: typeof row['planId'] === 'string' ? String(row['planId']) : null,
      name: String(row['name']).trim(),
      workoutType: String(row['workoutType']).trim(),
      status,
      startedAt: String(row['startedAt']).trim(),
      durationMinutes: this.numberValue(row['durationMinutes']),
      caloriesBurned: this.numberValue(row['caloriesBurned']),
      perceivedExertion: this.nullableNumberValue(row['perceivedExertion']),
      notes: typeof row['notes'] === 'string' && row['notes'].trim() ? String(row['notes']).trim() : null,
      exercises: Array.isArray(row['exercises']) ? (row['exercises'] as ImportSessionRow['exercises']) : []
    };

    if (status === 'COMPLETED') {
      normalized.completedAt = String(row['completedAt']).trim();
    }

    return normalized;
  }

  private numberValue(value: unknown): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private nullableNumberValue(value: unknown): number | null {
    if (value == null || value === '') {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private downloadExport(data: WorkoutExport): void {
    const exportedDate = data.exportedAt ? data.exportedAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `fitsync-workout-export-${exportedDate}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
