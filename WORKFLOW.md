# 1aShirt Workflow & Status-System

## Übersicht

Dieses Dokument beschreibt den kompletten Workflow eines Auftrags von der Erstellung bis zur Abrechnung im 1aShirt Produktionssystem.

---

## 📊 Alle Workflow-Status

Das System verwaltet Aufträge durch 9 Status-Stufen:

| Status | Deutsch | Beschreibung | Badge-Farbe | Bereich |
|--------|---------|--------------|-------------|---------|
| `ENTWURF` | Entwurf | Auftrag wird noch bearbeitet (aktuell nicht verwendet) | Grau | Vorbereitung |
| `NEU` | Entwurf | Neuer Auftrag erstellt, wird bearbeitet | Blau (Primary) | Vorbereitung |
| `PRUEFUNG` | Prüfung | Auftrag wird geprüft (aktuell nicht verwendet) | Gelb (Amber) | Vorbereitung |
| `FUER_PROD` | Für Produktion | Bereit für Produktionsplanung | Dunkelblau | Planung |
| `IN_PROD` | In Produktion | Wird aktuell produziert | Violett | Produktion |
| `WARTET_FEHLTEILE` | Wartet auf Fehlteile | Produktion blockiert wegen fehlender Teile | Orange | Produktion |
| `FERTIG` | Produktion fertig | Produktion abgeschlossen | Grün (Emerald) | Abschluss |
| `ZUR_ABRECHNUNG` | Ausgabe erfolgt | Ware ausgeliefert, bereit für Abrechnung | Hellgrau | Abrechnung |
| `ABGERECHNET` | Abgerechnet | Auftrag vollständig abgerechnet | Grau | Abgeschlossen |

---

## 🔄 Workflow-Durchlauf im Detail

### Phase 1: Auftragserstellung

#### 1️⃣ Neuen Auftrag anlegen

**Aktion:** Benutzer erstellt einen neuen internen Auftrag

**Was passiert:**
```
POST /api/orders
→ Auftrag wird erstellt
→ Automatische Nummer generiert (z.B. INT-2025-1000)
→ Status: NEU
→ Quelle: INTERNAL
```

**Erforderliche Daten:**
- Titel
- Kunde
- Abteilung (TEAMSPORT, TEXTILVEREDELUNG, STICKEREI, DRUCK, SONSTIGES)

**System-Logik:**
```typescript
// Backend: server/storage.ts - createOrder()
const displayOrderNumber = await this.generateDisplayOrderNumber();
// Format: INT-{JAHR}-{LAUFNUMMER}
// Beispiel: INT-2025-1000

const order = await prisma.order.create({
  data: {
    ...orderData,
    source: 'INTERNAL',
    workflow: 'NEU',
    displayOrderNumber,
  }
});
```

---

### Phase 2: Auftragsvorbereitung

#### 2️⃣ Daten erfassen

**Status bleibt:** `NEU`

**Erforderliche Schritte:**

##### A) Positionen anlegen
- Mindestens **1 Position** erforderlich
- Position = Produkt/Artikel im Auftrag

##### B) Für TEAMSPORT-Abteilung:
1. **Größentabelle erfassen**
   - Schema wählen (ALPHA, NUMERIC, CUSTOM)
   - Größen, Nummern, Namen eintragen
   - Tab "Größentabelle" im Auftrag

2. **Druckdateien hochladen**
   - Mindestens **1 PRINT-Asset** hochladen
   - **WICHTIG:** Häkchen "Erforderlich für Freigabe" setzen!
   - Tab "Druckdaten / Anhänge" im Auftrag

##### C) Für andere Abteilungen:
- Mindestens **1 Position** erforderlich
- Größentabelle optional
- Assets optional

---

### Phase 3: In Produktion geben

#### 3️⃣ Auftrag freigeben (Submit)

**Aktion:** Button "In Produktion geben" klicken

**Status-Wechsel:** `NEU` → `FUER_PROD`

**Validierung (automatisch):**

```typescript
// Backend: server/storage.ts - submitOrder()

// 1. Mindestens eine Position vorhanden?
if (!order.positions || order.positions.length === 0) {
  throw new Error('At least one position is required');
}

// 2. Für TEAMSPORT: Größentabelle vorhanden?
if (order.department === 'TEAMSPORT') {
  if (!order.sizeTable) {
    throw new Error('Size table required for TEAMSPORT department');
  }
  
  // 3. Für TEAMSPORT: Mind. 1 erforderliches PRINT-Asset?
  const hasPrintAsset = order.orderAssets.some(
    asset => asset.kind === 'PRINT' && asset.required && (asset.path || asset.url)
  );
  if (!hasPrintAsset) {
    throw new Error('At least one PRINT asset (path or upload) is required for TEAMSPORT department');
  }
}

// Alle Checks bestanden → Status ändern
await prisma.order.update({
  where: { id: orderId },
  data: { workflow: 'FUER_PROD' }
});
```

**Mögliche Fehler:**
- ❌ "At least one position is required"
- ❌ "Size table required for TEAMSPORT department"
- ❌ "At least one PRINT asset (path or upload) is required for TEAMSPORT department"

**Nach erfolgreicher Freigabe:**
- Auftrag erscheint in der Produktionsplanung
- Kann jetzt TimeSlots zugewiesen werden

---

### Phase 4: Produktionsplanung

#### 4️⃣ TimeSlots erstellen

**Wer:** Produktionsplaner (Rolle: PROD_PLAN oder ADMIN)

**Wo:** Seite "Planung" oder "Produktion"

**Status bleibt:** `FUER_PROD`

**Was wird geplant:**
```
POST /api/timeslots
→ Datum wählen (z.B. 28.10.2025)
→ Uhrzeit wählen (07:00-18:00, 5-Minuten-Raster)
→ Bereich wählen (z.B. "Druck-Station 1")
→ Auftrag zuweisen
→ TimeSlot Status: PLANNED
```

**Kapazitäts-Validierung:**
- Jeder Bereich hat eine maximale Parallelkapazität (Standard: 2)
- Reguläre TimeSlots belegen 1 Kapazität
- Blocker belegen volle Kapazität
- System prüft bei Erstellung: Kapazität überschritten? → HTTP 422 Fehler

**Beispiel:**
```typescript
// Bereich: Druck-Station 1 (Kapazität: 2)
// 28.10.2025, 08:00-10:00

TimeSlot 1: FC Bayern Trikots (belegt 1 Kapazität)
TimeSlot 2: Hoodies mit Logo (belegt 1 Kapazität)
→ Kapazität ausgelastet! ✅

TimeSlot 3: Weitere Auftrag → FEHLER: Kapazität überschritten! ❌
```

---

### Phase 5: Produktion starten

#### 5️⃣ TimeSlot starten

**Wer:** Produktionsmitarbeiter (Rolle: PROD_RUN oder ADMIN)

**Wo:** Seite "Produktion" (heute/morgen)

**Aktion:** Play-Button (▶️) klicken

**Status-Wechsel:**
- TimeSlot: `PLANNED` → `RUNNING`
- **Auftrag:** `FUER_PROD` → `IN_PROD` (automatisch beim ersten Start!)

**System-Logik:**
```typescript
// Backend: server/storage.ts - startTimeSlot()

// Validierung
if (slot.status !== 'PLANNED' && slot.status !== 'PAUSED') {
  throw new Error('TimeSlot kann nur aus Status PLANNED oder PAUSED gestartet werden');
}

// TimeSlot starten
await prisma.timeSlot.update({
  where: { id },
  data: {
    status: 'RUNNING',
    startedAt: slot.status === 'PLANNED' ? new Date() : slot.startedAt,
  }
});

// WICHTIG: Auftrag-Status wird automatisch auf IN_PROD gesetzt
// (beim ersten TimeSlot-Start)
```

**Was wird gespeichert:**
- Startzeitpunkt (`startedAt`)
- Status RUNNING
- Live-Timer läuft in der Oberfläche

---

### Phase 6: Produktion läuft

#### 6️⃣ Während der Produktion

**Status:** 
- TimeSlot: `RUNNING`
- Auftrag: `IN_PROD`

**Mögliche Aktionen:**

##### A) Pause
```
POST /api/timeslots/:id/pause
→ TimeSlot: RUNNING → PAUSED
→ Kann später fortgesetzt werden (wieder starten)
→ Auftrag bleibt: IN_PROD
```

##### B) Stopp (Fertigstellen)
```
POST /api/timeslots/:id/stop
→ TimeSlot: RUNNING/PAUSED → DONE
→ Stopzeitpunkt wird gespeichert (stoppedAt)
→ Automatische Prüfung: Alle TimeSlots DONE? → Auftrag wird fertig!
```

**Auto-Complete-Logik:**
```typescript
// Backend: server/storage.ts - checkAndCompleteOrder()

async function checkAndCompleteOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { timeSlots: true }
  });
  
  // Alle TimeSlots DONE?
  const allDone = order.timeSlots.every(slot => slot.status === 'DONE');
  
  // Keine blockierten TimeSlots?
  const hasBlocked = order.timeSlots.some(slot => slot.status === 'BLOCKED');
  
  // Automatisch auf FERTIG setzen!
  if (allDone && !hasBlocked && order.workflow !== 'FERTIG') {
    await prisma.order.update({
      where: { id: orderId },
      data: { workflow: 'FERTIG' }
    });
  }
}
```

##### C) Qualitätskontrolle
```
POST /api/timeslots/:id/qc
→ QC-Status setzen: IO (in Ordnung) oder NIO (nicht in Ordnung)
→ Nur möglich wenn TimeSlot Status = DONE
```

---

### Phase 7: Problem - Fehlteile

#### 7️⃣ Fehlende Teile melden

**Wann:** Produktion kann nicht fortgesetzt werden

**Aktion:** Button "Problem melden" → "Fehlteile"

**Dialog-Optionen:**
- Notiz zu fehlenden Teilen eingeben
- Häkchen: "Auftragsstatus auf WARTET_FEHLTEILE ändern"

**Status-Wechsel:**
```
POST /api/timeslots/:id/missing-parts
→ TimeSlot: → BLOCKED
→ Auftrag: IN_PROD → WARTET_FEHLTEILE (wenn Häkchen gesetzt)
→ Notiz wird gespeichert (missingPartsNote)
```

**System-Logik:**
```typescript
// Backend: server/storage.ts - setTimeSlotMissingParts()

await prisma.timeSlot.update({
  where: { id },
  data: {
    missingPartsNote: note,
    status: 'BLOCKED',
  }
});

// Optional: Auftrag blockieren
if (updateOrderWorkflow) {
  await prisma.order.update({
    where: { id: slot.orderId },
    data: { workflow: 'WARTET_FEHLTEILE' }
  });
}
```

**Seite "Fehlteile-Management":**
- Zeigt alle Aufträge mit Status WARTET_FEHLTEILE
- Button "Freigeben" → Auftrag zurück zu FUER_PROD
- Ermöglicht Nachverfolgung blockierter Aufträge

---

### Phase 8: Produktion abgeschlossen

#### 8️⃣ Automatische Fertigstellung

**Trigger:** Letzter TimeSlot wird auf DONE gesetzt

**Bedingung:**
```
ALLE TimeSlots = DONE
UND
KEINE TimeSlots = BLOCKED
```

**Status-Wechsel:** `IN_PROD` → `FERTIG` (automatisch!)

**System-Logik:**
Diese Prüfung läuft automatisch nach jedem `stopTimeSlot()`:
```typescript
// Nach jedem TimeSlot-Stop
await this.stopTimeSlot(id);
await this.checkAndCompleteOrder(orderId); // ← Automatisch!
```

**Keine manuelle Aktion erforderlich!**

---

### Phase 9: Auslieferung

#### 9️⃣ Ware ausliefern

**Wer:** Lagermitarbeiter oder Verkauf (Rolle: LAGER, SALES_OPS oder ADMIN)

**Wo:** Auftrag-Detail → Button "Auslieferung erfassen"

**Status-Wechsel:** `FERTIG` → `ZUR_ABRECHNUNG`

**Was wird erfasst:**
```
POST /api/orders/:id/deliver
→ Lieferdatum
→ Gelieferte Menge
→ Notiz zur Lieferung
```

**System-Logik:**
```typescript
// Backend: server/storage.ts - deliverOrder()

await prisma.order.update({
  where: { id: orderId },
  data: {
    deliveredAt: data.deliveredAt,
    deliveredQty: data.deliveredQty,
    deliveredNote: data.deliveredNote,
    workflow: 'ZUR_ABRECHNUNG',
  }
});
```

**Nach der Auslieferung:**
- Auftrag erscheint in der Abrechnung (Tab "Offen")
- Buchhaltung kann abrechnen

---

### Phase 10: Abrechnung

#### 🔟 Auftrag abrechnen

**Wer:** Buchhaltung (Rolle: ACCOUNTING oder ADMIN)

**Wo:** Seite "Abrechnung" → Tab "Offen"

**Aktion:** Button "Abrechnen" klicken

**Status-Wechsel:** `ZUR_ABRECHNUNG` → `ABGERECHNET`

**Validierung:**
```typescript
// Backend: server/storage.ts - settleOrder()

if (order.workflow !== 'ZUR_ABRECHNUNG') {
  throw new Error('Order must be in ZUR_ABRECHNUNG status');
}
```

**Was wird gespeichert:**
```typescript
await prisma.order.update({
  where: { id: orderId },
  data: {
    settledAt: new Date(),
    settledBy: userId, // Wer hat abgerechnet?
    workflow: 'ABGERECHNET',
  }
});
```

**Nach der Abrechnung:**
- Auftrag erscheint im Tab "Abgerechnet"
- Workflow ist abgeschlossen ✅

---

## 📈 Status-Übersichts-Diagramm

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUFTRAGSERSTELLUNG                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   NEU (Entwurf)  │
                    └──────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │  Daten erfassen:  │
                    │  - Positionen     │
                    │  - Größentabelle  │
                    │  - Assets         │
                    └─────────┬─────────┘
                              │
                 ┌────────────┴────────────┐
                 │ "In Produktion geben"   │
                 │  (Submit + Validierung) │
                 └────────────┬────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PRODUKTIONSPLANUNG                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌──────────────────┐
                    │   FUER_PROD      │
                    │ (Für Produktion) │
                    └──────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │ TimeSlots planen  │
                    │ Status: PLANNED   │
                    └─────────┬─────────┘
                              │
                    ┌─────────┴─────────┐
                    │  TimeSlot starten │
                    │  (Play-Button)    │
                    └─────────┬─────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       PRODUKTION                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌──────────────────┐
                    │     IN_PROD      │
                    │ (In Produktion)  │
                    └──────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
         ┌──────────┐  ┌──────────┐  ┌──────────┐
         │  PAUSED  │  │ RUNNING  │  │  DONE    │
         │(Pausiert)│  │ (Läuft)  │  │(Fertig)  │
         └──────────┘  └──────────┘  └──────────┘
                │             │             │
                └─────────────┴─────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   Problem?        │
                    └─────────┬─────────┘
                              │
                    ┌─────────┴─────────┐
                    │  Ja: Fehlteile    │
                    │  TimeSlot:BLOCKED │
                    └─────────┬─────────┘
                              │
                              ▼
                  ┌────────────────────────┐
                  │  WARTET_FEHLTEILE      │
                  │ (Wartet auf Fehlteile) │
                  └────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │  Freigeben        │
                    │  (zurück zu       │
                    │   FUER_PROD)      │
                    └───────────────────┘

                  ┌────────────────────────┐
                  │ Alle TimeSlots DONE &  │
                  │ keine BLOCKED          │
                  │ → Automatisch!         │
                  └────────────┬───────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       ABSCHLUSS                                 │
└─────────────────────────────────────────────────────────────────┘
                               │
                    ┌──────────────────┐
                    │     FERTIG       │
                    │(Produktion fertig)│
                    └──────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │ Auslieferung erfassen│
                    └──────────┬──────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       ABRECHNUNG                                │
└─────────────────────────────────────────────────────────────────┘
                               │
                    ┌──────────────────┐
                    │  ZUR_ABRECHNUNG  │
                    │(Ausgabe erfolgt) │
                    └──────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │   Abrechnen         │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌──────────────────┐
                    │  ABGERECHNET     │
                    │  (Abgeschlossen) │
                    └──────────────────┘
                               │
                               ▼
                          ✅ FERTIG
```

---

## ⚙️ Technische Details

### TimeSlot-Status

| Status | Beschreibung | Mögliche Aktionen |
|--------|--------------|-------------------|
| `PLANNED` | Geplant, noch nicht gestartet | Start |
| `RUNNING` | Läuft aktuell | Pause, Stop |
| `PAUSED` | Pausiert | Start (fortsetzen), Stop |
| `DONE` | Abgeschlossen | QC setzen |
| `BLOCKED` | Blockiert wegen Fehlteilen | - |

### Status-Maschine (State Machine)

```typescript
// Erlaubte Übergänge für TimeSlots

PLANNED → RUNNING  // Start
RUNNING → PAUSED   // Pause
PAUSED → RUNNING   // Fortsetzen
RUNNING → DONE     // Stop
PAUSED → DONE      // Stop
* → BLOCKED        // Problem melden
```

**Ungültige Übergänge führen zu HTTP 422 Fehler!**

### Rollen-basierte Berechtigungen

| Rolle | Aufträge | Planung | Produktion | Abrechnung | Lager |
|-------|----------|---------|------------|------------|-------|
| `ADMIN` | ✅ Alle | ✅ Alle | ✅ Alle | ✅ Alle | ✅ Alle |
| `PROD_PLAN` | ❌ | ✅ Planen | ❌ | ❌ | ❌ |
| `PROD_RUN` | ❌ | ❌ | ✅ Ausführen | ❌ | ❌ |
| `SALES_OPS` | ✅ Verwalten | ❌ | ❌ | ❌ | ❌ |
| `ACCOUNTING` | ❌ | ❌ | ❌ | ✅ Abrechnen | ❌ |
| `LAGER` | ❌ | ❌ | ❌ | ❌ | ✅ Verwalten |

---

## 🎯 Häufige Fragen

### Warum kann ich meinen Auftrag nicht in Produktion geben?

**Checkliste:**
1. ✅ Mindestens 1 Position vorhanden?
2. ✅ (TEAMSPORT) Größentabelle erstellt?
3. ✅ (TEAMSPORT) Mindestens 1 PRINT-Asset hochgeladen?
4. ✅ (TEAMSPORT) Asset als "Erforderlich für Freigabe" markiert?

**Häufigster Fehler:**
Assets wurden hochgeladen, aber das Häkchen "Erforderlich für Freigabe" wurde NICHT gesetzt!

### Wann wechselt ein Auftrag automatisch auf FERTIG?

**Bedingung:**
- ALLE TimeSlots haben Status `DONE`
- UND keine TimeSlots haben Status `BLOCKED`

**Prüfung erfolgt automatisch nach jedem TimeSlot-Stop!**

### Kann ich einen TimeSlot löschen?

Aktuell nicht implementiert. TimeSlots können pausiert oder gestoppt werden.

### Was passiert mit JTL-Aufträgen?

JTL-Aufträge haben Quelle `JTL` statt `INTERNAL`:
- Sind schreibgeschützt für Stammdaten
- Können Größentabelle und Assets erhalten
- Workflow läuft identisch zu internen Aufträgen

---

## 📝 Zusammenfassung

### Der komplette Weg eines Auftrags:

1. **Erstellen** → Status: `NEU`
2. **Daten erfassen** → Positionen, Größentabelle, Assets
3. **Freigeben** → Status: `FUER_PROD` (mit Validierung!)
4. **Planen** → TimeSlots erstellen
5. **Starten** → Status: `IN_PROD`, TimeSlot: `RUNNING`
6. **Produzieren** → Pause/Stop möglich
7. **Bei Problemen** → Status: `WARTET_FEHLTEILE`
8. **Automatische Fertigstellung** → Status: `FERTIG`
9. **Ausliefern** → Status: `ZUR_ABRECHNUNG`
10. **Abrechnen** → Status: `ABGERECHNET` ✅

### Wichtigste automatische Logik:

- ✨ **Auto-Complete:** Auftrag wird automatisch FERTIG wenn alle TimeSlots DONE
- ✨ **Status-Wechsel:** IN_PROD wird automatisch gesetzt beim ersten TimeSlot-Start
- ✨ **Validierung:** Submit-Button prüft automatisch alle Voraussetzungen

---

**Stand:** Oktober 2025  
**Version:** 1.0
