import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

/**
 * AuthInterceptor — allega automaticamente l'header
 * Authorization: Bearer <token> a ogni richiesta HTTP.
 *
 * Se il server risponde con 401 (token scaduto / non valido):
 *   1. Pulisce tutto il localStorage
 *   2. Reindirizza al login con replaceUrl:true
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('token');

  // Clona la richiesta aggiungendo il token se disponibile
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        // Sessione scaduta o token non valido
        localStorage.clear();
        inject(Router).navigateByUrl('/login', { replaceUrl: true });
      }
      return throwError(() => err);
    })
  );
};
