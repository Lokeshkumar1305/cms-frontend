import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { TenantContextService, ProductTenant } from '../../services/tenant-context.service';

@Component({
  selector: 'app-header',
  standalone: false,
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  @Output() toggleSidebar = new EventEmitter<void>();
  
  username: string = '';
  userEmail: string = '';
  userInitials: string = '';
  activeTenant: ProductTenant | null = null;

  constructor(
    private authService: AuthService,
    private tenantContext: TenantContextService
  ) {}

  ngOnInit(): void {
    this.username  = this.authService.getUsername();
    this.userEmail = this.authService.getUserEmail();
    this.userInitials = this.username.substring(0, 2).toUpperCase();

    this.tenantContext.activeTenant$.subscribe(tenant => {
      this.activeTenant = tenant;
    });
  }

  onToggleSidebar(): void {
    this.toggleSidebar.emit();
  }

  logout(): void {
    this.authService.logout();
  }
}
