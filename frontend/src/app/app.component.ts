import { AfterViewInit, Component } from '@angular/core';
import { bootstrapDashboard } from './dashboard.bootstrap';
import { DashboardOverviewComponent } from './features/dashboard-overview/ui/dashboard-overview.component';
import { ElementalGuideComponent } from './features/elemental-guide/ui/elemental-guide.component';
import { PaldexCatalogComponent } from './features/paldex-catalog/ui/paldex-catalog.component';
import { ServerServicesComponent } from './features/server-services/ui/server-services.component';
import { WorldMonitoringComponent } from './features/world-monitoring/ui/world-monitoring.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    DashboardOverviewComponent,
    WorldMonitoringComponent,
    ServerServicesComponent,
    PaldexCatalogComponent,
    ElementalGuideComponent
  ],
  templateUrl: './app.component.html'
})
export class AppComponent implements AfterViewInit {
  ngAfterViewInit(): void {
    bootstrapDashboard();
  }
}
