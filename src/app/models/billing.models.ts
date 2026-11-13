export const STORAGE_KEY = 'villa_multi_utilities_v5';

export type PropertyId = 'greta_garbo' | 'marilyn_monroe';
export type SubOwnerType = 'US' | 'TENANT';
export type PeriodStatus = 'PAGATO' | 'DA_SALDARE';
export type UtilityKey = 'luce' | 'gas' | 'acqua';
export type ActiveTab = 'calcolo' | 'storico' | 'pdf';
export type PdfLanguage = 'BILINGUAL' | 'IT' | 'EN';

export interface DistributionCriteria {
  weightMeter: number;
  weightPeople: number;
  peopleUs: number;
  peopleTenant: number;
  luceSubOwner: SubOwnerType;
  gasSubOwner: SubOwnerType;
  acquaSubOwner: SubOwnerType;
}

export interface UtilityData {
  bill: number;
  genStart: number;
  genEnd: number;
  subStart: number;
  subEnd: number;
  manualTenant: number | null;
}

export interface BillingPeriod {
  id: string;
  name: string;
  dateStart: string;
  dateEnd: string;
  status: PeriodStatus;
  transferDate: string;
  notes: string;
  criteria: DistributionCriteria;
  luce: UtilityData;
  gas: UtilityData;
  acqua: UtilityData;
}

export interface BankTransfer {
  id: string;
  date: string;
  refMonth: string;
  rentAmount: number;
  billsAmount: number;
  notes: string;
}

export interface PropertyConfig {
  id: PropertyId;
  name: string;
  address: string;
  labelUs: string;
  labelTenant: string;
  defaultRent: number;
  noMetersMode: boolean;
  defaultCriteria: DistributionCriteria;
  activePeriodId: string;
  bankTransfers: BankTransfer[];
  periods: BillingPeriod[];
}

export interface AppState {
  activePropertyId: PropertyId;
  properties: Record<PropertyId, PropertyConfig>;
}

export interface UtilityCalculationResult {
  billAmount: number;
  deltaGen: number;
  deltaSub: number;
  ratio: number;
  shareUs: number;
  shareTenant: number;
  isManual: boolean;
  subOwner: SubOwnerType;
  warnings: string[];
}

export interface PeriodCalculationSummary {
  luce: UtilityCalculationResult;
  gas: UtilityCalculationResult;
  acqua: UtilityCalculationResult;
  totalBill: number;
  totalUs: number;
  totalTenant: number;
}

export type StagedTargetCategory =
  | 'AUTO'
  | 'LUCE_GEN'
  | 'LUCE_SUB'
  | 'GAS_GEN'
  | 'GAS_SUB'
  | 'ACQUA_GEN'
  | 'ACQUA_SUB'
  | 'BOLLETTA_LUCE'
  | 'BOLLETTA_GAS'
  | 'BOLLETTA_ACQUA'
  | 'ALTRO';

export interface StagedFileItem {
  stageId: string;
  file: File;
  name: string;
  sizeKb: string;
  icon: '🖼️' | '📄' | '📊';
  fileKind: 'image' | 'pdf' | 'excel';
  status: 'WAITING' | 'PROCESSING' | 'DONE' | 'ERROR';
  statusText: string;
  previewUrl?: string;
  forcedTarget: StagedTargetCategory;
}

export function createInitialDefaultState(): AppState {
  return {
    activePropertyId: 'greta_garbo',
    properties: {
      greta_garbo: {
        id: 'greta_garbo',
        name: 'Via Greta Garbo 13',
        address: 'Via Greta Garbo 13, 00128 Roma (RM)',
        labelUs: 'Io & Rachele',
        labelTenant: 'Famiglia Channon',
        defaultRent: 1490.0,
        noMetersMode: false,
        defaultCriteria: {
          weightMeter: 30,
          weightPeople: 70,
          peopleUs: 2,
          peopleTenant: 5,
          luceSubOwner: 'US',
          gasSubOwner: 'US',
          acquaSubOwner: 'TENANT',
        },
        activePeriodId: 'mag_giu_2026',
        bankTransfers: [
          {
            id: 'tr_gg_1',
            date: '03/07/2026',
            refMonth: 'Aprile',
            rentAmount: 1490.0,
            billsAmount: 82.0,
            notes: 'Saldato affitto + bollette Aprile (66,83€ Luce + 14,98€ Gas)',
          },
          {
            id: 'tr_gg_2',
            date: '31/07/2026',
            refMonth: 'Maggio - Giugno',
            rentAmount: 1490.0,
            billsAmount: 490.0,
            notes: 'Saldato affitto + bollette Maggio-Giugno (489,38€ arrotondato a 490€)',
          },
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
          },
          {
            id: 'aprile_2026',
            name: 'Aprile 2026',
            dateStart: '20/04/2026',
            dateEnd: '20/05/2026',
            status: 'PAGATO',
            transferDate: '03/07/2026',
            notes: 'Acqua pagata con precedente bolletta che arrivava fino ad aprile.',
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
              bill: 100.03,
              genStart: 26474,
              genEnd: 26900,
              subStart: 22089,
              subEnd: 22277,
              manualTenant: null,
            },
            gas: {
              bill: 19.78,
              genStart: 14541,
              genEnd: 14810,
              subStart: 8850,
              subEnd: 8889,
              manualTenant: null,
            },
            acqua: {
              bill: 0.0,
              genStart: 312,
              genEnd: 340,
              subStart: 1454,
              subEnd: 1469,
              manualTenant: null,
            },
          },
          {
            id: 'mag_giu_2026',
            name: 'Maggio - Giugno 2026',
            dateStart: '20/05/2026',
            dateEnd: '28/07/2026',
            status: 'PAGATO',
            transferDate: '31/07/2026',
            notes: 'Utilizzate come letture di fine mese quelle di luglio.',
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
              bill: 283.29,
              genStart: 26900,
              genEnd: 28176,
              subStart: 22277,
              subEnd: 22656,
              manualTenant: null,
            },
            gas: {
              bill: 162.49,
              genStart: 14610,
              genEnd: 14689,
              subStart: 8889,
              subEnd: 8931,
              manualTenant: null,
            },
            acqua: {
              bill: 277.33,
              genStart: 340,
              genEnd: 397,
              subStart: 1469,
              subEnd: 1500,
              manualTenant: null,
            },
          },
          {
            id: 'lug_ago_2026',
            name: 'Luglio - Agosto 2026',
            dateStart: '28/07/2026',
            dateEnd: '13/09/2026',
            status: 'DA_SALDARE',
            transferDate: '',
            notes: 'Utilizzate come letture di fine mese quelle del 13 settembre.',
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
              bill: 412.52,
              genStart: 28176,
              genEnd: 29179,
              subStart: 22656,
              subEnd: 22916,
              manualTenant: null,
            },
            gas: {
              bill: 92.9,
              genStart: 14689,
              genEnd: 14714,
              subStart: 8931,
              subEnd: 8939,
              manualTenant: null,
            },
            acqua: {
              bill: 254.79,
              genStart: 397,
              genEnd: 425,
              subStart: 1500,
              subEnd: 1514,
              manualTenant: null,
            },
          },
        ],
      },
      marilyn_monroe: {
        id: 'marilyn_monroe',
        name: 'Via Marilyn Monroe 150',
        address: 'Via Marilyn Monroe 150, 00128 Roma (RM)',
        labelUs: 'Mamma (Piano Sotto)',
        labelTenant: 'Inquilini (Piano Sopra)',
        defaultRent: 1100.0,
        noMetersMode: true,
        defaultCriteria: {
          weightMeter: 0,
          weightPeople: 100,
          peopleUs: 1,
          peopleTenant: 1,
          luceSubOwner: 'US',
          gasSubOwner: 'US',
          acquaSubOwner: 'TENANT',
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
            criteria: {
              weightMeter: 0,
              weightPeople: 100,
              peopleUs: 1,
              peopleTenant: 1,
              luceSubOwner: 'US',
              gasSubOwner: 'US',
              acquaSubOwner: 'TENANT',
            },
            luce: { bill: 218.4, genStart: 0, genEnd: 0, subStart: 0, subEnd: 0, manualTenant: null },
            gas: { bill: 342.6, genStart: 0, genEnd: 0, subStart: 0, subEnd: 0, manualTenant: null },
            acqua: { bill: 145.2, genStart: 0, genEnd: 0, subStart: 0, subEnd: 0, manualTenant: null },
          },
          {
            id: 'mm_apr_2026',
            name: 'Aprile 2026',
            dateStart: '01/04/2026',
            dateEnd: '30/04/2026',
            status: 'PAGATO',
            transferDate: '04/07/2026',
            notes: 'Divisione al 50% (Metà ciascuno).',
            criteria: {
              weightMeter: 0,
              weightPeople: 100,
              peopleUs: 1,
              peopleTenant: 1,
              luceSubOwner: 'US',
              gasSubOwner: 'US',
              acquaSubOwner: 'TENANT',
            },
            luce: { bill: 94.5, genStart: 0, genEnd: 0, subStart: 0, subEnd: 0, manualTenant: null },
            gas: { bill: 48.2, genStart: 0, genEnd: 0, subStart: 0, subEnd: 0, manualTenant: null },
            acqua: { bill: 0.0, genStart: 0, genEnd: 0, subStart: 0, subEnd: 0, manualTenant: null },
          },
          {
            id: 'mm_mag_giu_2026',
            name: 'Maggio - Giugno 2026',
            dateStart: '01/05/2026',
            dateEnd: '30/06/2026',
            status: 'DA_SALDARE',
            transferDate: '',
            notes:
              'Carica solo le foto o i PDF delle bollette: di base divide a metà (50%/50%), ma puoi modificare i criteri sopra.',
            criteria: {
              weightMeter: 0,
              weightPeople: 100,
              peopleUs: 1,
              peopleTenant: 1,
              luceSubOwner: 'US',
              gasSubOwner: 'US',
              acquaSubOwner: 'TENANT',
            },
            luce: { bill: 196.8, genStart: 0, genEnd: 0, subStart: 0, subEnd: 0, manualTenant: null },
            gas: { bill: 86.4, genStart: 0, genEnd: 0, subStart: 0, subEnd: 0, manualTenant: null },
            acqua: { bill: 168.9, genStart: 0, genEnd: 0, subStart: 0, subEnd: 0, manualTenant: null },
          },
          {
            id: 'mm_lug_ago_2026',
            name: 'Luglio - Agosto 2026',
            dateStart: '01/07/2026',
            dateEnd: '31/08/2026',
            status: 'DA_SALDARE',
            transferDate: '',
            notes: 'Divisione al 50% (Metà ciascuno).',
            criteria: {
              weightMeter: 0,
              weightPeople: 100,
              peopleUs: 1,
              peopleTenant: 1,
              luceSubOwner: 'US',
              gasSubOwner: 'US',
              acquaSubOwner: 'TENANT',
            },
            luce: { bill: 245.1, genStart: 0, genEnd: 0, subStart: 0, subEnd: 0, manualTenant: null },
            gas: { bill: 54.3, genStart: 0, genEnd: 0, subStart: 0, subEnd: 0, manualTenant: null },
            acqua: { bill: 152.4, genStart: 0, genEnd: 0, subStart: 0, subEnd: 0, manualTenant: null },
          },
        ],
      },
    },
  };
}

export const DEFAULT_STATE: AppState = createInitialDefaultState();
