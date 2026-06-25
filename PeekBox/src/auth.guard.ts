import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/**
 * AuthGuard — blocca l'accesso alle rotte protette se il token JWT
 * non è presente nel localStorage. In caso di accesso non autorizzato
 * reindirizza al login con replaceUrl:true per non sporcare la history.
 */
export const authGuard: CanActivateFn = () => {
  const token = localStorage.getItem('token');
  if (token) return true;

  inject(Router).navigateByUrl('/login', { replaceUrl: true });
  return false;
};
