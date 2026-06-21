import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { ImportResult, ImportSessionRow, WorkoutExport } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { WorkoutDataIoComponent } from './workout-data-io.component';

function importRow(overrides: Partial<ImportSessionRow> = {}): ImportSessionRow {
  return {
    externalId: 'ext-1',
    source: 'IMPORTED',
    planId: null,
    name: 'Morning run',
    workoutType: 'CARDIO',
    status: 'COMPLETED',
    startedAt: '2026-06-20T10:00:00Z',
    completedAt: '2026-06-20T10:32:00Z',
    durationMinutes: 32,
    caloriesBurned: 300,
    perceivedExertion: 6,
    notes: 'Imported',
    exercises: [],
    ...overrides
  };
}

const importResult: ImportResult = {
  imported: 1,
  skippedDuplicate: 1,
  rejected: 1,
  results: [
    { rowIndex: 0, externalId: 'ext-1', source: 'IMPORTED', status: 'IMPORTED', sessionId: 'session-1', reason: null },
    { rowIndex: 1, externalId: 'ext-2', source: 'IMPORTED', status: 'SKIPPED_DUPLICATE', sessionId: null, reason: 'Duplicate' },
    { rowIndex: 2, externalId: 'ext-3', source: 'IMPORTED', status: 'REJECTED', sessionId: null, reason: 'Invalid row' }
  ]
};

describe('WorkoutDataIoComponent', () => {
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let toast: jasmine.SpyObj<ToastService>;
  let restoreCreateObjectUrl: typeof URL.createObjectURL | undefined;
  let restoreRevokeObjectUrl: typeof URL.revokeObjectURL | undefined;

  beforeEach(async () => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
      'exportWorkoutData',
      'importSessions'
    ]);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);

    dataService.exportWorkoutData.and.returnValue(
      of({
        schemaVersion: 1,
        exportedAt: '2026-06-20T10:00:00Z',
        exercises: [],
        plans: [],
        sessions: []
      } satisfies WorkoutExport)
    );
    dataService.importSessions.and.returnValue(of(importResult));

    restoreCreateObjectUrl = URL.createObjectURL;
    restoreRevokeObjectUrl = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jasmine.createSpy('createObjectURL').and.returnValue('blob:fitsync')
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: jasmine.createSpy('revokeObjectURL')
    });

    await TestBed.configureTestingModule({
      imports: [WorkoutDataIoComponent],
      providers: [
        { provide: FitSyncDataService, useValue: dataService },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();
  });

  afterEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: restoreCreateObjectUrl
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: restoreRevokeObjectUrl
    });
  });

  it('exports workout data as a downloaded JSON file', () => {
    const fixture = TestBed.createComponent(WorkoutDataIoComponent);
    const originalCreateElement = document.createElement.bind(document);
    const click = jasmine.createSpy('click');
    spyOn(document, 'createElement').and.callFake((tagName: string, options?: ElementCreationOptions) => {
      const element = originalCreateElement(tagName, options);
      if (tagName.toLowerCase() === 'a') {
        spyOn(element as HTMLAnchorElement, 'click').and.callFake(click);
      }
      return element;
    });

    fixture.componentInstance.exportData();

    expect(dataService.exportWorkoutData).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(document.createElement).toHaveBeenCalledWith('a');
    expect(toast.success).toHaveBeenCalledWith('Workout data exported.');
  });

  it('imports sessions with the expected request body and renders row results', () => {
    const fixture = TestBed.createComponent(WorkoutDataIoComponent);
    fixture.detectChanges();

    fixture.componentInstance.importForm.controls.importText.setValue(
      JSON.stringify({ sessions: [importRow(), importRow({ externalId: 'ext-2' }), importRow({ externalId: 'ext-3' })] })
    );
    fixture.componentInstance.importData();
    fixture.detectChanges();

    expect(dataService.importSessions).toHaveBeenCalledWith([
      importRow(),
      importRow({ externalId: 'ext-2' }),
      importRow({ externalId: 'ext-3' })
    ]);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Imported');
    expect(text).toContain('Skipped Duplicate');
    expect(text).toContain('Rejected');
    expect(text).toContain('Invalid row');
  });

  it('omits completedAt for non-completed rows and accepts array JSON', () => {
    const fixture = TestBed.createComponent(WorkoutDataIoComponent);
    const row = importRow({ status: 'IN_PROGRESS', completedAt: undefined });

    fixture.componentInstance.importForm.controls.importText.setValue(JSON.stringify([row]));
    fixture.componentInstance.importData();

    const [rows] = dataService.importSessions.calls.mostRecent().args;
    expect(rows[0].status).toBe('IN_PROGRESS');
    expect(Object.prototype.hasOwnProperty.call(rows[0], 'completedAt')).toBeFalse();
  });

  it('blocks invalid completedAt combinations before posting', () => {
    const fixture = TestBed.createComponent(WorkoutDataIoComponent);
    const row = importRow({ status: 'IN_PROGRESS', completedAt: '2026-06-20T10:32:00Z' });

    fixture.componentInstance.importForm.controls.importText.setValue(JSON.stringify({ sessions: [row] }));
    fixture.componentInstance.importData();

    expect(dataService.importSessions).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Row 1 must omit completedAt unless status is COMPLETED.');
  });

  it('surfaces import write failures through toast errors', () => {
    dataService.importSessions.and.returnValue(throwError(() => new Error('bad request')));
    const fixture = TestBed.createComponent(WorkoutDataIoComponent);

    fixture.componentInstance.importForm.controls.importText.setValue(JSON.stringify({ sessions: [importRow()] }));
    fixture.componentInstance.importData();

    expect(toast.error).toHaveBeenCalledWith('Unable to import workout sessions. Please check the file and retry.');
    expect(fixture.componentInstance.importing()).toBeFalse();
  });

  it('guards duplicate exports and reports export errors', () => {
    const fixture = TestBed.createComponent(WorkoutDataIoComponent);
    fixture.componentInstance.exporting.set(true);

    fixture.componentInstance.exportData();
    expect(dataService.exportWorkoutData).not.toHaveBeenCalled();

    fixture.componentInstance.exporting.set(false);
    dataService.exportWorkoutData.and.returnValue(throwError(() => new Error('export failed')));
    fixture.componentInstance.exportData();

    expect(dataService.exportWorkoutData).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Unable to export workout data. Please retry.');
    expect(fixture.componentInstance.exporting()).toBeFalse();
  });

  it('uses today in the export filename when exportedAt is missing', () => {
    const fixture = TestBed.createComponent(WorkoutDataIoComponent);
    const originalCreateElement = document.createElement.bind(document);
    let anchor: HTMLAnchorElement | null = null;
    dataService.exportWorkoutData.and.returnValue(
      of({ schemaVersion: 1, exportedAt: '', exercises: [], plans: [], sessions: [] } satisfies WorkoutExport)
    );
    spyOn(document, 'createElement').and.callFake((tagName: string, options?: ElementCreationOptions) => {
      const element = originalCreateElement(tagName, options);
      if (tagName.toLowerCase() === 'a') {
        anchor = element as HTMLAnchorElement;
        spyOn(anchor, 'click').and.stub();
      }
      return element;
    });

    fixture.componentInstance.exportData();

    expect((anchor as unknown as HTMLAnchorElement).download).toMatch(/^fitsync-workout-export-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('guards empty, duplicate, and malformed imports before posting', () => {
    const fixture = TestBed.createComponent(WorkoutDataIoComponent);

    fixture.componentInstance.importData();
    expect(dataService.importSessions).not.toHaveBeenCalled();

    fixture.componentInstance.importing.set(true);
    fixture.componentInstance.importForm.controls.importText.setValue(JSON.stringify([importRow()]));
    fixture.componentInstance.importData();
    expect(dataService.importSessions).not.toHaveBeenCalled();

    fixture.componentInstance.importing.set(false);
    fixture.componentInstance.importForm.controls.importText.setValue('{bad json');
    fixture.componentInstance.importData();
    expect(toast.error).toHaveBeenCalledWith('Import JSON is not valid.');

    fixture.componentInstance.importForm.controls.importText.setValue(JSON.stringify({ rows: [] }));
    fixture.componentInstance.importData();
    expect(toast.error).toHaveBeenCalledWith('Import JSON must be an array or an object with a sessions array.');
  });

  it('rejects oversized imports, non-object rows, and missing required fields', () => {
    const fixture = TestBed.createComponent(WorkoutDataIoComponent);

    fixture.componentInstance.importForm.controls.importText.setValue(JSON.stringify(new Array(101).fill(importRow())));
    fixture.componentInstance.importData();
    expect(toast.error).toHaveBeenCalledWith('Import is limited to 100 sessions at a time.');

    fixture.componentInstance.importForm.controls.importText.setValue(JSON.stringify(['not a row']));
    fixture.componentInstance.importData();
    expect(toast.error).toHaveBeenCalledWith('Row 1 must be an object.');

    fixture.componentInstance.importForm.controls.importText.setValue(JSON.stringify([{ ...importRow(), name: '   ' }]));
    fixture.componentInstance.importData();
    expect(toast.error).toHaveBeenCalledWith('Row 1 is missing name.');

    fixture.componentInstance.importForm.controls.importText.setValue(JSON.stringify([{ ...importRow(), completedAt: undefined }]));
    fixture.componentInstance.importData();
    expect(toast.error).toHaveBeenCalledWith('Row 1 must include completedAt when status is COMPLETED.');
  });

  it('normalizes optional import fields with defaults and fallback numbers', () => {
    const fixture = TestBed.createComponent(WorkoutDataIoComponent);
    const row = {
      externalId: ' ext-optional ',
      source: ' IMPORTED ',
      planId: ' plan-1 ',
      name: ' Optional row ',
      workoutType: ' STRENGTH ',
      status: 'PLANNED',
      startedAt: ' 2026-06-20T10:00:00Z ',
      durationMinutes: 'not-a-number',
      caloriesBurned: undefined,
      perceivedExertion: 'not-a-number',
      notes: '   ',
      exercises: 'not an array'
    };

    fixture.componentInstance.importForm.controls.importText.setValue(JSON.stringify([row]));
    fixture.componentInstance.importData();

    expect(dataService.importSessions).toHaveBeenCalledWith([
      jasmine.objectContaining({
        externalId: 'ext-optional',
        source: 'IMPORTED',
        planId: ' plan-1 ',
        name: 'Optional row',
        workoutType: 'STRENGTH',
        durationMinutes: 0,
        caloriesBurned: 0,
        perceivedExertion: null,
        notes: null,
        exercises: []
      })
    ]);
  });

  it('uses the generic parse message for non-Error parser failures', () => {
    const fixture = TestBed.createComponent(WorkoutDataIoComponent);
    fixture.componentInstance.importForm.controls.importText.setValue(JSON.stringify([importRow()]));
    spyOn(fixture.componentInstance as unknown as { parseRows(text: string): ImportSessionRow[] }, 'parseRows').and.callFake(() => {
      throw 'parser exploded';
    });

    fixture.componentInstance.importData();

    expect(toast.error).toHaveBeenCalledWith('Unable to parse workout import JSON.');
    expect(dataService.importSessions).not.toHaveBeenCalled();
  });

  it('loads selected file text and reports file read errors', () => {
    const fixture = TestBed.createComponent(WorkoutDataIoComponent);
    const originalFileReader = window.FileReader;
    let mode: 'load' | 'error' = 'load';

    class FakeFileReader {
      result: string | ArrayBuffer | null = JSON.stringify([importRow()]);
      onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
      onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;
      readAsText(): void {
        if (mode === 'load') {
          this.onload?.(new ProgressEvent('load') as ProgressEvent<FileReader>);
        } else {
          this.onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>);
        }
      }
    }

    Object.defineProperty(window, 'FileReader', { configurable: true, value: FakeFileReader });

    fixture.componentInstance.handleFileSelected({ target: { files: [] } } as unknown as Event);
    expect(fixture.componentInstance.importForm.controls.importText.value).toBe('');

    fixture.componentInstance.handleFileSelected({ target: { files: [new File(['[]'], 'sessions.json')] } } as unknown as Event);
    expect(fixture.componentInstance.importForm.controls.importText.value).toContain('ext-1');

    mode = 'error';
    fixture.componentInstance.handleFileSelected({ target: { files: [new File(['[]'], 'sessions.json')] } } as unknown as Event);
    expect(toast.error).toHaveBeenCalledWith('Unable to read the selected file.');

    Object.defineProperty(window, 'FileReader', { configurable: true, value: originalFileReader });
  });

  it('formats import result statuses for display and CSS classes', () => {
    const fixture = TestBed.createComponent(WorkoutDataIoComponent);

    expect(fixture.componentInstance.formatStatus('SKIPPED_DUPLICATE')).toBe('Skipped Duplicate');
    expect(fixture.componentInstance.statusClass('SKIPPED_DUPLICATE')).toBe('skipped-duplicate');
  });
});
