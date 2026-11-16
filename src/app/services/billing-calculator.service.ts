import { Injectable } from '@angular/core';
import {
  BillingPeriod,
  DistributionCriteria,
  PeriodCalculationSummary,
  PropertyConfig,
  SubOwnerType,
  UtilityCalculationResult,
  UtilityData,
  UtilityKey,
} from '../models/billing.models';

@Injectable({
  providedIn: 'root',
})
export class BillingCalculatorService {
  round2(val: number): number {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  computeSingleUtility(
    utility: UtilityData,
    criteria: DistributionCriteria,
    subOwner: SubOwnerType,
    noMetersMode = false,
    prevUtility?: UtilityData
  ): UtilityCalculationResult {
    const B = Number(utility.bill) || 0;
    const genStart = Number(utility.genStart) || 0;
    const genEnd = Number(utility.genEnd) || 0;
    const subStart = Number(utility.subStart) || 0;
    const subEnd = Number(utility.subEnd) || 0;

    const deltaGen = Math.max(0, genEnd - genStart);
    const deltaSub = Math.max(0, subEnd - subStart);

    const wM = noMetersMode ? 0 : (Number(criteria.weightMeter) || 0) / 100;
    const wP = 1 - wM;

    const pUs = Math.max(0, Number(criteria.peopleUs) || 0);
    const pTenant = Math.max(0, Number(criteria.peopleTenant) || 0);
    const pTot = Math.max(0.0001, pUs + pTenant);

    const warnings: string[] = [];

    const peopleMatter = noMetersMode || wP > 0.0001 || deltaGen <= 0;
    if (peopleMatter && pUs + pTenant <= 0) {
      warnings.push(
        'Quote persone entrambe a zero: la ripartizione a persone non è calcolabile e l\'intero importo viene attribuito a una sola parte.'
      );
    }

    if (!noMetersMode && wM > 0.0001) {
      if (genEnd < genStart) {
        warnings.push(
          `Lettura finale Generale (${genEnd}) inferiore alla lettura iniziale (${genStart}).`
        );
      }
      if (subEnd < subStart) {
        warnings.push(
          `Lettura finale Sotto-Contatore (${subEnd}) inferiore alla lettura iniziale (${subStart}).`
        );
      }
      if (deltaGen > 0 && deltaSub > deltaGen) {
        warnings.push(
          `Consumo Sotto-Contatore (${deltaSub}) superiore al consumo Generale (${deltaGen}).`
        );
      }
      if (prevUtility) {
        const prevGenEnd = Number(prevUtility.genEnd) || 0;
        const prevSubEnd = Number(prevUtility.subEnd) || 0;
        if (prevGenEnd > 0 && genStart !== prevGenEnd) {
          warnings.push(
            `Discontinuità storica Generale: inizio (${genStart}) ≠ fine mese prec. (${prevGenEnd}).`
          );
        }
        if (prevSubEnd > 0 && subStart !== prevSubEnd) {
          warnings.push(
            `Discontinuità storica Sotto-Contatore: inizio (${subStart}) ≠ fine mese prec. (${prevSubEnd}).`
          );
        }
      }
    }

    let ratio = 0;
    if (deltaGen > 0) {
      ratio = Math.min(1, Math.max(0, deltaSub / deltaGen));
    } else {
      ratio = subOwner === 'US' ? pUs / pTot : pTenant / pTot;
    }

    if (B <= 0) {
      return {
        billAmount: 0,
        deltaGen,
        deltaSub,
        ratio,
        shareUs: 0,
        shareTenant: 0,
        isManual: false,
        subOwner,
        warnings,
      };
    }

    // Caso 1 — Rettifica Manuale (manualTenant valorizzato)
    if (
      utility.manualTenant !== null &&
      utility.manualTenant !== undefined &&
      String(utility.manualTenant).trim() !== '' &&
      !Number.isNaN(Number(utility.manualTenant))
    ) {
      const manualVal = Number(utility.manualTenant);
      const shareTenant = this.round2(Math.min(B, Math.max(0, manualVal)));
      const shareUs = this.round2(B - shareTenant);
      return {
        billAmount: B,
        deltaGen,
        deltaSub,
        ratio,
        shareUs,
        shareTenant,
        isManual: true,
        subOwner,
        warnings,
      };
    }

    // Caso 2 — Modalità Senza Contatori (w_M <= 0.0001, solo quote)
    if (wM <= 0.0001) {
      const shareTenant = this.round2(B * (pTenant / pTot));
      const shareUs = this.round2(B - shareTenant);
      return {
        billAmount: B,
        deltaGen,
        deltaSub,
        ratio,
        shareUs,
        shareTenant,
        isManual: false,
        subOwner,
        warnings,
      };
    }

    // Caso 3 — Formula Mista Contatori + Persone (con arrotondamento intermedio a 1 decimale)
    // Con clamping [0, B] per impedire quote superiori al totale bolletta o resti negativi su importi minimi
    if (subOwner === 'US') {
      const rawUs = B * wM * ratio + B * wP * (pUs / pTot);
      const roundedUs = Math.round(rawUs * 10) / 10;
      const shareUs = this.round2(Math.min(B, Math.max(0, roundedUs)));
      const shareTenant = this.round2(B - shareUs);
      return {
        billAmount: B,
        deltaGen,
        deltaSub,
        ratio,
        shareUs,
        shareTenant,
        isManual: false,
        subOwner,
        warnings,
      };
    } else {
      const rawTenant = B * wM * ratio + B * wP * (pTenant / pTot);
      const roundedTenant = Math.round(rawTenant * 10) / 10;
      const shareTenant = this.round2(Math.min(B, Math.max(0, roundedTenant)));
      const shareUs = this.round2(B - shareTenant);
      return {
        billAmount: B,
        deltaGen,
        deltaSub,
        ratio,
        shareUs,
        shareTenant,
        isManual: false,
        subOwner,
        warnings,
      };
    }
  }

  computePeriodSummary(
    period: BillingPeriod,
    property: PropertyConfig,
    prevPeriod?: BillingPeriod
  ): PeriodCalculationSummary {
    const noMeters = property.noMetersMode || period.criteria.weightMeter <= 0.0001;
    const luce = this.computeSingleUtility(
      period.luce,
      period.criteria,
      period.criteria.luceSubOwner || 'US',
      noMeters,
      prevPeriod?.luce
    );
    const gas = this.computeSingleUtility(
      period.gas,
      period.criteria,
      period.criteria.gasSubOwner || 'US',
      noMeters,
      prevPeriod?.gas
    );
    const acqua = this.computeSingleUtility(
      period.acqua,
      period.criteria,
      period.criteria.acquaSubOwner || 'TENANT',
      noMeters,
      prevPeriod?.acqua
    );

    const totalBill = this.round2(luce.billAmount + gas.billAmount + acqua.billAmount);
    const totalUs = this.round2(luce.shareUs + gas.shareUs + acqua.shareUs);
    const totalTenant = this.round2(luce.shareTenant + gas.shareTenant + acqua.shareTenant);

    return {
      luce,
      gas,
      acqua,
      totalBill,
      totalUs,
      totalTenant,
    };
  }

  getUtilityResult(summary: PeriodCalculationSummary, key: UtilityKey): UtilityCalculationResult {
    return summary[key];
  }
}
