import { Injectable, signal, computed } from '@angular/core';
import {
  AppState,
  BillingPeriod,
  createInitialDefaultState,
  PropertyConfig,
  PropertyId,
  STORAGE_KEY,
} from '../models/billing.models';

@Injectable({
  providedIn: 'root',
})
export class StateService {
  readonly appState = signal<AppState>(createInitialDefaultState());
  private savedBaselineString = '';
  readonly hasUnsavedChanges = signal<boolean>(false);
  readonly lastSavedTimestamp = signal<string | null>(null);
  readonly toastMessage = signal<{ text: string; type: 'success' | 'info' | 'warning' | 'error' } | null>(null);

  readonly activeProperty = computed<PropertyConfig>(
    () => {
      const state = this.appState();
      return state.properties[state.activePropertyId] || state.properties.greta_garbo;
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

  private cloneState(state: AppState): AppState {
    return JSON.parse(JSON.stringify(state));
  }

  initFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AppState;
        if (parsed && parsed.properties && parsed.properties.greta_garbo && parsed.properties.marilyn_monroe) {
          this.appState.set(parsed);
          this.savedBaselineString = this.getComparableStateString(parsed);
          this.hasUnsavedChanges.set(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Errore lettura localStorage, uso DEFAULT_STATE:', e);
    }

    const initial = createInitialDefaultState();
    this.appState.set(initial);
    this.savedBaselineString = this.getComparableStateString(initial);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
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
   * Salvataggio esplicito su localStorage e aggiornamento della baseline.
   */
  manualSaveChanges(silent = false): void {
    const current = this.appState();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
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
      this.showToast('Modifiche salvate correttamente nella memoria locale.', 'success');
    }
  }

  /**
   * Ripristina lo stato all'ultimo salvataggio manuale su localStorage.
   */
  revertToLastSavedState(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AppState;
        if (parsed && parsed.properties) {
          // Mantieni immobile attivo corrente per comodità visiva ma ripristina tutte le properties
          const activeProp = this.appState().activePropertyId;
          parsed.activePropertyId = activeProp;
          this.appState.set(parsed);
          this.savedBaselineString = this.getComparableStateString(parsed);
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
   * Ripristino completo ai dati di fabbrica (DEFAULT_STATE) e salvataggio.
   */
  resetFactoryDefaults(): void {
    const initial = createInitialDefaultState();
    this.appState.set(initial);
    this.manualSaveChanges(true);
    this.showToast('Dati storici predefiniti ripristinati con successo.', 'info');
  }

  setActiveProperty(propId: PropertyId): void {
    const state = this.appState();
    if (state.activePropertyId === propId) return;
    state.activePropertyId = propId;
    // Il cambio di scheda o immobile attivo non altera savedBaselineString
    this.appState.set({ ...state });
  }

  setActivePeriod(periodId: string): void {
    const state = this.appState();
    const prop = state.properties[state.activePropertyId];
    if (!prop || prop.activePeriodId === periodId) return;
    prop.activePeriodId = periodId;
    // Nota: activePeriodId è dentro properties, ma per non sporcare il pulsante Salva
    // al semplice cambio di mese visualizzato, aggiorniamo allineando la baseline se non c'erano modifiche pendenti
    const hadChanges = this.hasUnsavedChanges();
    this.appState.set({ ...state });
    if (!hadChanges) {
      this.savedBaselineString = this.getComparableStateString(this.appState());
      this.hasUnsavedChanges.set(false);
    } else {
      this.saveState();
    }
  }

  exportBackupJson(): string {
    return JSON.stringify(this.appState(), null, 2);
  }

  importBackupJson(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr) as AppState;
      if (parsed && parsed.properties && parsed.properties.greta_garbo && parsed.properties.marilyn_monroe) {
        this.appState.set(parsed);
        this.manualSaveChanges(true);
        this.showToast('Backup JSON importato e salvato con successo!', 'success');
        return true;
      }
    } catch (e) {
      console.error('JSON non valido:', e);
    }
    this.showToast('File JSON di backup non valido.', 'error');
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
