import { NgFor } from '@angular/common';
import { Component } from '@angular/core';
import { PALDEX_SECTION_TABS } from '../domain/paldex-section';

@Component({
  selector: 'app-paldex-catalog',
  standalone: true,
  imports: [NgFor],
  templateUrl: './paldex-catalog.component.html'
})
export class PaldexCatalogComponent {
  readonly tabs = PALDEX_SECTION_TABS;
}
