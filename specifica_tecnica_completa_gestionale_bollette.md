# SPECIFICA TECNICA E FUNZIONALE COMPLETA: Gestionale Ripartizione Bollette Multi-Immobile (Web App Single-File)

> **Istruzione per l'Agente IA ricevente:**  
> Questo documento contiene le specifiche architetturali, matematiche, visive e di stato complete per replicare al 100% la Web App locale **`Gestionale Ripartizione Bollette — Greta Garbo & Marilyn Monroe`**.  
> L'applicazione **DEVE** essere generata in un **singolo file `.html` autoconsistente** (`index.html`) contenente HTML5, Tailwind CSS (via CDN), JavaScript Vanilla e le librerie esterne `PDF.js` e `SheetJS (xlsx)`.

---

## 1. CONTESTO DI DOMINIO E OBIETTIVO DEL SISTEMA

L'utente gestisce la ripartizione delle bollette domestiche (**Luce**, **Gas Metano**, **Acqua ACEA**) per **due immobili distinti a Roma (CAP 00128)**, ciascuno diviso tra un **Piano Inferiore** (proprietari/familiari) e un **Piano Superiore** (inquilini in affitto), ma serviti da contatori generali unici con sotto-contatori divisionali:

1. **Immobile 1 — `Via Greta Garbo 13` (`id: 'greta_garbo'`)**:
   * **Piano Inferiore (`US`)**: *Io & Rachele* (**2 persone**).
   * **Piano Superiore (`TENANT`)**: *Famiglia Channon* (**5 persone**, famiglia anglofona).
   * **Canone di affitto predefinito**: `€ 1.490,00`.
   * **Modalità di calcolo predefinita**: Formula ibrida basata per il **30% sul consumo effettivo dei sotto-contatori** e per il **70% sul numero di occupanti** (`2/7` vs `5/7`), con arrotondamento al decimo di euro sulla quota calcolata dalla formula e calcolo per differenza al centesimo sull'altra quota.

2. **Immobile 2 — `Via Marilyn Monroe 150` (`id: 'marilyn_monroe'`)**:
   * **Piano Inferiore (`US`)**: *Mamma (Piano Sotto)*.
   * **Piano Superiore (`TENANT`)**: *Inquilini (Piano Sopra)*.
   * **Canone di affitto predefinito**: `€ 1.100,00`.
   * **Modalità di calcolo predefinita (`noMetersMode: true`)**: Non utilizza letture di contatori (`weightMeter: 0`, `weightPeople: 100`). Di base divide tutte le bollette al **50% / 50%** (`peopleUs: 1`, `peopleTenant: 1`), nascondendo completamente dall'interfaccia e dal PDF tutte le caselle dei contatori e le opzioni relative ai contatori, ma lasciando la possibilità di variare mese per mese la proporzione (es. `40% / 60%`) o inserire rettifiche manuali in Euro.

---

## 2. STACK TECNOLOGICO E VINCOLI ARCHITETTURALI

* **Single-File Mandate**: Tutto il codice (HTML + CSS + JS) deve risiedere in un unico file `.html` apribile offline tramite doppio clic su Google Chrome o Microsoft Edge.
* **Librerie CDN obbligatorie nell'`<head>`**:
  * **Tailwind CSS**: `<script src="https://cdn.tailwindcss.com"></script>`
  * **Google Fonts (`Inter`)**: pesi `400, 500, 600, 700, 800`.
  * **PDF.js (`v3.11.174`)**:
    * `<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>`
    * Worker configurato a `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`.
  * **SheetJS (`v0.18.5`)**:
    * `<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>`
* **Persistenza Locale**: `localStorage` con chiave `STORAGE_KEY = 'villa_multi_utilities_v5'`.

---

## 3. MODELLO MATEMATICO E REGOLE DI RIPARTIZIONE

### 3.1 Differenze Consumi Contatori
Per ciascuna utenza $u \in \{\text{luce}, \text{gas}, \text{acqua}\}$:
$$\Delta_{\text{gen}, u} = \max(0, \text{genEnd}_u - \text{genStart}_u)$$
$$\Delta_{\text{sub}, u} = \max(0, \text{subEnd}_u - \text{subStart}_u)$$

### 3.2 Direzione dei Sotto-Contatori in `Via Greta Garbo 13`
Attenzione alla fondamentale asimmetria fisica dell'impianto idrico rispetto a luce e gas:
* **Luce (`luceSubOwner = 'US'`)**: Il sotto-contatore misura il consumo di **Io & Rachele (Piano Sotto)**.
* **Gas (`gasSubOwner = 'US'`)**: Il sotto-contatore misura il consumo di **Io & Rachele (Piano Sotto)**.
* **Acqua (`acquaSubOwner = 'TENANT'`)**: Il sotto-contatore utilizzato nella formula misura il consumo della **Famiglia Channon (Piano Sopra)**.

### 3.3 Algoritmo Esatto `computeSingleUtility`
Dati:
* $B$: Importo totale della bolletta in Euro (`billAmount`). Se $B = 0$, restituisce `{ shareUs: 0, shareTenant: 0, isManual: false }`.
* $w_M = \text{weightMeter} / 100$ (predefinito `0.30` su Greta Garbo, `0.00` su Marilyn Monroe).
* $w_P = 1 - w_M$ (predefinito `0.70` su Greta Garbo, `1.00` su Marilyn Monroe).
* $P_{\text{us}}, P_{\text{tenant}}$: Quote/Persone piano sotto e piano sopra (predefinito `2` e `5` su Greta Garbo; `1` e `1` su Marilyn Monroe), con $P_{\text{tot}} = \max(0.0001, P_{\text{us}} + P_{\text{tenant}})$.
* `manualTenantOverride`: valore numerico opzionale inserito dall'utente per forzare la quota inquilini su quella specifica utenza.

**Ordine di priorità del calcolo:**

1. **Caso 1 — Rettifica Manuale (`manualTenantOverride` valorizzato):**
   $$\text{shareTenant} = \text{round}_2(\min(B, \max(0, \text{manualTenantOverride})))$$
   $$\text{shareUs} = \text{round}_2(B - \text{shareTenant})$$
   Restituisce `isManual: true`.

2. **Caso 2 — Modalità Senza Contatori ($w_M \le 0.0001$, es. Via Marilyn Monroe 150):**
   $$\text{shareTenant} = \text{round}_2\left(B \cdot \frac{P_{\text{tenant}}}{P_{\text{tot}}}\right)$$
   $$\text{shareUs} = \text{round}_2(B - \text{shareTenant})$$
   Restituisce `isManual: false`.

3. **Caso 3 — Formula Mista Contatori + Persone (es. Via Greta Garbo 13 con arrotondamento a 1 decimale identico a `=ROUND(...; 1)` di Excel):**
   * Calcolo del rapporto contatori $R$:
     $$R = \begin{cases} \min\left(1, \max\left(0, \frac{\Delta_{\text{sub}}}{\Delta_{\text{gen}}}\right)\right) & \text{se } \Delta_{\text{gen}} > 0 \\ \frac{P_{\text{us}}}{P_{\text{tot}}} \text{ (se subOwner = US)} \text{ oppure } \frac{P_{\text{tenant}}}{P_{\text{tot}}} \text{ (se subOwner = TENANT)} & \text{se } \Delta_{\text{gen}} = 0 \end{cases}$$
   * **Se `subOwner === 'US'` (Luce e Gas):**
     $$\text{rawUs} = \left(B \cdot w_M \cdot R\right) + \left(B \cdot w_P \cdot \frac{P_{\text{us}}}{P_{\text{tot}}}\right)$$
     $$\text{shareUs} = \frac{\text{Math.round}(\text{rawUs} \times 10)}{10}$$
     $$\text{shareTenant} = \text{round}_2(B - \text{shareUs})$$
   * **Se `subOwner === 'TENANT'` (Acqua):**
     $$\text{rawTenant} = \left(B \cdot w_M \cdot R\right) + \left(B \cdot w_P \cdot \frac{P_{\text{tenant}}}{P_{\text{tot}}}\right)$$
     $$\text{shareTenant} = \frac{\text{Math.round}(\text{rawTenant} \times 10)}{10}$$
     $$\text{shareUs} = \text{round}_2(B - \text{shareTenant})$$

### 3.4 Tabella di Verifica Matematico-Contabile (Test Cases Obbligatori per Greta Garbo)
L'agente IA deve verificare che il motore di calcolo produca **esattamente al centesimo** questi valori sui 4 periodi storici precaricati:

| Periodo | Utenza | Bolletta (€) | Gen. Inizio $\rightarrow$ Fine ($\Delta$) | Sub. Inizio $\rightarrow$ Fine ($\Delta$) | Quota Io & Rachele (€) | Quota Channon (€) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Febbraio - Marzo 2026** | Luce | `273,27` | `25689` $\rightarrow$ `26474` (`785`) | `21692` $\rightarrow$ `22089` (`397`) | **96,10 €** | **177,17 €** |
| **Febbraio - Marzo 2026** | Gas | `495,81` | `14303` $\rightarrow$ `14541` (`238`) | `8734` $\rightarrow$ `8850` (`116`) | **171,70 €** | **324,11 €** |
| **Febbraio - Marzo 2026** | Acqua | `198,06` | `259` $\rightarrow$ `312` (`53`) | `1423` $\rightarrow$ `1454` (`31`) | **64,26 €** | **133,80 €** |
| *Totale Feb-Mar 2026* | *Tutte* | *`967,14`* | — | — | ***332,06 €*** | ***635,08 €*** |
| **Aprile 2026** | Luce | `100,03` | `26474` $\rightarrow$ `26900` (`426`) | `22089` $\rightarrow$ `22277` (`188`) | **33,20 €** | **66,83 €** |
| **Aprile 2026** | Gas | `19,78` | `14541` $\rightarrow$ `14810` (`269`) | `8850` $\rightarrow$ `8889` (`39`) | **4,80 €** | **14,98 €** |
| **Aprile 2026** | Acqua | `0,00` | `312` $\rightarrow$ `340` (`28`) | `1454` $\rightarrow$ `1469` (`15`) | **0,00 €** | **0,00 €** |
| *Totale Aprile 2026* | *Tutte* | *`119,81`* | — | — | ***38,00 €*** | ***81,81 €*** |
| **Maggio - Giugno 2026** | Luce | `283,29` | `26900` $\rightarrow$ `28176` (`1276`) | `22277` $\rightarrow$ `22656` (`379`) | **81,90 €** | **201,39 €** |
| **Maggio - Giugno 2026** | Gas | `162,49` | `14610` $\rightarrow$ `14689` (`79`) | `8889` $\rightarrow$ `8931` (`42`) | **58,40 €** | **104,09 €** |
| **Maggio - Giugno 2026** | Acqua | `277,33` | `340` $\rightarrow$ `397` (`57`) | `1469` $\rightarrow$ `1500` (`31`) | **93,43 €** | **183,90 €** |
| *Totale Mag-Giu 2026* | *Tutte* | *`723,11`* | — | — | ***233,73 €*** | ***489,38 €*** |
| **Luglio - Agosto 2026** | Luce | `412,52` | `28176` $\rightarrow$ `29179` (`1003`) | `22656` $\rightarrow$ `22916` (`260`) | **114,60 €** | **297,92 €** |
| **Luglio - Agosto 2026** | Gas | `92,90` | `14689` $\rightarrow$ `14714` (`25`) | `8931` $\rightarrow$ `8939` (`8`) | **27,50 €** | **65,40 €** |
| **Luglio - Agosto 2026** | Acqua | `254,79` | `397` $\rightarrow$ `425` (`28`) | `1500` $\rightarrow$ `1514` (`14`) | **89,19 €** | **165,60 €** |
| *Totale Lug-Ago 2026* | *Tutte* | *`760,21`* | — | — | ***231,29 €*** | ***528,92 €*** |

---

## 4. STRUTTURA DATI INIZIALE (`DEFAULT_STATE`)

Il gestionale deve inizializzare `DEFAULT_STATE` esattamente con la seguente struttura JSON:

```javascript
const STORAGE_KEY = 'villa_multi_utilities_v5';

const DEFAULT_STATE = {
  activePropertyId: 'greta_garbo',
  properties: {
    greta_garbo: {
      id: 'greta_garbo',
      name: 'Via Greta Garbo 13',
      address: 'Via Greta Garbo 13, 00128 Roma (RM)',
      labelUs: 'Io & Rachele',
      labelTenant: 'Famiglia Channon',
      defaultRent: 1490.00,
      noMetersMode: false,
      defaultCriteria: {
        weightMeter: 30,
        weightPeople: 70,
        peopleUs: 2,
        peopleTenant: 5,
        luceSubOwner: 'US',
        gasSubOwner: 'US',
        acquaSubOwner: 'TENANT'
      },
      activePeriodId: 'mag_giu_2026',
      bankTransfers: [
        {
          id: 'tr_gg_1',
          date: '03/07/2026',
          refMonth: 'Aprile',
          rentAmount: 1490.00,
          billsAmount: 82.00,
          notes: 'Saldato affitto + bollette Aprile (66,83€ Luce + 14,98€ Gas)'
        },
        {
          id: 'tr_gg_2',
          date: '31/07/2026',
          refMonth: 'Maggio - Giugno',
          rentAmount: 1490.00,
          billsAmount: 490.00,
          notes: 'Saldato affitto + bollette Maggio-Giugno (489,38€ arrotondato a 490€)'
        }
      ],
      periods: [
        {
          id: 'feb_mar_2026',
          name: 'Febbraio - Marzo 2026',
          dateStart: '20/02/2026',
          dateEnd: '20/04/2026',
          status: 'PAGATO',
          transferDate: '25/04/2026',
          notes: 'Pagato tutti e due.',
          criteria: { weightMeter: 30, weightPeople: 70, peopleUs: 2, peopleTenant: 5, luceSubOwner: 'US', gasSubOwner: 'US', acquaSubOwner: 'TENANT' },
          luce: { bill: 273.27, genStart: 25689, genEnd: 26474, subStart: 21692, subEnd: 22089, manualTenant: null },
          gas:  { bill: 495.81, genStart: 14303, genEnd: 14541, subStart: 8734,  subEnd: 8850,  manualTenant: null },
          acqua:{ bill: 198.06, genStart: 259,   genEnd: 312,   subStart: 1423,  subEnd: 1454,  manualTenant: null }
        },
        {
          id: 'aprile_2026',
          name: 'Aprile 2026',
          dateStart: '20/04/2026',
          dateEnd: '20/05/2026',
          status: 'PAGATO',
          transferDate: '03/07/2026',
          notes: 'Acqua pagata con precedente bolletta che arrivava fino ad aprile.',
          criteria: { weightMeter: 30, weightPeople: 70, peopleUs: 2, peopleTenant: 5, luceSubOwner: 'US', gasSubOwner: 'US', acquaSubOwner: 'TENANT' },
          luce: { bill: 100.03, genStart: 26474, genEnd: 26900, subStart: 22089, subEnd: 22277, manualTenant: null },
          gas:  { bill: 19.78,  genStart: 14541, genEnd: 14810, subStart: 8850,  subEnd: 8889,  manualTenant: null },
          acqua:{ bill: 0.00,   genStart: 312,   genEnd: 340,   subStart: 1454,  subEnd: 1469,  manualTenant: null }
        },
        {
          id: 'mag_giu_2026',
          name: 'Maggio - Giugno 2026',
          dateStart: '20/05/2026',
          dateEnd: '28/07/2026',
          status: 'PAGATO',
          transferDate: '31/07/2026',
          notes: 'Utilizzate come letture di fine mese quelle di luglio.',
          criteria: { weightMeter: 30, weightPeople: 70, peopleUs: 2, peopleTenant: 5, luceSubOwner: 'US', gasSubOwner: 'US', acquaSubOwner: 'TENANT' },
          luce: { bill: 283.29, genStart: 26900, genEnd: 28176, subStart: 22277, subEnd: 22656, manualTenant: null },
          gas:  { bill: 162.49, genStart: 14610, genEnd: 14689, subStart: 8889,  subEnd: 8931,  manualTenant: null },
          acqua:{ bill: 277.33, genStart: 340,   genEnd: 397,   subStart: 1469,  subEnd: 1500,  manualTenant: null }
        },
        {
          id: 'lug_ago_2026',
          name: 'Luglio - Agosto 2026',
          dateStart: '28/07/2026',
          dateEnd: '13/09/2026',
          status: 'DA_SALDARE',
          transferDate: '',
          notes: 'Utilizzate come letture di fine mese quelle del 13 settembre.',
          criteria: { weightMeter: 30, weightPeople: 70, peopleUs: 2, peopleTenant: 5, luceSubOwner: 'US', gasSubOwner: 'US', acquaSubOwner: 'TENANT' },
          luce: { bill: 412.52, genStart: 28176, genEnd: 29179, subStart: 22656, subEnd: 22916, manualTenant: null },
          gas:  { bill: 92.90,  genStart: 14689, genEnd: 14714, subStart: 8931,  subEnd: 8939,  manualTenant: null },
          acqua:{ bill: 254.79, genStart: 397,   genEnd: 425,   subStart: 1500,  subEnd: 1514,  manualTenant: null }
        }
      ]
    },
    marilyn_monroe: {
      id: 'marilyn_monroe',
      name: 'Via Marilyn Monroe 150',
      address: 'Via Marilyn Monroe 150, 00128 Roma (RM)',
      labelUs: 'Mamma (Piano Sotto)',
      labelTenant: 'Inquilini (Piano Sopra)',
      defaultRent: 1100.00,
      noMetersMode: true,
      defaultCriteria: {
        weightMeter: 0,
        weightPeople: 100,
        peopleUs: 1,
        peopleTenant: 1,
        luceSubOwner: 'US',
        gasSubOwner: 'US',
        acquaSubOwner: 'TENANT'
      },
      activePeriodId: 'mm_mag_giu_2026',
      bankTransfers: [],
      periods: [
        {
          id: 'mm_feb_mar_2026',
          name: 'Febbraio - Marzo 2026',
          dateStart: '01/02/2026',
          dateEnd: '31/03/2026',
          status: 'PAGATO',
          transferDate: '05/05/2026',
          notes: 'Divisione al 50% (Metà ciascuno).',
          criteria: { weightMeter: 0, weightPeople: 100, peopleUs: 1, peopleTenant: 1, luceSubOwner: 'US', gasSubOwner: 'US', acquaSubOwner: 'TENANT' },
          luce: { bill: 218.40, genStart: 0, genEnd: 0, subStart: 0, subEnd: 0, manualTenant: null },
          gas:  { bill: 342.60, genStart: 0, genEnd: 0, subStart: 0, subEnd: 0, manualTenant: null },
          acqua:{ bill: 145.20, genStart: 0, genEnd: 0, subStart: 0, subEnd: 0, manualTenant: null }
        },
        {
          id: 'mm_apr_2026',
          name: 'Aprile 2026',
          dateStart: '01/04/2026',
          dateEnd: '30/04/2026',
          status: 'PAGATO',
          transferDate: '04/07/2026',
          notes: 'Divisione al 50% (Metà ciascuno).',
          criteria: { weightMeter: 0, weightPeople: 100, peopleUs: 1, peopleTenant: 1, luceSubOwner: 'US', gasSubOwner: 'US', acquaSubOwner: 'TENANT' },
          luce: { bill: 94.50,  genStart: 0, genEnd: 0, subStart: 0, subEnd: 0, manualTenant: null },
          gas:  { bill: 48.20,  genStart: 0, genEnd: 0, subStart: 0, subEnd: 0, manualTenant: null },
          acqua:{ bill: 0.00,   genStart: 0, genEnd: 0, subStart: 0, subEnd: 0, manualTenant: null }
        },
        {
          id: 'mm_mag_giu_2026',
          name: 'Maggio - Giugno 2026',
          dateStart: '01/05/2026',
          dateEnd: '30/06/2026',
          status: 'DA_SALDARE',
          transferDate: '',
          notes: 'Carica solo le foto o i PDF delle bollette: di base divide a metà (50%/50%), ma puoi modificare i criteri sopra.',
          criteria: { weightMeter: 0, weightPeople: 100, peopleUs: 1, peopleTenant: 1, luceSubOwner: 'US', gasSubOwner: 'US', acquaSubOwner: 'TENANT' },
          luce: { bill: 196.80, genStart: 0, genEnd: 0, subStart: 0, subEnd: 0, manualTenant: null },
          gas:  { bill: 86.40,  genStart: 0, genEnd: 0, subStart: 0, subEnd: 0, manualTenant: null },
          acqua:{ bill: 168.90, genStart: 0, genEnd: 0, subStart: 0, subEnd: 0, manualTenant: null }
        },
        {
          id: 'mm_lug_ago_2026',
          name: 'Luglio - Agosto 2026',
          dateStart: '01/07/2026',
          dateEnd: '31/08/2026',
          status: 'DA_SALDARE',
          transferDate: '',
          notes: 'Divisione al 50% (Metà ciascuno).',
          criteria: { weightMeter: 0, weightPeople: 100, peopleUs: 1, peopleTenant: 1, luceSubOwner: 'US', gasSubOwner: 'US', acquaSubOwner: 'TENANT' },
          luce: { bill: 245.10, genStart: 0, genEnd: 0, subStart: 0, subEnd: 0, manualTenant: null },
          gas:  { bill: 54.30,  genStart: 0, genEnd: 0, subStart: 0, subEnd: 0, manualTenant: null },
          acqua:{ bill: 152.40, genStart: 0, genEnd: 0, subStart: 0, subEnd: 0, manualTenant: null }
        }
      ]
    }
  }
};
```

---

## 5. LOGICA DI SALVATAGGIO MANUALE, RILEVAMENTO MODIFICHE E RESET

L'utente richiede un controllo esplicito sulle modifiche tramite i pulsanti **`💾 Salva Modifiche`** e **`↩️ Reset`**:

1. **Fotografia Baseline (`savedBaselineString`)**:
   * All'avvio dell'applicazione (e ad ogni salvataggio manuale), viene salvata una stringa di confronto:
     ```javascript
     function getComparableStateString(stateObj) {
       if (!stateObj || !stateObj.properties) return '';
       return JSON.stringify(stateObj.properties);
     }
     ```
   * Nota: confronta esclusivamente `stateObj.properties` (quindi letture, bollette, criteri, stati, date bonifici e note), ignorando il semplice cambio di scheda o di immobile attivo.

2. **Rilevamento Differenze Reattivo (`saveState()`)**:
   * Ad ogni input dell'utente (`oninput` / `onchange`), la funzione `saveState()` **NON** sovrascrive immediatamente il `localStorage`, ma confronta lo stato corrente con `savedBaselineString`:
     ```javascript
     function saveState() {
       const currentComparable = getComparableStateString(appState);
       hasUnsavedChanges = (currentComparable !== savedBaselineString);
       updateSaveStatusUI();
     }
     ```
   * **Requisito fondamentale**: Se l'utente modifica un valore (il bottone `Salva Modifiche` diventa **giallo ambra** `bg-amber-500 text-slate-950` con pallino lampeggiante `unsaved-dot`) e poi **cancella la modifica o rimette il valore originale**, `currentComparable === savedBaselineString` torna `true`, `hasUnsavedChanges` torna `false` e il pulsante **torna immediatamente blu (`bg-indigo-600 text-white`)**.

3. **Salvataggio Esplicito (`manualSaveChanges()`)**:
   * Scrive `appState` dentro `localStorage.setItem(STORAGE_KEY, JSON.stringify(appState))`.
   * Aggiorna `savedBaselineString = getComparableStateString(appState)` e riporta `hasUnsavedChanges = false`.

4. **Ripristino Ultimo Salvataggio (`revertToLastSavedState()`)**:
   * Ricarica i dati da `localStorage`, annullando tutte le modifiche non salvate e riportando l'interfaccia esattamente al momento dell'ultimo clic su `Salva Modifiche`.

---

## 6. CODA DI CARICAMENTO FILE (STAGING QUEUE) E AUTO-RICONOSCIMENTO IA

### 6.1 Comportamento della Barra di Caricamento Unico (`#unified-dropzone`)
L'utente carica in un'unica area (tramite Drag & Drop o selezione multipla) tutte le foto dei contatori e i PDF/foto delle bollette, ma **il calcolo NON deve partire in automatico appena selezionati i file**:

1. **Inserimento in coda (`stagedFilesQueue`)**:
   * Quando l'utente seleziona o trascina $N$ file, vengono aggiunti all'array `stagedFilesQueue` e visualizzati in una griglia (`#staged-files-list`).
   * Ogni card di file mostra: icona (`🖼️` immagine, `📄` PDF, `📊` Excel), nome del file, dimensione in KB e stato *"In attesa di lettura"*.
   * **Pulsante `✕` in alto a destra su ogni file**: permette di eliminare singolarmente un file inserito per errore (`removeStagedFile(stageId)`). È presente anche un pulsante *"Svuota tutti"* (`clearAllStagedFiles()`).
2. **Pulsante di avvio esplicito (`🚀 Avvia Lettura e Calcolo`)**:
   * Compare solo quando `stagedFilesQueue.length > 0`, mostrando il badge con il numero di file in coda.
   * Solo quando l'utente clicca su **`🚀 Avvia Lettura e Calcolo`** (`startStagedFilesProcessing()`), parte la barra di avanzamento e i file vengono analizzati uno ad uno.
3. **Svuotamento e Consolidamento Finale**:
   * Terminata la lettura di tutti i file in coda, la barra dei file caricati **si svuota automaticamente** (`clearAllStagedFiles()`), i valori estratti vengono caricati nelle caselle del mese corrente e viene eseguito automaticamente `manualSaveChanges()` per consolidare il mese.

### 6.2 Specifiche di Riconoscimento Automatico dei File
La funzione `processSingleUploadedFile(file)` distingue 3 tipologie di file:

1. **File PDF (`.pdf`) tramite `PDF.js`**:
   * Estrae il testo delle prime 6 pagine.
   * Identifica l'utenza cercando parole chiave:
     * `acea`, `idric`, `acquedotto`, `acqua` $\rightarrow$ **`acqua`**
     * `gas`, `smc`, `metano` $\rightarrow$ **`gas`**
     * `luce`, `kwh`, `energia`, `elettric` $\rightarrow$ **`luce`**
   * Estrae l'importo totale in Euro tramite regex:
     `/(?:totale\s+fattura|totale\s+da\s+pagare|importo\s+da\s+pagare|quanto\s+devo\s+pagare)[^\d]{0,40}(\d{1,4}[.,]\d{2})/i`
     (es. sulla bolletta ACEA Aprile-Giugno 2026 estrae `277,33 €`).

2. **Immagini Contatori e Bollette (`.jpg`, `.jpeg`, `.png`) tramite Gemini Vision API**:
   * Chiama `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}` con `responseMimeType: "application/json"`.
   * Il prompt istruisce il modello a riconoscere visivamente i 6 contatori specifici della villa:
     * **`LUCE_GEN`**: Contatore elettronico **Areti / e-distribuzione** con display LCD verde e scritta `Tot. A+ = 028176 kWh` $\rightarrow$ legge l'intero in kWh (es. `28176`) e lo assegna a `p.luce.genEnd`.
     * **`LUCE_SUB`**: Contatore modulare da quadro elettrico **ORBIS CONTAX 3221 SO** $\rightarrow$ legge le prime 5 cifre intere in kWh (es. `22656`) e lo assegna a `p.luce.subEnd`.
     * **`GAS_GEN`**: Contatore gas digitale **Themis** con codice a barre `ELS...` e display LCD `014689.654 m3` $\rightarrow$ legge solo la parte intera prima del punto (es. `14689`) e lo assegna a `p.gas.genEnd`.
     * **`GAS_SUB`**: Contatore gas meccanico **Meter Italia MG4 AL** $\rightarrow$ legge solo le cifre nelle caselle nere ignorando i 3 decimali rossi (es. `08931` $\rightarrow$ `8931`) e lo assegna a `p.gas.subEnd`.
     * **`ACQUA_GEN`**: Contatore acqua generale **ACEA** con ghiera bianca $\rightarrow$ legge solo le cifre nere ignorando i decimali rossi (es. `00397` $\rightarrow$ `397`) e lo assegna a `p.acqua.genEnd`.
     * **`ACQUA_SUB`**: Contatore acqua divisionale con coperchio rosso e scritta a pennarello **`12-370035`** $\rightarrow$ legge l'intero (es. `01500` $\rightarrow$ `1500`) e lo assegna a `p.acqua.subEnd`.
     * **`ALTRO`**: Ignora automaticamente il contatore acqua `12-370024` e i contaore elettrici `HMD` (Piano Terra / Piano Interrato) non utilizzati nella formula.
     * **`BOLLETTA_LUCE` / `BOLLETTA_GAS` / `BOLLETTA_ACQUA`**: Se la foto ritrae una bolletta cartacea, estrae il totale da pagare e lo assegna a `p[utenza].bill`.

3. **File Excel (`.xlsx`, `.xls`) tramite `SheetJS`**:
   * Legge i fogli mensili (ignorando `Riepilogo pagamenti` e `Data bonifici Channon`) mappando le celle standard dell'utente:
     * Luce: Bolletta `J5`, Gen Inizio `C6`, Gen Fine `C7`, Sub Inizio `G6`, Sub Fine `G7`.
     * Gas: Bolletta `J14`, Gen Inizio `C15`, Gen Fine `C16`, Sub Inizio `G15`, Sub Fine `G16`.
     * Acqua: Bolletta `J23`, Gen Inizio `C24`, Gen Fine `C25`, Sub Inizio `G24`, Sub Fine `G25`.

---

## 7. ARCHITETTURA DELLE 3 VISTE DELL'INTERFACCIA (UI/UX)

### 7.1 Header Superiore (`sticky top-0`)
* **Sinistra**: Selettore immobile a 2 pulsanti (`🏠 Via Greta Garbo 13` e `🏡 Via Marilyn Monroe 150`).
* **Destra**:
  * Navigazione a 3 schede: `🧮 Calcolo & Criteri`, `📊 Storico & Bonifici` (con badge numerico dei periodi), `📄 Foglio PDF Inquilini`.
  * Pulsanti azione: `💾 Salva Modifiche` (con indicatore modifiche non salvate), `↩️ Reset`, `🖨️ Stampa PDF`.

### 7.2 Vista 1 — `🧮 Calcolo & Criteri` (`#tab-calcolo`)
1. **Barra Periodo + 3 Card KPI in Tempo Reale**:
   * Selettore a tendina del periodo attivo + pulsante `➕ Nuovo` (apre modale che **copia automaticamente le Letture Finali del periodo precedente nelle Letture Iniziali del nuovo periodo**) + pulsante `🗑️` + campi data `Dal` / `Al`.
   * 3 Card KPI: **Totale Bollette**, **Quota Piano Sotto** (indaco), **Da Pagare Inquilini** (verde smeraldo con pill cliccabile `⏳ DA SALDARE` / `✅ PAGATO`).
2. **Box Unico di Caricamento (`#unified-dropzone`)**:
   * Con coda di revisione file, `✕` su ogni file e pulsante `🚀 Avvia Lettura e Calcolo`.
3. **Pannello Criteri di Distribuzione Economica del Singolo Periodo (`#criteria-drawer`)**:
   * Collassabile cliccando su `⚙️ Modifica Criteri Mese ▼`.
   * **Su Via Greta Garbo 13**: Mostra 3 card (1. *Peso Contatori vs Quota Fissa* con slider, 2. *Quote / Persone per Piano*, 3. *Chi misura il Sotto-Contatore?*) e tutti i preset rapidi (`Standard Greta Garbo 30%/70%`, `50%/50%`, `40%/60%`, `60%/40%`, `100% Solo Contatori`).
   * **Su Via Marilyn Monroe 150**: Nasconde automaticamente la card 1 (*Peso Contatori*), la card 3 (*Chi misura il Sotto-Contatore?*) e i preset legati ai contatori, mostrando unicamente la card per ripartire le quote tra *Mamma (Piano Sotto)* e *Inquilini (Piano Sopra)*.
4. **Griglia delle 3 Utenze (Luce, Gas, Acqua)**:
   * Ogni riga mostra: Importo Bolletta (€), Contatore Generale (Inizio/Fine e $\Delta$), Sotto-Contatore (Inizio/Fine e $\Delta$), Quote calcolate in Euro e il mini-campo **`Rettifica quota Sopra (€)`** con tastino `↺` per tornare al calcolo automatico.
   * **Su Via Marilyn Monroe 150**: I box dei contatori (`meter-box-col`) vengono nascosti automaticamente, lasciando solo l'importo della bolletta e le quote divise.

### 7.3 Vista 2 — `📊 Storico & Bonifici` (`#tab-storico`)
Deve essere essenziale e non dispersiva, composta da:
1. **3 KPI Compatti in alto**:
   * *Totale Bollette Periodi*, *Totale Quota Sotto*, *Totale Quota Sopra* (con sottovoce *Saldati con Bonifico*).
2. **Tabella 1 — `📋 Riepilogo Periodi e Quote`**:
   * Elenca tutti i periodi dell'immobile attivo con colonne: *Periodo*, *💡 Luce*, *🔥 Gas*, *💧 Acqua*, *Quota Sotto*, *Quota Sopra*, *Stato* (bottone cliccabile `✅ Pagato` / `⏳ Da saldare`), *Azioni* (`✏️ Apri` e `📄 PDF`).
3. **Tabella 2 — `🏦 Date Bonifici Bollette (Sincronizzato con i Periodi)`**:
   * **Sincronizzazione automatica**: Non richiede l'inserimento manuale di nuove righe o importi. Ogni periodo presente nella Tabella 1 genera automaticamente la propria riga nella tabella bonifici con l'importo dovuto già calcolato.
   * **Comportamento reattivo della barra data bonifico (`updatePeriodTransferDate`)**:
     * Scrivendo una data nel campo `Data Bonifico Effettuato` (o premendo il pulsante rapido `Oggi`), lo stato del periodo diventa immediatamente `PAGATO` (`✅ Bonifico Ricevuto` nella tabella bonifici e `✅ Pagato` nella tabella sopra) senza far perdere il focus al cursore mentre l'utente digita.
     * **Cancellazione della data**: Se l'utente cancella il testo della data (svuotando l'input) o preme il pulsantino rosso `✕` accanto a `Oggi`, lo stato **DEVE tornare immediatamente a `DA_SALDARE` (`⏳ In attesa` / `⏳ Da saldare`)** e aggiornare il KPI dei bonifici incassati.

### 7.4 Vista 3 — `📄 Foglio PDF Inquilini` (`#tab-pdf` e `#printable-sheet`)
Progettato per essere stampato o salvato in PDF in formato A4 verticale (`@media print`) e inviato agli inquilini:
1. **Regola di riservatezza ("Blindatura della formula")**:
   * Il foglio PDF **NON DEVE MAI** mostrare né menzionare le percentuali `30%`, `70%`, `2/7`, `5/7` o la logica ibrida di ripartizione, per evitare contestazioni o lamentele.
   * Deve presentare i dati come un prospetto contabile ufficiale con: *Utenza*, *Lettura Contatore Generale (Inizio $\rightarrow$ Fine e consumo)*, *Lettura Contatore Divisionale (Inizio $\rightarrow$ Fine e consumo)*, *Totale Fattura*, *Quota Piano Sotto* (opzionale, disattivabile con checkbox) e *Importo Dovuto Inquilini*.
   * **Su Via Marilyn Monroe 150** (dove `weightMeter === 0`), le colonne dei contatori vengono automaticamente omesse anche dal PDF.
2. **Opzioni PDF (barra `.no-print`)**:
   * Selettore lingua: **Bilingue Italiano + Inglese** (`BILINGUAL`), **Solo Italiano** (`IT`), **Solo Inglese** (`EN`).
   * Checkbox per includere nel totale da bonificare anche la riga del **Canone di Locazione** (`€ 1.490,00` per Greta Garbo, `€ 1.100,00` per Marilyn Monroe, modificabile).
   * Checkbox per mostrare o nascondere la colonna della quota del Piano Sotto.