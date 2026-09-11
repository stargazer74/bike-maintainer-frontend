# Bike Maintainer Frontend

Angular-Frontend für **Bike Maintainer** – eine Anwendung zur Digitalisierung von
Wartungsplänen für Motorräder und Autos. Wartungsintervalle (nach Kilometerstand
und/oder Zeit) werden pro Fahrzeug verwaltet; die App zeigt an, welche Aufgaben
fällig oder überfällig sind, und protokolliert durchgeführte Wartungen.

Dieses Repository enthält ausschließlich das Frontend. Backend und API-Spezifikation
liegen in den Nachbarprojekten:

- [`bike-maintainer-backend`](../bike-maintainer-backend) – Spring-Boot-Service
  (REST-API unter `/api/v1/...`, Standardport `8080`).
- [`bike-maintainer-api`](../bike-maintainer-api) – OpenAPI-Spezifikation der
  REST-Schnittstellen.

## Tech-Stack

- [Angular](https://angular.dev/) 22 (standalone components, Vitest als Test-Runner)
- TypeScript, SCSS
- Angular CLI

## Voraussetzungen

- Node.js 22+
- Java 17+ (nur für die Generierung des API-Clients, siehe unten)
- Laufendes Backend (siehe `bike-maintainer-backend/compose.yaml` für die
  MariaDB-Datenbank sowie `./mvnw spring-boot:run` für den Service)

## Setup & Entwicklung

```bash
# Abhängigkeiten installieren
npm install

# API-Client aus der OpenAPI-Spezifikation generieren (siehe unten)
npm run generate:api

# Dev-Server starten (http://localhost:4200)
npm start
```

Der Dev-Server leitet Requests an `/api` per Proxy (`proxy.conf.json`) an das lokal
laufende Backend unter `http://localhost:8080` weiter, um CORS-Probleme in der
Entwicklung zu vermeiden.

## API-Client

Die REST-Services werden nicht von Hand geschrieben, sondern per
[OpenAPI Generator](https://openapi-generator.tech/) aus der Spezifikation in
[`bike-maintainer-api`](../bike-maintainer-api/src/main/resources/maintenance-api.yaml)
generiert:

```bash
npm run generate:api
```

Das erzeugt in `src/app/api-client/` je Ressourcen-Tag der Spezifikation einen
injectable Angular-Service (`VehiclesService`, `MaintenanceTasksService`,
`MaintenanceLogsService`) inklusive typisierter Request-/Response-Modelle. Der
Ordner ist generiert und daher **nicht** eingecheckt (`.gitignore`) – nach dem
Klonen bzw. nach jeder Änderung an der Spezifikation muss der Befehl erneut
ausgeführt werden.

Eingebunden werden die Services über `provideApi('')` in `app.config.ts`
(leerer Base-Path, damit Requests relativ – z. B. `/api/v1/vehicles` – an den
Dev-Proxy bzw. im Produktivbetrieb an den vorgeschalteten Reverse-Proxy gehen).
Verwendung in einer Komponente z. B. so:

```ts
import { inject } from '@angular/core';
import { VehiclesService } from './api-client';

export class VehicleListComponent {
  private readonly vehiclesService = inject(VehiclesService);
  vehicles$ = this.vehiclesService.listVehicles();
}
```

## Weitere Befehle

```bash
# Produktions-Build (Ausgabe in dist/)
npm run build

# Unit-Tests (Vitest)
npm test
```

## Status

Frühe Entwicklungsphase – aktuell nur das Angular-CLI-Grundgerüst. Die eigentlichen
Fachlichkeiten (Fahrzeuge, Wartungspläne, Historie) sind noch nicht implementiert.
