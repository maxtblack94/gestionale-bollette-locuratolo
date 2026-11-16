import { TestBed } from '@angular/core/testing';
import { BillingPeriod, DistributionCriteria, PropertyConfig } from '../models/billing.models';
import { BillingCalculatorService } from './billing-calculator.service';

/**
 * Verifica di conformità al documento di specifica tecnica
 * (sezione 3.4 "Tabella di Verifica Matematico-Contabile").
 *
 * Ogni valore atteso è trascritto dalla tabella della specifica e deve
 * corrispondere esattamente al centesimo.
 */
describe('BillingCalculatorService — Conformità alla Specifica Tecnica §3.4', () => {
  let calc: BillingCalculatorService;

  const CRITERIA: DistributionCriteria = {
    weightMeter: 30,
    weightPeople: 70,
    peopleUs: 2,
    peopleTenant: 5,
    luceSubOwner: 'US',
    gasSubOwner: 'US',
    acquaSubOwner: 'TENANT',
  };

  const property = (): PropertyConfig => ({
    id: 'spec_prop',
    name: 'Immobile Specifica',
    address: 'Indirizzo',
    labelUs: 'Piano Sotto',
    labelTenant: 'Piano Sopra',
    defaultRent: 0,
    noMetersMode: false,
    defaultCriteria: { ...CRITERIA },
    activePeriodId: 'p',
    bankTransfers: [],
    periods: [],
  });

  const period = (
    id: string,
    luce: [number, number, number, number, number],
    gas: [number, number, number, number, number],
    acqua: [number, number, number, number, number]
  ): BillingPeriod => {
    const toUtility = ([bill, genStart, genEnd, subStart, subEnd]: [
      number,
      number,
      number,
      number,
      number,
    ]) => ({ bill, genStart, genEnd, subStart, subEnd, manualTenant: null });

    return {
      id,
      name: id,
      dateStart: '',
      dateEnd: '',
      status: 'DA_SALDARE',
      transferDate: '',
      notes: '',
      criteria: { ...CRITERIA },
      luce: toUtility(luce),
      gas: toUtility(gas),
      acqua: toUtility(acqua),
    };
  };

  // [bolletta, genStart, genEnd, subStart, subEnd]
  const SPEC_CASES = [
    {
      nome: 'Febbraio - Marzo 2026',
      luce: [273.27, 25689, 26474, 21692, 22089] as [number, number, number, number, number],
      gas: [495.81, 14303, 14541, 8734, 8850] as [number, number, number, number, number],
      acqua: [198.06, 259, 312, 1423, 1454] as [number, number, number, number, number],
      atteso: {
        luce: { deltaGen: 785, deltaSub: 397, us: 96.1, tenant: 177.17 },
        gas: { deltaGen: 238, deltaSub: 116, us: 171.7, tenant: 324.11 },
        acqua: { deltaGen: 53, deltaSub: 31, us: 64.26, tenant: 133.8 },
        totalBill: 967.14,
        totalUs: 332.06,
        totalTenant: 635.08,
      },
    },
    {
      nome: 'Aprile 2026',
      luce: [100.03, 26474, 26900, 22089, 22277] as [number, number, number, number, number],
      gas: [19.78, 14541, 14810, 8850, 8889] as [number, number, number, number, number],
      acqua: [0.0, 312, 340, 1454, 1469] as [number, number, number, number, number],
      atteso: {
        luce: { deltaGen: 426, deltaSub: 188, us: 33.2, tenant: 66.83 },
        gas: { deltaGen: 269, deltaSub: 39, us: 4.8, tenant: 14.98 },
        acqua: { deltaGen: 28, deltaSub: 15, us: 0, tenant: 0 },
        totalBill: 119.81,
        totalUs: 38.0,
        totalTenant: 81.81,
      },
    },
    {
      nome: 'Maggio - Giugno 2026',
      luce: [283.29, 26900, 28176, 22277, 22656] as [number, number, number, number, number],
      gas: [162.49, 14610, 14689, 8889, 8931] as [number, number, number, number, number],
      acqua: [277.33, 340, 397, 1469, 1500] as [number, number, number, number, number],
      atteso: {
        luce: { deltaGen: 1276, deltaSub: 379, us: 81.9, tenant: 201.39 },
        gas: { deltaGen: 79, deltaSub: 42, us: 58.4, tenant: 104.09 },
        acqua: { deltaGen: 57, deltaSub: 31, us: 93.43, tenant: 183.9 },
        totalBill: 723.11,
        totalUs: 233.73,
        totalTenant: 489.38,
      },
    },
    {
      nome: 'Luglio - Agosto 2026',
      luce: [412.52, 28176, 29179, 22656, 22916] as [number, number, number, number, number],
      gas: [92.9, 14689, 14714, 8931, 8939] as [number, number, number, number, number],
      acqua: [254.79, 397, 425, 1500, 1514] as [number, number, number, number, number],
      atteso: {
        luce: { deltaGen: 1003, deltaSub: 260, us: 114.6, tenant: 297.92 },
        gas: { deltaGen: 25, deltaSub: 8, us: 27.5, tenant: 65.4 },
        acqua: { deltaGen: 28, deltaSub: 14, us: 89.19, tenant: 165.6 },
        totalBill: 760.21,
        totalUs: 231.29,
        totalTenant: 528.92,
      },
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({});
    calc = TestBed.inject(BillingCalculatorService);
  });

  for (const caso of SPEC_CASES) {
    it(`riproduce al centesimo le quote di "${caso.nome}"`, () => {
      const sum = calc.computePeriodSummary(
        period(caso.nome, caso.luce, caso.gas, caso.acqua),
        property()
      );

      for (const key of ['luce', 'gas', 'acqua'] as const) {
        const atteso = caso.atteso[key];
        expect(sum[key].deltaGen).toBe(atteso.deltaGen);
        expect(sum[key].deltaSub).toBe(atteso.deltaSub);
        expect(sum[key].shareUs).toBe(atteso.us);
        expect(sum[key].shareTenant).toBe(atteso.tenant);
        // Invariante contabile: le due quote ricompongono sempre la bolletta
        expect(calc.round2(sum[key].shareUs + sum[key].shareTenant)).toBe(sum[key].billAmount);
      }

      expect(sum.totalBill).toBe(caso.atteso.totalBill);
      expect(sum.totalUs).toBe(caso.atteso.totalUs);
      expect(sum.totalTenant).toBe(caso.atteso.totalTenant);
    });
  }

  it('Caso 2 §3.3 — modalità senza contatori ripartisce in proporzione alle persone', () => {
    const prop = property();
    prop.noMetersMode = true;
    const criteria: DistributionCriteria = {
      ...CRITERIA,
      weightMeter: 0,
      weightPeople: 100,
      peopleUs: 1,
      peopleTenant: 1,
    };
    const p = period('senza_contatori', [218.4, 0, 0, 0, 0], [342.6, 0, 0, 0, 0], [145.2, 0, 0, 0, 0]);
    p.criteria = criteria;

    const sum = calc.computePeriodSummary(p, prop);
    expect(sum.luce.shareUs).toBe(109.2);
    expect(sum.luce.shareTenant).toBe(109.2);
    expect(sum.gas.shareUs).toBe(171.3);
    expect(sum.gas.shareTenant).toBe(171.3);
    expect(sum.acqua.shareUs).toBe(72.6);
    expect(sum.acqua.shareTenant).toBe(72.6);
  });

  it('§3.3 — quote persone entrambe a zero producono un avviso esplicito', () => {
    const prop = property();
    prop.noMetersMode = true;
    const p = period('persone_zero', [500, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]);
    p.criteria = { ...CRITERIA, weightMeter: 0, weightPeople: 100, peopleUs: 0, peopleTenant: 0 };

    const sum = calc.computePeriodSummary(p, prop);
    expect(sum.luce.warnings.some((w) => w.includes('Quote persone entrambe a zero'))).toBe(true);
    expect(calc.round2(sum.luce.shareUs + sum.luce.shareTenant)).toBe(500);
  });

  it('§3.3 — quote persone valorizzate non generano l\'avviso', () => {
    const prop = property();
    prop.noMetersMode = true;
    const p = period('persone_ok', [500, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]);
    p.criteria = { ...CRITERIA, weightMeter: 0, weightPeople: 100, peopleUs: 2, peopleTenant: 3 };

    const sum = calc.computePeriodSummary(p, prop);
    expect(sum.luce.warnings.some((w) => w.includes('Quote persone entrambe a zero'))).toBe(false);
  });

  it('Caso 1 §3.3 — la rettifica manuale ha priorità ed è limitata a [0, B]', () => {
    const p = period('manuale', [100, 0, 100, 0, 50], [100, 0, 100, 0, 50], [100, 0, 100, 0, 50]);
    p.luce.manualTenant = 70;
    p.gas.manualTenant = 500; // oltre l'importo bolletta: va troncato a B
    p.acqua.manualTenant = -10; // negativo: va troncato a 0

    const sum = calc.computePeriodSummary(p, property());

    expect(sum.luce.isManual).toBe(true);
    expect(sum.luce.shareTenant).toBe(70);
    expect(sum.luce.shareUs).toBe(30);

    expect(sum.gas.shareTenant).toBe(100);
    expect(sum.gas.shareUs).toBe(0);

    expect(sum.acqua.shareTenant).toBe(0);
    expect(sum.acqua.shareUs).toBe(100);
  });

  it('§3.3 — con bolletta a zero entrambe le quote sono nulle e non manuali', () => {
    const sum = calc.computePeriodSummary(
      period('zero', [0, 10, 20, 5, 8], [0, 10, 20, 5, 8], [0, 10, 20, 5, 8]),
      property()
    );
    expect(sum.luce.shareUs).toBe(0);
    expect(sum.luce.shareTenant).toBe(0);
    expect(sum.luce.isManual).toBe(false);
    expect(sum.totalBill).toBe(0);
  });

  it('§3.1 — i consumi negativi sono azzerati e segnalati come warning', () => {
    const p = period('regressione', [100, 500, 400, 100, 90], [100, 0, 0, 0, 0], [100, 0, 0, 0, 0]);
    const sum = calc.computePeriodSummary(p, property());

    expect(sum.luce.deltaGen).toBe(0);
    expect(sum.luce.deltaSub).toBe(0);
    expect(sum.luce.warnings.length).toBeGreaterThan(0);
  });
});
