import { AfterViewInit, Component } from '@angular/core';
import { bootstrapDashboard } from './dashboard.bootstrap';
import { ServerServicesComponent } from './features/server-services/ui/server-services.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ServerServicesComponent],
  templateUrl: './app.component.html'
})
export class AppComponent implements AfterViewInit {
  ngAfterViewInit(): void {
    bootstrapDashboard();
  }
}
