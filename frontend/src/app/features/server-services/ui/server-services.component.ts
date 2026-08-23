import { NgFor } from '@angular/common';
import { Component } from '@angular/core';
import { SERVER_SERVICE_ACTIONS } from '../domain/server-service-action';

@Component({
  selector: 'app-server-services',
  standalone: true,
  imports: [NgFor],
  template: `
    <section class="server-services-section">
      <article class="panel server-services-card row g-4">
        <div class="server-services-copy col-12 col-xl-5">
          <p class="eyebrow">Server services</p>
          <h3>Operaciones Docker del servidor</h3>
          <p class="server-services-note" id="server-service-description">
            Esperando estado del contenedor de Palworld.
          </p>
          <div class="server-services-pills">
            <span class="server-service-pill" id="server-service-status">unknown</span>
            <span class="server-service-pill" id="server-service-container">sin contenedor</span>
            <span class="server-service-pill" id="server-service-autostop">auto-stop off</span>
          </div>
          <div class="server-service-actions" role="group" aria-label="Operaciones Docker del servidor Palworld">
            <button
              *ngFor="let action of actions"
              [id]="'server-service-' + action.id"
              class="server-service-button"
              [class.start]="action.tone === 'start'"
              [class.restart]="action.tone === 'restart'"
              [class.stop]="action.tone === 'stop'"
              type="button"
              [attr.data-server-service-action]="action.id"
            >
              {{ action.label }}
            </button>
          </div>
          <p class="server-service-feedback" id="server-service-feedback">Sin operaciones recientes.</p>
        </div>

        <div class="server-services-details col-12 col-xl-7">
          <div class="server-service-stat-grid row g-3">
            <div class="server-service-stat col-12 col-md-4">
              <span>Disponibilidad</span>
              <strong id="server-service-availability">--</strong>
              <p id="server-service-state">Esperando Docker</p>
            </div>
            <div class="server-service-stat col-12 col-md-4">
              <span>Inactividad</span>
              <strong id="server-service-idle">--</strong>
              <p id="server-service-idle-note">Sin regla configurada</p>
            </div>
            <div class="server-service-stat col-12 col-md-4">
              <span>Última acción</span>
              <strong id="server-service-last-action">--</strong>
              <p id="server-service-last-action-note">Sin registros</p>
            </div>
          </div>
          <ul class="server-service-operation-list" id="server-service-operations"></ul>
        </div>
      </article>
    </section>
  `
})
export class ServerServicesComponent {
  readonly actions = SERVER_SERVICE_ACTIONS;
}
