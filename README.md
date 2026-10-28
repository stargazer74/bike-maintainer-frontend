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
- [Transloco](https://jsverse.gitbook.io/transloco) für Deutsch und Englisch

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
laufende Backend unter `http://localhost:8090` weiter (Port des Backend-Containers aus
`bike-maintainer-backend/compose.yaml`; bei `./mvnw spring-boot:run` ist es `8080`), um CORS-Probleme in der
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
Dev-Proxy bzw. im Container an den nginx des Frontend-Images gehen, siehe
„Docker-Image“).
Verwendung in einer Komponente z. B. so:

```ts
import { inject } from '@angular/core';
import { VehiclesService } from './api-client';

export class VehicleListComponent {
  private readonly vehiclesService = inject(VehiclesService);
  vehicles$ = this.vehiclesService.listVehicles();
}
```

## Docker-Image

Das Image (`Dockerfile`) baut die App und liefert sie mit nginx aus. Der nginx ist zugleich
der einzige Container, der nach außen erreichbar sein muss: Er leitet `/api/` an den
Backend-Container im internen Docker-Netz weiter (`nginx.conf.template`).

```
Internet ──443──▶ TLS-Proxy ──▶ frontend (nginx)
                                  ├── /      → SPA
                                  └── /api/  → backend:8080 (intern)
```

| Umgebungsvariable | Standard | Bedeutung |
|---|---|---|
| `BACKEND_HOST` | `bm-backend:8080` | Host und Port des Backends im Docker-Netz |
| `NGINX_RESOLVER` | `127.0.0.11` | DNS-Server, über den `BACKEND_HOST` pro Request aufgelöst wird (Dockers eingebautes DNS) |

`X-Forwarded-Proto`, `-Host` und `-For` eines vorgeschalteten TLS-Proxys werden ans Backend
durchgereicht (für `Secure`-Cookies und die Client-IP beim Rate-Limit). Fertige
Compose-Dateien für den Betrieb liegen in
[`bike-maintainer-deploy`](https://github.com/stargazer74/bike-maintainer-deploy).

Vor `docker build` muss `npm run generate:api` gelaufen sein, weil `src/app/api-client/`
im Build-Kontext liegen muss.

### Veröffentlichte Images

Die CI veröffentlicht das Image für `linux/amd64` und `linux/arm64` in der GitHub Container
Registry, `ghcr.io/stargazer74/bike-maintainer-frontend` – **nur bei Release-Tags**. PRs und
Pushes auf `main` werden nur gebaut und getestet.

| Git-Tag | Image-Tags |
|---|---|
| `vX.Y.Z` | `X.Y.Z`, `X.Y`, `X`, `latest` |

Die Angular-Build-Stage läuft nativ auf dem Runner
(`--platform=$BUILDPLATFORM`), nur die nginx-Stage wird pro Plattform gebaut.

**Release anlegen:** dieselbe Version hier und in `bike-maintainer-backend` taggen (z. B.
`v1.2.0`) und die Tags pushen – Backend und Frontend haben immer dieselbe Versionsnummer.

## Mehrsprachigkeit

Die Oberfläche gibt es auf Deutsch und Englisch. Übersetzt wird zur Laufzeit mit Transloco, es gibt also
nur einen Build. Die Texte stehen in `public/i18n/de.json` und `public/i18n/en.json`. Neue oder geänderte
Texte immer in **beiden** Dateien pflegen; ein Unit-Test schlägt fehl, wenn Schlüssel oder Platzhalter
nicht übereinstimmen.

Die Sprache lässt sich in der Toolbar umschalten (DE | EN). Beim ersten Aufruf gilt die Sprache des
Browsers (Fallback Deutsch), danach die zuletzt gewählte. Zahlen und Datumsangaben werden passend zur
Sprache formatiert (`12.500` / `12,500`, `09.10.2026` / `9 Oct 2026`).

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
