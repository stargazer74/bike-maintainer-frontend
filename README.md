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
- Laufendes Backend (siehe `bike-maintainer-backend/compose.yaml` für die
  MariaDB-Datenbank sowie `./mvnw spring-boot:run` für den Service)

## Setup & Entwicklung

```bash
# Abhängigkeiten installieren
npm install

# Dev-Server starten (http://localhost:4200)
npm start
```

Der Dev-Server leitet Requests an `/api` per Proxy (`proxy.conf.json`) an das lokal
laufende Backend unter `http://localhost:8080` weiter, um CORS-Probleme in der
Entwicklung zu vermeiden.

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
