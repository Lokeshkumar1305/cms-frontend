import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private isLoggedInSubject = new BehaviorSubject<boolean>(false);
  isLoggedIn$: Observable<boolean> = this.isLoggedInSubject.asObservable();

  constructor() {
    // Check if there is a session stored in localStorage to persist login
    const session = localStorage.getItem('isLoggedIn');
    if (session === 'true') {
      this.isLoggedInSubject.next(true);
    }
  }

  login(email: string, password: string): boolean {
    if (email.trim() && password.trim()) {
      this.isLoggedInSubject.next(true);
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('userEmail', email);
      localStorage.setItem('username', email.split('@')[0]);
      return true;
    }
    return false;
  }

  getUsername(): string {
    return localStorage.getItem('username') || '';
  }

  getUserEmail(): string {
    return localStorage.getItem('userEmail') || '';
  }

  logout(): void {
    this.isLoggedInSubject.next(false);
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username');
    localStorage.removeItem('userEmail');
  }
}
