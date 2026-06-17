import { Component, Input } from '@angular/core';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  badge?: {
    text: string;
    class: string;
  };
}

@Component({
  selector: 'app-sidenav',
  standalone: false,
  templateUrl: './sidenav.component.html',
  styleUrls: ['./sidenav.component.scss']
})
export class SidenavComponent {
  @Input() isCollapsed = false;

  navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'bi-columns-gap', route: 'dashboard' },
    { label: 'Product Config', icon: 'bi-hdd-network', route: 'product-config' },
    { label: 'Case Configuration', icon: 'bi-sliders', route: 'case-config' },
    { label: 'Case Workspace', icon: 'bi-briefcase', route: 'cases' }
  ];

  activeRoute = 'dashboard';

  setActive(route: string): void {
    this.activeRoute = route;
  }
}
