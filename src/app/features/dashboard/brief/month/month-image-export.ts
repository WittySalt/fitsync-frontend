import { InjectionToken } from '@angular/core';

import { MonthImageModel, renderMonthImage, saveBlobAs } from './month-image';

/** The two steps that need a browser: drawing the picture and handing it to the device. A token
 *  of its own lets a spec stand in for them. */
export interface MonthImageExport {
  make(model: MonthImageModel): Promise<Blob>;
  save(blob: Blob, fileName: string): void;
}

export const MONTH_IMAGE_EXPORT = new InjectionToken<MonthImageExport>('MONTH_IMAGE_EXPORT', {
  providedIn: 'root',
  factory: () => ({ make: renderMonthImage, save: saveBlobAs })
});
