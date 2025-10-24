# 1aShirt – Produktions- & Auftragsmanagement

> Replit-fähiges Monorepo (Node/Express + React/Vite) für Auftragsverwaltung, Produktionsplanung, und Abrechnung

## Architektur

* **/server**: Node 20, TypeScript, Express, Prisma ORM, SQLite
* **/client**: React + Vite + TypeScript, Tailwind, shadcn/ui, TanStack Query
* **Prisma Database**: SQLite mit vollständigem Schema (siehe `prisma/schema.prisma`)

## Quick Start

### Option 1: Parallel Development (Empfohlen)

Beide Server gleichzeitig starten:

```bash
./dev.sh
```

Oder mit npx:

```bash
npx concurrently "node server/dev.js" "cd client && npx vite --port 5173 --host 0.0.0.0"
```

Dies startet:
- **API Server** auf http://localhost:3000
- **Client/Vite** auf http://localhost:5173

### Option 2: Einzeln Starten

**Server (Terminal 1):**
```bash
node server/dev.js
# Läuft auf Port 3000
```

**Client (Terminal 2):**
```bash
cd client && npx vite --port 5173 --host 0.0.0.0
# Läuft auf Port 5173
```

## Projekt-Struktur

```
/
├── prisma/
│   ├── schema.prisma          # Vollständiges Datenbankschema
│   ├── migrations/            # Datenbank-Migrationen
│   └── dev.db                 # SQLite Datenbank (entwicklung)
├── server/
│   ├── index.ts               # Express Server (Minimal - nur Health Check)
│   ├── dev.js                 # Server-Runner mit ts-node
│   └── tsconfig.json          # TypeScript-Konfiguration
├── client/
│   └── src/                   # React App mit Vite
├── shared/                    # Geteilte TypeScript Types
├── Procfile                   # Replit/Deployment-Konfiguration
└── dev.sh                     # Development-Start-Script
```

## Datenbank

Die SQLite-Datenbank wurde mit Prisma initialisiert und enthält folgende Models:

- **User**: Benutzer mit Rollen (ADMIN, DISPO, PRODUKTION, LAGER, ABRECHNUNG)
- **WorkCenter**: Produktionsbereiche mit Kapazitäten
- **Order**: Aufträge (JTL oder intern)
- **SizeTable**: Größentabellen für Aufträge
- **PrintAsset**: Druckdaten für Aufträge
- **TimeSlot**: Produktionsplanung (15-Min-Raster, 07:00-18:00)
- **JTLOrderPosition**: JTL-CSV-Import-Positionen
- **InvoiceQueueItem**: Abrechnungs-Queue

### Prisma-Befehle

```bash
# Prisma Client generieren
npx prisma generate

# Neue Migration erstellen
npx prisma migrate dev --name beschreibung

# Datenbank-Schema ansehen
npx prisma studio
```

## API Endpoints (Minimal Setup)

Aktuell implementiert:

- `GET /api/health` - Health Check Endpoint

## Nächste Schritte

Die Monorepo-Skeleton ist komplett eingerichtet. Nächste Implementierungsphasen:

1. **Backend API**: Vollständige REST-Endpoints für Orders, Slots, JTL-Import, Billing
2. **Frontend**: React-Komponenten für Auftragsverwaltung, Planung, Produktion
3. **Auth**: JWT-basierte Authentifizierung
4. **Business Logic**: JTL-CSV-Import, Slot-Planung, Abrechnungs-Workflow

## Deployment (Replit)

Das Projekt verwendet ein `Procfile` für Replit-Deployment:

```
web: npx concurrently "node server/dev.js" "cd client && npx vite --port 5173 --host 0.0.0.0"
```

## Development Notes

- Server läuft auf Port **3000** (konfigurierbar via `PORT` env var)
- Client läuft auf Port **5173** 
- Beide Prozesse laufen parallel im Development-Modus
- TypeScript-Dateien werden via `ts-node` ausgeführt
- Hot-Reload aktiviert für Server und Client
