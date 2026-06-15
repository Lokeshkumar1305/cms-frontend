import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { TenantContextService, ProductTenant } from './services/tenant-context.service';

@Component({
  selector: 'app-root',
  standalone: false,
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'cms';
  isLoggedIn$!: Observable<boolean>;
  isSidebarCollapsed = false;
  activeTenant: ProductTenant | null = null;

  constructor(
    private authService: AuthService,
    private tenantContext: TenantContextService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.isLoggedIn$ = this.authService.isLoggedIn$;
    
    // Auth redirect logic
    this.isLoggedIn$.subscribe(loggedIn => {
      if (loggedIn) {
        // If logged in and on login route, go to dashboard
        const currentPath = window.location.pathname;
        if (currentPath === '/login' || currentPath === '/' || currentPath === '') {
          this.router.navigate(['/dashboard']);
        }
      } else {
        this.router.navigate(['/login']);
      }
    });

    // Listen to active tenant context changes
    this.tenantContext.activeTenant$.subscribe(tenant => {
      this.activeTenant = tenant;
    });
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }
}
