import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const noAuthGuard: CanActivateFn = () => {
  const token = localStorage.getItem('token');
  if (!token) return true;

  inject(Router).navigateByUrl('/home', { replaceUrl: true });
  return false;
};
