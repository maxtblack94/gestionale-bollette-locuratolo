import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { createInitialDefaultState } from './models/billing.models';
import { BillingCalculatorService } from './services/billing-calculator.service';
import { StateService } from './services/state.service';

describe('Gestionale Ripartizione Bollette — Verifica Specifica Tecnica', () => {
  let calcService: BillingCalculatorService;
  let stateService: StateService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();

    calcService = TestBed.inject(BillingCalculatorService);
    stateService = TestBed.inject(StateService);
  });

  it('dovrebbe creare il componente principale App', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('Sezione 3.4 — Verifica al centesimo di tutti i 4 periodi storici di Via Greta Garbo 13', () => {
    const state = createInitialDefaultState();
    const greta = state.properties.greta_garbo;

    // 1. Febbraio - Marzo 2026
    const pFebMar = greta.periods.find((p) => p.id === 'feb_mar_2026')!;
    const sumFebMar = calcService.computePeriodSummary(pFebMar, greta);
    expect(sumFebMar.luce.deltaGen).toBe(785);
    expect(sumFebMar.luce.deltaSub).toBe(397);
    expect(sumFebMar.luce.shareUs).toBe(96.1);
    expect(sumFebMar.luce.shareTenant).toBe(177.17);

    expect(sumFebMar.gas.deltaGen).toBe(238);
    expect(sumFebMar.gas.deltaSub).toBe(116);
    expect(sumFebMar.gas.shareUs).toBe(171.7);
    expect(sumFebMar.gas.shareTenant).toBe(324.11);

    expect(sumFebMar.acqua.deltaGen).toBe(53);
    expect(sumFebMar.acqua.deltaSub).toBe(31);
    expect(sumFebMar.acqua.shareUs).toBe(64.26);
    expect(sumFebMar.acqua.shareTenant).toBe(133.8);

    expect(sumFebMar.totalBill).toBe(967.14);
    expect(sumFebMar.totalUs).toBe(332.06);
    expect(sumFebMar.totalTenant).toBe(635.08);

    // 2. Aprile 2026
    const pApr = greta.periods.find((p) => p.id === 'aprile_2026')!;
    const sumApr = calcService.computePeriodSummary(pApr, greta);
    expect(sumApr.luce.deltaGen).toBe(426);
    expect(sumApr.luce.deltaSub).toBe(188);
    expect(sumApr.luce.shareUs).toBe(33.2);
    expect(sumApr.luce.shareTenant).toBe(66.83);

    expect(sumApr.gas.deltaGen).toBe(269);
    expect(sumApr.gas.deltaSub).toBe(39);
    expect(sumApr.gas.shareUs).toBe(4.8);
    expect(sumApr.gas.shareTenant).toBe(14.98);

    expect(sumApr.acqua.deltaGen).toBe(28);
    expect(sumApr.acqua.deltaSub).toBe(15);
    expect(sumApr.acqua.shareUs).toBe(0.0);
    expect(sumApr.acqua.shareTenant).toBe(0.0);

    expect(sumApr.totalBill).toBe(119.81);
    expect(sumApr.totalUs).toBe(38.0);
    expect(sumApr.totalTenant).toBe(81.81);

    // 3. Maggio - Giugno 2026
    const pMagGiu = greta.periods.find((p) => p.id === 'mag_giu_2026')!;
    const sumMagGiu = calcService.computePeriodSummary(pMagGiu, greta);
    expect(sumMagGiu.luce.deltaGen).toBe(1276);
    expect(sumMagGiu.luce.deltaSub).toBe(379);
    expect(sumMagGiu.luce.shareUs).toBe(81.9);
    expect(sumMagGiu.luce.shareTenant).toBe(201.39);

    expect(sumMagGiu.gas.deltaGen).toBe(79);
    expect(sumMagGiu.gas.deltaSub).toBe(42);
    expect(sumMagGiu.gas.shareUs).toBe(58.4);
    expect(sumMagGiu.gas.shareTenant).toBe(104.09);

    expect(sumMagGiu.acqua.deltaGen).toBe(57);
    expect(sumMagGiu.acqua.deltaSub).toBe(31);
    expect(sumMagGiu.acqua.shareUs).toBe(93.43);
    expect(sumMagGiu.acqua.shareTenant).toBe(183.9);

    expect(sumMagGiu.totalBill).toBe(723.11);
    expect(sumMagGiu.totalUs).toBe(233.73);
    expect(sumMagGiu.totalTenant).toBe(489.38);

    // 4. Luglio - Agosto 2026
    const pLugAgo = greta.periods.find((p) => p.id === 'lug_ago_2026')!;
    const sumLugAgo = calcService.computePeriodSummary(pLugAgo, greta);
    expect(sumLugAgo.luce.deltaGen).toBe(1003);
    expect(sumLugAgo.luce.deltaSub).toBe(260);
    expect(sumLugAgo.luce.shareUs).toBe(114.6);
    expect(sumLugAgo.luce.shareTenant).toBe(297.92);

    expect(sumLugAgo.gas.deltaGen).toBe(25);
    expect(sumLugAgo.gas.deltaSub).toBe(8);
    expect(sumLugAgo.gas.shareUs).toBe(27.5);
    expect(sumLugAgo.gas.shareTenant).toBe(65.4);

    expect(sumLugAgo.acqua.deltaGen).toBe(28);
    expect(sumLugAgo.acqua.deltaSub).toBe(14);
    expect(sumLugAgo.acqua.shareUs).toBe(89.19);
    expect(sumLugAgo.acqua.shareTenant).toBe(165.6);

    expect(sumLugAgo.totalBill).toBe(760.21);
    expect(sumLugAgo.totalUs).toBe(231.29);
    expect(sumLugAgo.totalTenant).toBe(528.92);
  });

  it('Sezione 5 — Rilevamento modifiche con savedBaselineString e ripristino immediato', () => {
    expect(stateService.hasUnsavedChanges()).toBe(false);

    const period = stateService.activePeriod();
    const originalLuceBill = period.luce.bill;

    // Modifica valore -> hasUnsavedChanges diventa true
    period.luce.bill = 999.99;
    stateService.saveState();
    expect(stateService.hasUnsavedChanges()).toBe(true);

    // Rimette il valore originale -> hasUnsavedChanges torna immediatamente false
    period.luce.bill = originalLuceBill;
    stateService.saveState();
    expect(stateService.hasUnsavedChanges()).toBe(false);
  });

  it('Sezione 7.3 — Comportamento reattivo della data bonifico (updatePeriodTransferDate)', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const period = stateService.activeProperty().periods.find((p) => p.id === 'lug_ago_2026')!;
    expect(period.status).toBe('DA_SALDARE');

    app.updatePeriodTransferDate(period, '15/09/2026');
    expect(period.status).toBe('PAGATO');

    app.updatePeriodTransferDate(period, '');
    expect(period.status).toBe('DA_SALDARE');
  });

  it('Fix Logici — Sincronizzazione bidirezionale togglePeriodStatus, clamping [0, B], conguaglio bankTransfers e correzione discontinuità', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    // 1. Verifica conguaglio arrotondamenti bankTransfers su Greta Garbo (+0.19€ Aprile + 0.62€ Mag-Giu = +0.81€)
    expect(app.historicalTotals().totalRoundingBalance).toBe(0.81);

    // 2. Verifica che togglePeriodStatus da PAGATO a DA_SALDARE svuoti anche transferDate (evitando stati incoerenti)
    const pMagGiu = stateService.activeProperty().periods.find((p) => p.id === 'mag_giu_2026')!;
    expect(pMagGiu.status).toBe('PAGATO');
    expect(pMagGiu.transferDate).toBe('31/07/2026');
    app.togglePeriodStatus(pMagGiu);
    expect(pMagGiu.status).toBe('DA_SALDARE');
    expect(pMagGiu.transferDate).toBe('');

    // 3. Verifica rilevamento e correzione 1-click della discontinuità storica Gas (Aprile 14810 vs Mag-Giu 14610)
    stateService.setActivePeriod('mag_giu_2026');
    expect(app.activePeriodSummary().gas.warnings.length).toBeGreaterThan(0);
    app.alignPreviousEndWithCurrentStart('gas');
    expect(app.previousPeriod()!.gas.genEnd).toBe(14610);
    expect(app.activePeriodSummary().gas.warnings.length).toBe(0);

    // 4. Verifica Agente IA Locale Gratuito (Zero API Key): riconoscimento automatico per continuità storica e OCR
    stateService.setActivePeriod('lug_ago_2026');
    const fp = app.fileProcessor as any;
    const resLuceGen = fp.interpretOcrAndVisuals(
      'IMG_001.jpg',
      'e-distribuzione Tot. A+ = 029179 kWh',
      { redRatio: 0.01, greenLcdRatio: 0.2 },
      'AUTO'
    );
    expect(resLuceGen.category).toBe('LUCE_GEN');
    expect(resLuceGen.value).toBe(29179);

    // Anche senza etichetta testuale, il motore di continuità storica abbina 1514 al sotto-contatore Acqua (subStart=1500)
    const resAcquaSub = fp.interpretOcrAndVisuals(
      'foto_contatore.jpg',
      '01514 m3',
      { redRatio: 0.22, greenLcdRatio: 0.01 },
      'AUTO'
    );
    expect(resAcquaSub.category).toBe('ACQUA_SUB');
    expect(resAcquaSub.value).toBe(1514);
  });
});
