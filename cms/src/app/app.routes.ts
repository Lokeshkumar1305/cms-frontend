import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { ProductConfigComponent } from './components/product-config/product-config.component';
import { CaseBuilderComponent } from './components/case-builder/case-builder.component';
import { CaseCreateComponent } from './components/case-create/case-create.component';
import { CaseWorkspaceComponent } from './components/case-workspace/case-workspace.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'product-config', component: ProductConfigComponent },
  { path: 'case-config', component: CaseBuilderComponent },
  { path: 'case-config/create', component: CaseCreateComponent },
  { path: 'cases', component: CaseWorkspaceComponent },
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: '/dashboard' }
];
