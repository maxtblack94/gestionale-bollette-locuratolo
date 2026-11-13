import { Injectable, signal, computed, inject } from '@angular/core';
import {
  AppState,
  BillingPeriod,
  createInitialDefaultState,
  PropertyConfig,
  PropertyId,
  STORAGE_KEY,
} from '../models/billing.models';
import { StorageSecurityService } from './storage-security.service';

@Injectable({
  providedIn: 'root',
})
export class StateService {
  private readonly security = inject(StorageSecurityService);

  readonly appState = signal<AppState>(createInitialDefaultState());
  private savedBaselineString = '';
  readonly hasUnsavedChanges = signal<boolean>(false);
  readonly lastSavedTimestamp = signal<string | null>(null);
  readonly toastMessage = signal<{ text: string; type: 'success' | 'info' | 'warning' | 'error' } | null>(null);

  readonly propertyList = computed<PropertyConfig[]>(
    () => {
      const state = this.appState();
      return Object.values(state.properties || {});
    },
    { equal: () => false }
  );

  readonly activeProperty = computed<PropertyConfig>(
    () => {
      const state = this.appState();
      const firstProp = Object.values(state.properties)[0];
      return state.properties[state.activePropertyId] || firstProp;
    },
    { equal: () => false }
  );

  readonly activePeriod = computed<BillingPeriod>(
    () => {
      const prop = this.activeProperty();
      const found = prop.periods.find((p) => p.id === prop.activePeriodId);
      return found || prop.periods[0];
    },
    { equal: () => false }
  );

  readonly previousPeriod = computed<BillingPeriod | undefined>(
    () => {
      const prop = this.activeProperty();
      const idx = prop.periods.findIndex((p) => p.id === prop.activePeriodId);
      if (idx > 0) {
        return prop.periods[idx - 1];
      }
      return undefined;
    },
    { equal: () => false }
  );

  constructor() {
    this.initFromStorage();
  }

  getComparableStateString(stateObj: AppState | null | undefined): string {
    if (!stateObj || !stateObj.properties) return '';
    return JSON.stringify(stateObj.properties, (key, value) =>
      key === 'activePeriodId' ? undefined : value
    );
  }

  initFromStorage(): void {
    try {
      // Rimuove eventuali vecchi dati pre-salvati da chiavi legacy
      localStorage.removeItem('villa_multi_utilities_v5');

      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const validated = this.security.decodeStateFromLocalStorage(raw);
        if (validated) {
          this.appState.set(validated);
          this.savedBaselineString = this.getComparableStateString(validated);
          this.hasUnsavedChanges.set(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Errore lettura localStorage, uso stato predefinito:', e);
    }

    const initial = createInitialDefaultState();
    this.appState.set(initial);
    this.savedBaselineString = this.getComparableStateString(initial);
    try {
      localStorage.setItem(STORAGE_KEY, this.security.encodeStateForLocalStorage(initial));
    } catch {
      // ignore storage errors
    }
    this.hasUnsavedChanges.set(false);
  }

  /**
   * Chiamata ad ogni input dell'utente: NON sovrascrive immediatamente il localStorage,
   * ma confronta lo stato corrente con savedBaselineString.
   * Se l'utente rimette il valore originale, hasUnsavedChanges torna immediatamente false.
   */
  saveState(): void {
    const current = this.appState();
    this.appState.set({ ...current });
    const currentComparable = this.getComparableStateString(current);
    this.hasUnsavedChanges.set(currentComparable !== this.savedBaselineString);
  }

  /**
   * Salvataggio esplicito su localStorage (protetto da offuscamento + checksum) e aggiornamento della baseline.
   */
  manualSaveChanges(silent = false): void {
    const current = this.appState();
    try {
      const encoded = this.security.encodeStateForLocalStorage(current);
      localStorage.setItem(STORAGE_KEY, encoded);
    } catch (e) {
      console.error('Errore salvataggio localStorage:', e);
    }
    this.savedBaselineString = this.getComparableStateString(current);
    this.appState.set({ ...current });
    this.hasUnsavedChanges.set(false);
    const now = new Date();
    this.lastSavedTimestamp.set(
      now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    );
    if (!silent) {
      this.showToast('Modifiche salvate e protette nella memoria locale.', 'success');
    }
  }

  /**
   * Ripristina lo stato all'ultimo salvataggio manuale su localStorage.
   */
  revertToLastSavedState(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const validated = this.security.decodeStateFromLocalStorage(raw);
        if (validated) {
          const activeProp = this.appState().activePropertyId;
          if (validated.properties[activeProp]) {
            validated.activePropertyId = activeProp;
          }
          this.appState.set(validated);
          this.savedBaselineString = this.getComparableStateString(validated);
          this.hasUnsavedChanges.set(false);
          this.showToast('Modifiche annullate: ripristinato ultimo stato salvato.', 'info');
          return;
        }
      }
    } catch (e) {
      console.error('Errore ripristino da localStorage:', e);
    }

    const fallback = createInitialDefaultState();
    this.appState.set(fallback);
    this.savedBaselineString = this.getComparableStateString(fallback);
    this.hasUnsavedChanges.set(false);
    this.showToast('Ripristinato stato iniziale.', 'info');
  }

  /**
   * Ripristino completo ai dati di fabbrica e salvataggio.
   */
  resetFactoryDefaults(): void {
    const initial = createInitialDefaultState();
    this.appState.set(initial);
    this.manualSaveChanges(true);
    this.showToast('Gestionale riportato allo stato iniziale vuoto.', 'info');
  }

  setActiveProperty(propId: PropertyId): void {
    const state = this.appState();
    if (state.activePropertyId === propId) return;
    state.activePropertyId = propId;
    this.appState.set({ ...state });
  }

  setActivePeriod(periodId: string): void {
    const state = this.appState();
    const prop = state.properties[state.activePropertyId];
    if (!prop || prop.activePeriodId === periodId) return;
    prop.activePeriodId = periodId;
    const hadChanges = this.hasUnsavedChanges();
    this.appState.set({ ...state });
    if (!hadChanges) {
      this.savedBaselineString = this.getComparableStateString(this.appState());
      this.hasUnsavedChanges.set(false);
    } else {
      this.saveState();
    }
  }

  createProperty(newProp: PropertyConfig): void {
    const state = this.appState();
    state.properties[newProp.id] = newProp;
    state.activePropertyId = newProp.id;
    this.saveState();
    this.showToast(`Nuovo immobile "${newProp.name}" creato e selezionato!`, 'success');
  }

  updatePropertyConfig(
    propId: PropertyId,
    updates: Partial<PropertyConfig>,
    applyToActivePeriod = false
  ): void {
    const state = this.appState();
    const target = state.properties[propId];
    if (!target) return;

    Object.assign(target, updates);
    if (updates.defaultCriteria) {
      target.defaultCriteria = { ...target.defaultCriteria, ...updates.defaultCriteria };
    }

    if (applyToActivePeriod) {
      const currentPeriod =
        target.periods.find((p) => p.id === target.activePeriodId) || target.periods[0];
      if (currentPeriod) {
        currentPeriod.criteria = JSON.parse(JSON.stringify(target.defaultCriteria));
      }
    }

    this.saveState();
    this.showToast(`Configurazione di "${target.name}" aggiornata.`, 'success');
  }

  deleteProperty(propId: PropertyId): boolean {
    const state = this.appState();
    const keys = Object.keys(state.properties);
    if (keys.length <= 1) {
      this.showToast('Deve rimanere almeno un immobile nel gestionale.', 'warning');
      return false;
    }

    const removedName = state.properties[propId]?.name || propId;
    delete state.properties[propId];
    const remainingKeys = Object.keys(state.properties);
    if (state.activePropertyId === propId) {
      state.activePropertyId = remainingKeys[0];
    }

    this.saveState();
    this.showToast(`Immobile "${removedName}" eliminato.`, 'info');
    return true;
  }

  exportBackupJson(): string {
    return JSON.stringify(this.appState(), null, 2);
  }

  /**
   * PUNTO 5: Validazione rigorosa dello schema durante l'importazione di un backup JSON.
   */
  importBackupJson(jsonStr: string): boolean {
    const validated = this.security.decodeStateFromLocalStorage(jsonStr);
    if (validated) {
      this.appState.set(validated);
      this.manualSaveChanges(true);
      this.showToast('Backup JSON validato, importato e salvato con successo!', 'success');
      return true;
    }

    this.showToast(
      'File JSON di backup rifiutato: struttura o tipi dei dati non validi.',
      'error'
    );
    return false;
  }

  showToast(text: string, type: 'success' | 'info' | 'warning' | 'error' = 'info'): void {
    this.toastMessage.set({ text, type });
    setTimeout(() => {
      if (this.toastMessage()?.text === text) {
        this.toastMessage.set(null);
      }
    }, 4000);
  }
}
