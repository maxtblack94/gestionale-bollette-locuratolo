import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { BillingPeriod, createInitialDefaultState, STORAGE_KEY } from './models/billing.models';
import { BillingCalculatorService } from './services/billing-calculator.service';
import { StateService } from './services/state.service';

describe('Gestionale Ripartizione Bollette — Suite di Verifica', () => {
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

  it('dovrebbe creare il componente principale App con stato iniziale pulito', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
    expect(app.propertyList().length).toBe(1);
    expect(app.activeProperty().id).toBe('immobile_1');
    expect(app.activeProperty().periods.length).toBe(1);
    expect(app.activeProperty().bankTransfers.length).toBe(0);
  });

  it('Motore Matematico — Verifica al centesimo della ripartizione mista contatori + persone', () => {
    const state = createInitialDefaultState();
    const prop = state.properties['immobile_1'];

    const samplePeriod: BillingPeriod = {
      id: 'test_period',
      name: 'Bimestre Test',
      dateStart: '01/01/2026',
      dateEnd: '28/02/2026',
      status: 'DA_SALDARE',
      transferDate: '',
      notes: '',
      criteria: {
        weightMeter: 30,
        weightPeople: 70,
        peopleUs: 2,
        peopleTenant: 5,
        luceSubOwner: 'US',
        gasSubOwner: 'US',
        acquaSubOwner: 'TENANT',
      },
      luce: {
        bill: 273.27,
        genStart: 25689,
        genEnd: 26474,
        subStart: 21692,
        subEnd: 22089,
        manualTenant: null,
      },
      gas: {
        bill: 495.81,
        genStart: 14303,
        genEnd: 14541,
        subStart: 8734,
        subEnd: 8850,
        manualTenant: null,
      },
      acqua: {
        bill: 198.06,
        genStart: 259,
        genEnd: 312,
        subStart: 1423,
        subEnd: 1454,
        manualTenant: null,
      },
    };

    const sum = calcService.computePeriodSummary(samplePeriod, prop);
    expect(sum.luce.deltaGen).toBe(785);
    expect(sum.luce.deltaSub).toBe(397);
    expect(sum.luce.shareUs).toBe(96.1);
    expect(sum.luce.shareTenant).toBe(177.17);

    expect(sum.gas.deltaGen).toBe(238);
    expect(sum.gas.deltaSub).toBe(116);
    expect(sum.gas.shareUs).toBe(171.7);
    expect(sum.gas.shareTenant).toBe(324.11);

    expect(sum.acqua.deltaGen).toBe(53);
    expect(sum.acqua.deltaSub).toBe(31);
    expect(sum.acqua.shareUs).toBe(64.26);
    expect(sum.acqua.shareTenant).toBe(133.8);

    expect(sum.totalBill).toBe(967.14);
    expect(sum.totalUs).toBe(332.06);
    expect(sum.totalTenant).toBe(635.08);
  });

  it('Rilevamento modifiche con savedBaselineString e ripristino immediato', () => {
    expect(stateService.hasUnsavedChanges()).toBe(false);

    const period = stateService.activePeriod();
    const originalLuceBill = period.luce.bill;

    period.luce.bill = 999.99;
    stateService.saveState();
    expect(stateService.hasUnsavedChanges()).toBe(true);

    period.luce.bill = originalLuceBill;
    stateService.saveState();
    expect(stateService.hasUnsavedChanges()).toBe(false);
  });

  it('Comportamento reattivo della data bonifico (updatePeriodTransferDate) e togglePeriodStatus', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const period = stateService.activePeriod();
    expect(period.status).toBe('DA_SALDARE');

    app.updatePeriodTransferDate(period, '15/09/2026');
    expect(period.status).toBe('PAGATO');

    app.togglePeriodStatus(period);
    expect(period.status).toBe('DA_SALDARE');
    expect(period.transferDate).toBe('');
  });

  it('Agente IA Locale Gratuito (Zero API Key): riconoscimento automatico per continuità storica e OCR', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    const p = stateService.activePeriod();
    p.luce.genStart = 28176;
    p.acqua.subStart = 1500;
    stateService.saveState();

    const fp = app.fileProcessor as any;
    const resLuceGen = fp.interpretOcrAndVisuals(
      'IMG_001.jpg',
      'e-distribuzione Tot. A+ = 029179 kWh',
      { redRatio: 0.01, greenLcdRatio: 0.2 },
      'AUTO'
    );
    expect(resLuceGen.category).toBe('LUCE_GEN');
    expect(resLuceGen.value).toBe(29179);

    const resAcquaSub = fp.interpretOcrAndVisuals(
      'foto_contatore.jpg',
      '01514 m3',
      { redRatio: 0.22, greenLcdRatio: 0.01 },
      'AUTO'
    );
    expect(resAcquaSub.category).toBe('ACQUA_SUB');
    expect(resAcquaSub.value).toBe(1514);
  });

  it('Struttura Dinamica — Creazione nuovi immobili, indirizzi, inquilini e personalizzazione per periodo', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    expect(app.propertyList().length).toBe(1);

    app.openCreatePropertyModal();
    app.propFormIcon.set('🏢');
    app.propFormName.set('Immobile Secondario');
    app.propFormAddress.set('Corso Italia 10');
    app.propFormLabelUs.set('Proprietario');
    app.propFormLabelTenant.set('Famiglia Bianchi');
    app.propFormOwnerFloor.set('SOPRA');
    app.propFormDefaultRent.set(1650);
    app.propFormBillingFrequency.set('QUARTERLY');
    app.propFormNoMetersMode.set(false);
    app.propFormWeightMeter.set(40);
    app.propFormPeopleUs.set(2);
    app.propFormPeopleTenant.set(3);
    app.savePropertyModal();

    expect(app.propertyList().length).toBe(2);
    expect(app.activeProperty().name).toBe('Immobile Secondario');
    expect(app.activeProperty().ownerFloor).toBe('SOPRA');
    expect(app.ownerFloorLabel()).toBe('Piano Sopra');
    expect(app.tenantFloorLabel()).toBe('Piano Sotto');
    expect(app.activeProperty().billingFrequency).toBe('QUARTERLY');
    expect(app.getBillingFrequencyLabel(app.activeProperty().billingFrequency)).toBe('Trimestrale');
    expect(app.effectiveLabelTenant()).toBe('Famiglia Bianchi');
    expect(app.effectiveRentAmount()).toBe(1650);

    app.activePeriod().customLabelTenant = 'Nuovi Inquilini Verdi';
    app.activePeriod().customRent = 1700;
    stateService.saveState();
    expect(app.effectiveLabelTenant()).toBe('Nuovi Inquilini Verdi');
    expect(app.effectiveRentAmount()).toBe(1700);
  });

  it('Sicurezza — Protezione localStorage (offuscamento + checksum integrità) e validazione rigorosa schema importBackupJson', () => {
    stateService.saveState();
    const rawStored = localStorage.getItem(STORAGE_KEY)!;
    expect(rawStored).toBeTruthy();

    expect(rawStored.includes('Immobile 1')).toBe(false);
    const parsedEnvelope = JSON.parse(rawStored);
    expect(parsedEnvelope.__v).toBe('OBF_V1');
    expect(typeof parsedEnvelope.checksum).toBe('string');

    expect(stateService.importBackupJson('non è un json')).toBe(false);
    expect(stateService.importBackupJson(JSON.stringify({ properties: {} }))).toBe(false);
    expect(
      stateService.importBackupJson(
        JSON.stringify({
          properties: {
            test_prop: {
              id: 'test_prop',
              name: 'Immobile Incompleto senza periodi validi',
              periods: [],
            },
          },
        })
      )
    ).toBe(false);

    const validExport = stateService.exportBackupJson();
    expect(stateService.importBackupJson(validExport)).toBe(true);
  });

  it('UI — Le card utenze sono collassabili, indipendenti e la preferenza viene persistita', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    // Di default le card sono compresse per mantenere pulita la home
    expect(app.isUtilityCollapsed('luce')).toBe(true);
    expect(app.areAllUtilitiesCollapsed()).toBe(true);

    // Il toggle di una card non influenza le altre
    app.toggleUtilityCollapse('gas');
    expect(app.isUtilityCollapsed('gas')).toBe(false);
    expect(app.isUtilityCollapsed('luce')).toBe(true);
    expect(app.isUtilityCollapsed('acqua')).toBe(true);
    expect(app.areAllUtilitiesCollapsed()).toBe(false);

    // Con stato misto il pulsante mostra "Comprimi tutto": il click chiude tutte le card
    app.toggleAllUtilities();
    expect(app.areAllUtilitiesCollapsed()).toBe(true);

    // Ora il pulsante mostra "Espandi tutto": il click le apre tutte
    app.toggleAllUtilities();
    expect(app.isUtilityCollapsed('luce')).toBe(false);
    expect(app.isUtilityCollapsed('gas')).toBe(false);
    expect(app.isUtilityCollapsed('acqua')).toBe(false);

    app.toggleAllUtilities();
    expect(app.areAllUtilitiesCollapsed()).toBe(true);

    // La preferenza è persistita fuori dallo stato dati del gestionale
    app.toggleUtilityCollapse('acqua');
    const rawPrefs = localStorage.getItem('gestionale_bollette_ui_prefs_v1');
    expect(rawPrefs).toBeTruthy();
    expect(JSON.parse(rawPrefs!).acqua).toBe(false);

    const rebuilt = TestBed.createComponent(App).componentInstance;
    expect(rebuilt.isUtilityCollapsed('acqua')).toBe(false);
    expect(rebuilt.isUtilityCollapsed('luce')).toBe(true);
  });
});
