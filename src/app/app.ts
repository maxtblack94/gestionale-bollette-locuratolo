import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ActiveTab,
  BillingPeriod,
  PdfLanguage,
  PeriodCalculationSummary,
  PropertyId,
  SubOwnerType,
  UtilityKey,
} from './models/billing.models';
import { BillingCalculatorService } from './services/billing-calculator.service';
import { FileProcessorService } from './services/file-processor.service';
import { StateService } from './services/state.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly stateService = inject(StateService);
  readonly calcService = inject(BillingCalculatorService);
  readonly fileProcessor = inject(FileProcessorService);

  // Navigazione e UI State
  readonly activeTab = signal<ActiveTab>('calcolo');
  readonly isCriteriaDrawerOpen = signal<boolean>(false);
  readonly isDraggingOver = signal<boolean>(false);

  // Modale Nuovo Periodo
  readonly isNewPeriodModalOpen = signal<boolean>(false);
  readonly newPeriodName = signal<string>('');
  readonly newPeriodDateStart = signal<string>('');
  readonly newPeriodDateEnd = signal<string>('');
  readonly newPeriodCopyReadings = signal<boolean>(true);

  // Modale Backup Dati
  readonly isSettingsModalOpen = signal<boolean>(false);

  // Opzioni Vista 3 — Foglio PDF Inquilini
  readonly pdfLanguage = signal<PdfLanguage>('BILINGUAL');
  readonly pdfIncludeRent = signal<boolean>(false);
  readonly pdfCustomRent = signal<number | null>(null);
  readonly pdfShowUsColumn = signal<boolean>(true);

  // Computed su immobile e periodo attivo
  readonly activeProperty = this.stateService.activeProperty;
  readonly activePeriod = this.stateService.activePeriod;
  readonly previousPeriod = this.stateService.previousPeriod;

  readonly isNoMetersProperty = computed<boolean>(() => {
    const prop = this.activeProperty();
    return Boolean(prop.noMetersMode);
  });

  readonly activePeriodSummary = computed<PeriodCalculationSummary>(() => {
    return this.calcService.computePeriodSummary(
      this.activePeriod(),
      this.activeProperty(),
      this.previousPeriod()
    );
  });

  // KPI Storico & Bonifici (con integrazione bankTransfers e calcolo conguaglio arrotondamenti)
  readonly historicalRows = computed(
    () => {
      const prop = this.activeProperty();
      return prop.periods.map((period, idx) => {
        const prev = idx > 0 ? prop.periods[idx - 1] : undefined;
        const summary = this.calcService.computePeriodSummary(period, prop, prev);

        // Cerca eventuale bonifico registrato in bankTransfers per questo periodo
        const matchedTransfer = prop.bankTransfers.find(
          (bt) =>
            period.name.toLowerCase().includes(bt.refMonth.toLowerCase()) ||
            (period.transferDate && bt.date === period.transferDate)
        );

        const actualPaidBills =
          period.status === 'PAGATO'
            ? matchedTransfer
              ? matchedTransfer.billsAmount
              : summary.totalTenant
            : 0;

        const roundingDiff =
          period.status === 'PAGATO'
            ? this.calcService.round2(actualPaidBills - summary.totalTenant)
            : 0;

        return {
          period,
          summary,
          matchedTransfer,
          actualPaidBills,
          roundingDiff,
        };
      });
    },
    { equal: () => false }
  );

  readonly historicalTotals = computed(() => {
    const rows = this.historicalRows();
    let totalBills = 0;
    let totalUs = 0;
    let totalTenant = 0;
    let totalPaidByTransfer = 0;
    let totalActualReceived = 0;
    let totalRoundingBalance = 0;
    let totalPending = 0;

    for (const r of rows) {
      totalBills += r.summary.totalBill;
      totalUs += r.summary.totalUs;
      totalTenant += r.summary.totalTenant;
      if (r.period.status === 'PAGATO') {
        totalPaidByTransfer += r.summary.totalTenant;
        totalActualReceived += r.actualPaidBills;
        totalRoundingBalance += r.roundingDiff;
      } else {
        totalPending += r.summary.totalTenant;
      }
    }

    return {
      totalBills: this.calcService.round2(totalBills),
      totalUs: this.calcService.round2(totalUs),
      totalTenant: this.calcService.round2(totalTenant),
      totalPaidByTransfer: this.calcService.round2(totalPaidByTransfer),
      totalActualReceived: this.calcService.round2(totalActualReceived),
      totalRoundingBalance: this.calcService.round2(totalRoundingBalance),
      totalPending: this.calcService.round2(totalPending),
    };
  });

  // Importo Canone per il PDF
  readonly effectiveRentAmount = computed<number>(() => {
    const custom = this.pdfCustomRent();
    if (custom !== null && !Number.isNaN(Number(custom))) {
      return Number(custom);
    }
    return this.activeProperty().defaultRent;
  });

  readonly pdfGrandTotalTenant = computed<number>(() => {
    const billsTenant = this.activePeriodSummary().totalTenant;
    if (this.pdfIncludeRent()) {
      return this.calcService.round2(billsTenant + this.effectiveRentAmount());
    }
    return billsTenant;
  });

  readonly pdfShowMeterColumns = computed<boolean>(() => {
    const prop = this.activeProperty();
    const period = this.activePeriod();
    return !prop.noMetersMode && period.criteria.weightMeter > 0.0001;
  });

  // Cambio Immobile
  selectProperty(propId: PropertyId): void {
    this.stateService.setActiveProperty(propId);
    this.pdfCustomRent.set(null);
  }

  // Cambio Scheda
  selectTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
  }

  // Cambio Periodo Attivo
  onSelectPeriod(periodId: string): void {
    this.stateService.setActivePeriod(periodId);
  }

  // Apertura Periodo da Tabella Storico
  openPeriodInCalcolo(periodId: string): void {
    this.stateService.setActivePeriod(periodId);
    this.activeTab.set('calcolo');
  }

  openPeriodInPdf(periodId: string): void {
    this.stateService.setActivePeriod(periodId);
    this.activeTab.set('pdf');
  }

  // Salvataggio e Reset
  manualSaveChanges(): void {
    this.stateService.manualSaveChanges();
  }

  revertToLastSavedState(): void {
    this.stateService.revertToLastSavedState();
  }

  printPdfSheet(): void {
    if (this.activeTab() !== 'pdf') {
      this.activeTab.set('pdf');
      setTimeout(() => window.print(), 150);
    } else {
      window.print();
    }
  }

  // Toggle Stato Pagato / Da Saldare (sincronizzato bidirezionalmente con transferDate)
  togglePeriodStatus(period: BillingPeriod): void {
    if (period.status === 'PAGATO') {
      period.status = 'DA_SALDARE';
      period.transferDate = '';
    } else {
      period.status = 'PAGATO';
      if (!period.transferDate) {
        period.transferDate = this.getTodayFormatted();
      }
    }
    this.stateService.saveState();
  }

  // Risoluzione con 1-Click delle discontinuità storiche tra periodi consecutivi
  alignCurrentStartWithPreviousEnd(utility: UtilityKey): void {
    const prev = this.previousPeriod();
    if (!prev) return;
    const curr = this.activePeriod();
    curr[utility].genStart = prev[utility].genEnd;
    curr[utility].subStart = prev[utility].subEnd;
    this.stateService.saveState();
    this.stateService.showToast(
      `Letture iniziali ${utility.toUpperCase()} allineate con le letture finali di "${prev.name}".`,
      'info'
    );
  }

  alignPreviousEndWithCurrentStart(utility: UtilityKey): void {
    const prev = this.previousPeriod();
    if (!prev) return;
    const curr = this.activePeriod();
    prev[utility].genEnd = curr[utility].genStart;
    prev[utility].subEnd = curr[utility].subStart;
    this.stateService.saveState();
    this.stateService.showToast(
      `Letture finali ${utility.toUpperCase()} di "${prev.name}" corrette con l'inizio del periodo corrente.`,
      'info'
    );
  }

  // Gestione Reattiva Data Bonifico (Sezione 7.3.3)
  updatePeriodTransferDate(period: BillingPeriod, newValue: string): void {
    period.transferDate = newValue;
    if (newValue && newValue.trim().length > 0) {
      period.status = 'PAGATO';
    } else {
      period.status = 'DA_SALDARE';
    }
    this.stateService.saveState();
  }

  setTransferDateToday(period: BillingPeriod): void {
    const today = this.getTodayFormatted();
    this.updatePeriodTransferDate(period, today);
  }

  clearTransferDate(period: BillingPeriod): void {
    this.updatePeriodTransferDate(period, '');
  }

  getTodayFormatted(): string {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  // Gestione Criteri del Periodo
  toggleCriteriaDrawer(): void {
    this.isCriteriaDrawerOpen.update((v) => !v);
  }

  onWeightMeterChange(val: number): void {
    const p = this.activePeriod();
    const clamped = Math.min(100, Math.max(0, Number(val) || 0));
    p.criteria.weightMeter = clamped;
    p.criteria.weightPeople = 100 - clamped;
    this.stateService.saveState();
  }

  onCriteriaChange(): void {
    this.stateService.saveState();
  }

  setSubOwner(utility: UtilityKey, owner: SubOwnerType): void {
    const p = this.activePeriod();
    if (utility === 'luce') p.criteria.luceSubOwner = owner;
    if (utility === 'gas') p.criteria.gasSubOwner = owner;
    if (utility === 'acqua') p.criteria.acquaSubOwner = owner;
    this.stateService.saveState();
  }

  applyCriteriaPreset(preset: 'GRETA_STD' | '50_50' | '40_60' | '60_40' | '100_METERS'): void {
    const p = this.activePeriod();
    const noMeters = this.isNoMetersProperty();

    switch (preset) {
      case 'GRETA_STD':
        p.criteria.weightMeter = 30;
        p.criteria.weightPeople = 70;
        p.criteria.peopleUs = 2;
        p.criteria.peopleTenant = 5;
        p.criteria.luceSubOwner = 'US';
        p.criteria.gasSubOwner = 'US';
        p.criteria.acquaSubOwner = 'TENANT';
        break;
      case '50_50':
        if (noMeters) {
          p.criteria.weightMeter = 0;
          p.criteria.weightPeople = 100;
        }
        p.criteria.peopleUs = 1;
        p.criteria.peopleTenant = 1;
        break;
      case '40_60':
        if (noMeters) {
          p.criteria.weightMeter = 0;
          p.criteria.weightPeople = 100;
        }
        p.criteria.peopleUs = 4;
        p.criteria.peopleTenant = 6;
        break;
      case '60_40':
        if (noMeters) {
          p.criteria.weightMeter = 0;
          p.criteria.weightPeople = 100;
        }
        p.criteria.peopleUs = 6;
        p.criteria.peopleTenant = 4;
        break;
      case '100_METERS':
        p.criteria.weightMeter = 100;
        p.criteria.weightPeople = 0;
        break;
    }
    this.stateService.saveState();
  }

  // Modifica Campi Utenze e Rettifica Manuale
  onUtilityInput(): void {
    this.stateService.saveState();
  }

  onManualOverrideInput(utility: UtilityKey, rawValue: string | number | null): void {
    const p = this.activePeriod();
    if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') {
      p[utility].manualTenant = null;
    } else {
      const parsed = Number(String(rawValue).replace(',', '.'));
      p[utility].manualTenant = Number.isNaN(parsed) ? null : parsed;
    }
    this.stateService.saveState();
  }

  clearManualOverride(utility: UtilityKey): void {
    const p = this.activePeriod();
    p[utility].manualTenant = null;
    this.stateService.saveState();
  }

  // Creazione & Eliminazione Periodo
  openNewPeriodModal(): void {
    const prop = this.activeProperty();
    const lastPeriod = prop.periods[prop.periods.length - 1];
    this.newPeriodName.set('Settembre - Ottobre 2026');
    this.newPeriodDateStart.set(lastPeriod ? lastPeriod.dateEnd : this.getTodayFormatted());
    this.newPeriodDateEnd.set('');
    this.newPeriodCopyReadings.set(true);
    this.isNewPeriodModalOpen.set(true);
  }

  closeNewPeriodModal(): void {
    this.isNewPeriodModalOpen.set(false);
  }

  confirmCreateNewPeriod(): void {
    const name = this.newPeriodName().trim();
    if (!name) {
      this.stateService.showToast('Inserisci il nome del nuovo periodo.', 'warning');
      return;
    }

    const prop = this.activeProperty();
    const lastPeriod = prop.periods[prop.periods.length - 1];
    const copyReadings = this.newPeriodCopyReadings() && Boolean(lastPeriod);

    const newId = `per_${Date.now()}`;
    const newPeriod: BillingPeriod = {
      id: newId,
      name,
      dateStart: this.newPeriodDateStart().trim(),
      dateEnd: this.newPeriodDateEnd().trim(),
      status: 'DA_SALDARE',
      transferDate: '',
      notes: '',
      criteria: JSON.parse(JSON.stringify(prop.defaultCriteria)),
      luce: {
        bill: 0,
        genStart: copyReadings ? lastPeriod.luce.genEnd : 0,
        genEnd: copyReadings ? lastPeriod.luce.genEnd : 0,
        subStart: copyReadings ? lastPeriod.luce.subEnd : 0,
        subEnd: copyReadings ? lastPeriod.luce.subEnd : 0,
        manualTenant: null,
      },
      gas: {
        bill: 0,
        genStart: copyReadings ? lastPeriod.gas.genEnd : 0,
        genEnd: copyReadings ? lastPeriod.gas.genEnd : 0,
        subStart: copyReadings ? lastPeriod.gas.subEnd : 0,
        subEnd: copyReadings ? lastPeriod.gas.subEnd : 0,
        manualTenant: null,
      },
      acqua: {
        bill: 0,
        genStart: copyReadings ? lastPeriod.acqua.genEnd : 0,
        genEnd: copyReadings ? lastPeriod.acqua.genEnd : 0,
        subStart: copyReadings ? lastPeriod.acqua.subEnd : 0,
        subEnd: copyReadings ? lastPeriod.acqua.subEnd : 0,
        manualTenant: null,
      },
    };

    prop.periods.push(newPeriod);
    prop.activePeriodId = newId;
    this.isNewPeriodModalOpen.set(false);
    this.stateService.saveState();
    this.stateService.showToast(
      `Nuovo periodo "${name}" creato con letture iniziali copiate dal mese precedente.`,
      'success'
    );
  }

  deleteActivePeriod(): void {
    const prop = this.activeProperty();
    if (prop.periods.length <= 1) {
      this.stateService.showToast(
        'Non è possibile eliminare l’unico periodo rimasto per questo immobile.',
        'warning'
      );
      return;
    }

    const current = this.activePeriod();
    if (!confirm(`Vuoi davvero eliminare il periodo "${current.name}"?`)) {
      return;
    }

    prop.periods = prop.periods.filter((p) => p.id !== current.id);
    prop.activePeriodId = prop.periods[prop.periods.length - 1].id;
    this.stateService.saveState();
    this.stateService.showToast(`Periodo "${current.name}" rimosso.`, 'info');
  }

  // Drag & Drop e Coda di Caricamento File (Sezione 6)
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver.set(false);
  }

  onDropFiles(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver.set(false);
    if (event.dataTransfer?.files?.length) {
      this.fileProcessor.stageFiles(event.dataTransfer.files);
    }
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.fileProcessor.stageFiles(input.files);
      input.value = '';
    }
  }

  removeStagedFile(stageId: string): void {
    this.fileProcessor.removeStagedFile(stageId);
  }

  clearAllStagedFiles(): void {
    this.fileProcessor.clearAllStagedFiles();
  }

  startStagedFilesProcessing(): void {
    this.fileProcessor.startStagedFilesProcessing();
  }

  // Impostazioni Backup JSON
  openSettingsModal(): void {
    this.isSettingsModalOpen.set(true);
  }

  closeSettingsModal(): void {
    this.isSettingsModalOpen.set(false);
  }

  downloadJsonBackup(): void {
    const json = this.stateService.exportBackupJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_bollette_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  onImportBackupFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      if (this.stateService.importBackupJson(content)) {
        this.isSettingsModalOpen.set(false);
      }
    };
    reader.readAsText(file);
    input.value = '';
  }

  resetFactoryDefaults(): void {
    if (
      confirm(
        'Ripristinare i dati storici originali della specifica (Greta Garbo & Marilyn Monroe)?'
      )
    ) {
      this.stateService.resetFactoryDefaults();
      this.isSettingsModalOpen.set(false);
    }
  }

  // Formattazione valuta italiana (es. 1.490,00 €)
  formatEuro(val: number | null | undefined): string {
    const num = Number(val) || 0;
    return num.toLocaleString('it-IT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  trackByPeriodId(_index: number, item: { period: BillingPeriod }): string {
    return item.period.id;
  }
}
