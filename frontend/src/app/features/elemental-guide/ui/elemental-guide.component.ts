import { NgFor } from '@angular/common';
import { Component } from '@angular/core';
import { ELEMENTAL_MATCHUPS, ELEMENTAL_REFERENCES } from '../domain/elemental-guide';

@Component({
  selector: 'app-elemental-guide',
  standalone: true,
  imports: [NgFor],
  templateUrl: './elemental-guide.component.html'
})
export class ElementalGuideComponent {
  readonly matchups = ELEMENTAL_MATCHUPS;
  readonly references = ELEMENTAL_REFERENCES;
}
