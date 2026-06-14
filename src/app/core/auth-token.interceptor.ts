import { HttpInterceptorFn } from '@angular/common/http';

const TOKEN_STORAGE_KEY = 'fitsync.accessToken';

export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const token = typeof localStorage === 'undefined' ? null : localStorage.getItem(TOKEN_STORAGE_KEY);

  if (!token) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    })
  );
};

