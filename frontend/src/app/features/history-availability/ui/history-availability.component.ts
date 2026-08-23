import { NgFor } from '@angular/common';
import { Component } from '@angular/core';
import { HISTORY_BUCKET_OPTIONS } from '../domain/history-bucket';

@Component({
  selector: 'app-history-availability',
  standalone: true,
  imports: [NgFor],
  templateUrl: './history-availability.component.html'
})
export class HistoryAvailabilityComponent {
  readonly buckets = HISTORY_BUCKET_OPTIONS;
}
