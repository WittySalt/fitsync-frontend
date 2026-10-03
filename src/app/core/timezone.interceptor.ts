import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { UserTimezoneService } from './user-timezone.service';

/** Sends the person's zone with every call to the backend API, so no endpoint needs a zone parameter. */
export const timezoneInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/v1/')) {
    return next(request);
  }
  return next(request.clone({ setHeaders: { 'X-Timezone': inject(UserTimezoneService).zone() } }));
};
