import { Injectable } from '@angular/core';
import {
  AppState,
  BankTransfer,
  BillingFrequency,
  BillingPeriod,
  DistributionCriteria,
  FloorPosition,
  PeriodStatus,
  PropertyConfig,
  SubOwnerType,
  UtilityData,
} from '../models/billing.models';

export interface ProtectedStorageEnvelope {
  __v: 'ENC_V1' | 'OBF_V1';
  alg: 'AES-256-GCM' | 'XOR-BASE64-INTEGRITY';
  iv?: string;
  salt?: string;
  checksum: string;
  payload: string;
}

@Injectable({
  providedIn: 'root',
})
export class StorageSecurityService {
  private readonly localSecret = 'GestionaleLoc_Local_Key_2026_v5';

  /**
   * PUNTO 5: Validazione rigorosa dello schema e sanitizzazione profonda di AppState.
   * Rifiuta qualsiasi JSON malformato, incompleto o con tipi invalidi per prevenire crash a runtime.
   */
  validateAndSanitizeAppState(raw: unknown): AppState | null {
    if (!this.isPlainObject(raw)) return null;

    const rawProps = raw['properties'];
    if (!this.isPlainObject(rawProps)) return null;

    const propKeys = Object.keys(rawProps).filter(
      (k) => k !== '__proto__' && k !== 'constructor' && k !== 'prototype'
    );
    if (propKeys.length === 0) return null;

    const sanitizedProperties: Record<string, PropertyConfig> = {};

    for (const key of propKeys) {
      const propCandidate = rawProps[key];
      const validProp = this.validatePropertyConfig(key, propCandidate);
      if (!validProp) {
        return null;
      }
      sanitizedProperties[validProp.id] = validProp;
    }

    const validIds = Object.keys(sanitizedProperties);
    if (validIds.length === 0) return null;

    const rawActiveId = typeof raw['activePropertyId'] === 'string' ? raw['activePropertyId'] : '';
    const activePropertyId = sanitizedProperties[rawActiveId] ? rawActiveId : validIds[0];

    return {
      activePropertyId,
      properties: sanitizedProperties,
    };
  }

  private validatePropertyConfig(fallbackId: string, obj: unknown): PropertyConfig | null {
    if (!this.isPlainObject(obj)) return null;

    const id = typeof obj['id'] === 'string' && obj['id'].trim() ? obj['id'].trim() : fallbackId;
    const name = typeof obj['name'] === 'string' && obj['name'].trim() ? obj['name'].trim() : '';
    if (!name) return null;

    const address =
      typeof obj['address'] === 'string' && obj['address'].trim() ? obj['address'].trim() : name;
    const labelUs =
      typeof obj['labelUs'] === 'string' && obj['labelUs'].trim()
        ? obj['labelUs'].trim()
        : 'Piano Sotto';
    const labelTenant =
      typeof obj['labelTenant'] === 'string' && obj['labelTenant'].trim()
        ? obj['labelTenant'].trim()
        : 'Inquilini';

    const rawFloor = obj['ownerFloor'];
    const ownerFloor: FloorPosition = rawFloor === 'SOPRA' ? 'SOPRA' : 'SOTTO';

    const defaultRent = this.toNonNegativeNumber(obj['defaultRent'], 0);
    if (defaultRent === null) return null;

    const rawFreq = obj['billingFrequency'];
    const billingFrequency: BillingFrequency =
      rawFreq === 'MONTHLY' || rawFreq === 'BIMONTHLY' || rawFreq === 'QUARTERLY'
        ? rawFreq
        : 'BIMONTHLY';

    const noMetersMode = Boolean(obj['noMetersMode']);
    const defaultCriteria = this.validateCriteria(obj['defaultCriteria'], noMetersMode);
    if (!defaultCriteria) return null;

    if (!Array.isArray(obj['periods']) || obj['periods'].length === 0) {
      return null;
    }

    const periods: BillingPeriod[] = [];
    for (const p of obj['periods']) {
      const validPeriod = this.validatePeriod(p, defaultCriteria);
      if (!validPeriod) return null;
      periods.push(validPeriod);
    }

    const bankTransfers: BankTransfer[] = [];
    if (Array.isArray(obj['bankTransfers'])) {
      for (const bt of obj['bankTransfers']) {
        const validBt = this.validateBankTransfer(bt);
        if (validBt) bankTransfers.push(validBt);
      }
    }

    const rawActivePeriodId =
      typeof obj['activePeriodId'] === 'string' ? obj['activePeriodId'] : '';
    const activePeriodId = periods.some((p) => p.id === rawActivePeriodId)
      ? rawActivePeriodId
      : periods[0].id;

    return {
      id,
      icon: typeof obj['icon'] === 'string' ? obj['icon'] : undefined,
      name,
      address,
      labelUs,
      labelTenant,
      ownerFloor,
      defaultRent,
      billingFrequency,
      noMetersMode,
      defaultCriteria,
      activePeriodId,
      bankTransfers,
      periods,
    };
  }

  private validateCriteria(
    obj: unknown,
    noMetersMode: boolean
  ): DistributionCriteria | null {
    if (!this.isPlainObject(obj)) return null;

    const rawWeightMeter = this.toNonNegativeNumber(obj['weightMeter'], noMetersMode ? 0 : 30);
    if (rawWeightMeter === null || rawWeightMeter > 100) return null;

    const weightMeter = noMetersMode ? 0 : rawWeightMeter;
    const weightPeople = 100 - weightMeter;

    const peopleUs = this.toNonNegativeNumber(obj['peopleUs'], 1);
    const peopleTenant = this.toNonNegativeNumber(obj['peopleTenant'], 1);
    if (peopleUs === null || peopleTenant === null) return null;

    const luceSubOwner = this.toSubOwner(obj['luceSubOwner'], 'US');
    const gasSubOwner = this.toSubOwner(obj['gasSubOwner'], 'US');
    const acquaSubOwner = this.toSubOwner(obj['acquaSubOwner'], 'TENANT');
    if (!luceSubOwner || !gasSubOwner || !acquaSubOwner) return null;

    return {
      weightMeter,
      weightPeople,
      peopleUs,
      peopleTenant,
      luceSubOwner,
      gasSubOwner,
      acquaSubOwner,
    };
  }

  private validatePeriod(
    obj: unknown,
    fallbackCriteria: DistributionCriteria
  ): BillingPeriod | null {
    if (!this.isPlainObject(obj)) return null;

    const id = typeof obj['id'] === 'string' && obj['id'].trim() ? obj['id'].trim() : '';
    const name = typeof obj['name'] === 'string' && obj['name'].trim() ? obj['name'].trim() : '';
    if (!id || !name) return null;

    const status: PeriodStatus =
      obj['status'] === 'PAGATO' || obj['status'] === 'DA_SALDARE' ? obj['status'] : 'DA_SALDARE';

    const criteria = obj['criteria']
      ? this.validateCriteria(obj['criteria'], false)
      : { ...fallbackCriteria };
    if (!criteria) return null;

    const luce = this.validateUtilityData(obj['luce']);
    const gas = this.validateUtilityData(obj['gas']);
    const acqua = this.validateUtilityData(obj['acqua']);
    if (!luce || !gas || !acqua) return null;

    return {
      id,
      name,
      dateStart: typeof obj['dateStart'] === 'string' ? obj['dateStart'] : '',
      dateEnd: typeof obj['dateEnd'] === 'string' ? obj['dateEnd'] : '',
      status,
      transferDate: typeof obj['transferDate'] === 'string' ? obj['transferDate'] : '',
      notes: typeof obj['notes'] === 'string' ? obj['notes'] : '',
      customLabelUs: typeof obj['customLabelUs'] === 'string' ? obj['customLabelUs'] : undefined,
      customLabelTenant:
        typeof obj['customLabelTenant'] === 'string' ? obj['customLabelTenant'] : undefined,
      customRent:
        obj['customRent'] !== null && obj['customRent'] !== undefined
          ? this.toNonNegativeNumber(obj['customRent'], 0)
          : null,
      criteria,
      luce,
      gas,
      acqua,
    };
  }

  private validateUtilityData(obj: unknown): UtilityData | null {
    if (!this.isPlainObject(obj)) return null;

    const bill = this.toNonNegativeNumber(obj['bill']);
    const genStart = this.toNonNegativeNumber(obj['genStart']);
    const genEnd = this.toNonNegativeNumber(obj['genEnd']);
    const subStart = this.toNonNegativeNumber(obj['subStart']);
    const subEnd = this.toNonNegativeNumber(obj['subEnd']);

    if (
      bill === null ||
      genStart === null ||
      genEnd === null ||
      subStart === null ||
      subEnd === null
    ) {
      return null;
    }

    let manualTenant: number | null = null;
    if (obj['manualTenant'] !== null && obj['manualTenant'] !== undefined && obj['manualTenant'] !== '') {
      const parsedManual = this.toNonNegativeNumber(obj['manualTenant']);
      if (parsedManual === null) return null;
      manualTenant = parsedManual;
    }

    return {
      bill,
      genStart,
      genEnd,
      subStart,
      subEnd,
      manualTenant,
    };
  }

  private validateBankTransfer(obj: unknown): BankTransfer | null {
    if (!this.isPlainObject(obj)) return null;
    const id = typeof obj['id'] === 'string' ? obj['id'] : `tr_${Date.now()}`;
    const date = typeof obj['date'] === 'string' ? obj['date'] : '';
    const refMonth = typeof obj['refMonth'] === 'string' ? obj['refMonth'] : '';
    const rentAmount = this.toNonNegativeNumber(obj['rentAmount'], 0);
    const billsAmount = this.toNonNegativeNumber(obj['billsAmount'], 0);
    if (rentAmount === null || billsAmount === null) return null;

    return {
      id,
      date,
      refMonth,
      rentAmount,
      billsAmount,
      notes: typeof obj['notes'] === 'string' ? obj['notes'] : '',
    };
  }

  /**
   * PUNTO 4: Protezione dei dati in localStorage (Offuscamento cifrato + Controllo Integrità Checksum
   * + supporto AES-256-GCM Web Crypto API con Passphrase).
   */
  encodeStateForLocalStorage(state: AppState): string {
    const json = JSON.stringify(state);
    const checksum = this.computeChecksum(json);
    const xored = this.xorTransform(json, this.localSecret);
    const base64 = this.utf8ToBase64(xored);

    const envelope: ProtectedStorageEnvelope = {
      __v: 'OBF_V1',
      alg: 'XOR-BASE64-INTEGRITY',
      checksum,
      payload: base64,
    };
    return JSON.stringify(envelope);
  }

  decodeStateFromLocalStorage(rawStored: string): AppState | null {
    if (!rawStored || !rawStored.trim()) return null;

    try {
      const parsed = JSON.parse(rawStored);

      // Caso 1: Envelope protetto con checksum di integrità
      if (this.isPlainObject(parsed) && parsed['__v'] === 'OBF_V1' && typeof parsed['payload'] === 'string') {
        const xored = this.base64ToUtf8(parsed['payload']);
        const json = this.xorTransform(xored, this.localSecret);
        const expectedChecksum = this.computeChecksum(json);
        if (parsed['checksum'] && parsed['checksum'] !== expectedChecksum) {
          console.warn('Checksum di integrità localStorage non valido: possibile manomissione.');
          return null;
        }
        const inner = JSON.parse(json);
        return this.validateAndSanitizeAppState(inner);
      }

      // Caso 2: Retrocompatibilità con JSON diretto (sempre validato rigorosamente dallo schema)
      return this.validateAndSanitizeAppState(parsed);
    } catch {
      return null;
    }
  }

  /**
   * Cifratura forte AES-256-GCM tramite Web Crypto API nativa (per backup cifrati o PIN utente).
   */
  async encryptStateAesGcm(state: AppState, passphrase: string): Promise<string> {
    const json = JSON.stringify(state);
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(json));

    const envelope: ProtectedStorageEnvelope = {
      __v: 'ENC_V1',
      alg: 'AES-256-GCM',
      salt: this.bytesToBase64(salt),
      iv: this.bytesToBase64(iv),
      checksum: this.computeChecksum(json),
      payload: this.bytesToBase64(new Uint8Array(cipherBuf)),
    };

    return JSON.stringify(envelope, null, 2);
  }

  async decryptStateAesGcm(rawEnvelope: string, passphrase: string): Promise<AppState | null> {
    try {
      const parsed = JSON.parse(rawEnvelope) as ProtectedStorageEnvelope;
      if (parsed?.__v !== 'ENC_V1' || !parsed.salt || !parsed.iv || !parsed.payload) {
        return null;
      }

      const enc = new TextEncoder();
      const dec = new TextDecoder();
      const salt = this.base64ToBytes(parsed.salt);
      const iv = this.base64ToBytes(parsed.iv);
      const cipherBytes = this.base64ToBytes(parsed.payload);

      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(passphrase),
        'PBKDF2',
        false,
        ['deriveKey']
      );

      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt.buffer as ArrayBuffer,
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      const plainBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
        key,
        cipherBytes.buffer as ArrayBuffer
      );

      const json = dec.decode(plainBuf);
      return this.validateAndSanitizeAppState(JSON.parse(json));
    } catch {
      return null;
    }
  }

  private isPlainObject(val: unknown): val is Record<string, any> {
    return typeof val === 'object' && val !== null && !Array.isArray(val);
  }

  private toNonNegativeNumber(val: unknown, fallback?: number): number | null {
    if (val === undefined || val === null || val === '') {
      return fallback !== undefined ? fallback : null;
    }
    const n = typeof val === 'number' ? val : Number(val);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  }

  private toSubOwner(val: unknown, fallback: SubOwnerType): SubOwnerType | null {
    if (val === undefined || val === null) return fallback;
    if (val === 'US' || val === 'TENANT') return val;
    return null;
  }

  private computeChecksum(str: string): string {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  private xorTransform(input: string, key: string): string {
    let out = '';
    for (let i = 0; i < input.length; i++) {
      out += String.fromCharCode(input.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return out;
  }

  private utf8ToBase64(str: string): string {
    const bytes = new TextEncoder().encode(str);
    return this.bytesToBase64(bytes);
  }

  private base64ToUtf8(b64: string): string {
    const bytes = this.base64ToBytes(b64);
    return new TextDecoder().decode(bytes);
  }

  private bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToBytes(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}
