export const STORAGE_KEY = 'gestionale_bollette_clean_v1';

export type PropertyId = string;
export type SubOwnerType = 'US' | 'TENANT';
export type PeriodStatus = 'PAGATO' | 'DA_SALDARE';
export type BillingFrequency = 'MONTHLY' | 'BIMONTHLY' | 'QUARTERLY';
export type FloorPosition = 'SOTTO' | 'SOPRA';
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
  customLabelUs?: string;
  customLabelTenant?: string;
  customRent?: number | null;
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
  icon?: string;
  name: string;
  address: string;
  labelUs: string;
  labelTenant: string;
  ownerFloor?: FloorPosition;
  defaultRent: number;
  billingFrequency?: BillingFrequency;
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
    activePropertyId: 'immobile_1',
    properties: {
      immobile_1: {
        id: 'immobile_1',
        icon: '🏠',
        name: 'Immobile 1',
        address: 'Indirizzo da configurare',
        labelUs: 'Proprietà',
        labelTenant: 'Inquilini',
        ownerFloor: 'SOTTO',
        defaultRent: 0,
        billingFrequency: 'BIMONTHLY',
        noMetersMode: false,
        defaultCriteria: {
          weightMeter: 30,
          weightPeople: 70,
          peopleUs: 2,
          peopleTenant: 2,
          luceSubOwner: 'US',
          gasSubOwner: 'US',
          acquaSubOwner: 'TENANT',
        },
        activePeriodId: 'periodo_1',
        bankTransfers: [],
        periods: [
          {
            id: 'periodo_1',
            name: 'Nuovo Periodo',
            dateStart: '',
            dateEnd: '',
            status: 'DA_SALDARE',
            transferDate: '',
            notes: '',
            criteria: {
              weightMeter: 30,
              weightPeople: 70,
              peopleUs: 2,
              peopleTenant: 2,
              luceSubOwner: 'US',
              gasSubOwner: 'US',
              acquaSubOwner: 'TENANT',
            },
            luce: {
              bill: 0,
              genStart: 0,
              genEnd: 0,
              subStart: 0,
              subEnd: 0,
              manualTenant: null,
            },
            gas: {
              bill: 0,
              genStart: 0,
              genEnd: 0,
              subStart: 0,
              subEnd: 0,
              manualTenant: null,
            },
            acqua: {
              bill: 0,
              genStart: 0,
              genEnd: 0,
              subStart: 0,
              subEnd: 0,
              manualTenant: null,
            },
          },
        ],
      },
    },
  };
}

export const DEFAULT_STATE: AppState = createInitialDefaultState();
