import { AfterViewInit, Component } from '@angular/core';
import { bootstrapDashboard } from './dashboard.bootstrap';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html'
})
export class AppComponent implements AfterViewInit {
  ngAfterViewInit(): void {
    bootstrapDashboard();
  }
}
