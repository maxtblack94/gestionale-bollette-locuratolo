import { Injectable, inject, signal } from '@angular/core';
import {
  StagedFileItem,
  StagedTargetCategory,
  UtilityKey,
} from '../models/billing.models';
import { StateService } from './state.service';

declare global {
  interface Window {
    pdfjsLib?: any;
    XLSX?: any;
    Tesseract?: any;
  }
}

interface ParsedImageReading {
  category: StagedTargetCategory;
  value: number | null;
  description: string;
}

@Injectable({
  providedIn: 'root',
})
export class FileProcessorService {
  private readonly stateService = inject(StateService);

  readonly stagedFilesQueue = signal<StagedFileItem[]>([]);
  readonly isProcessing = signal<boolean>(false);
  readonly progressPercent = signal<number>(0);
  readonly currentStatusLabel = signal<string>('');
  readonly lastProcessSummary = signal<string[]>([]);

  stageFiles(files: FileList | File[]): void {
    const incoming = Array.from(files);
    if (!incoming.length) return;

    const current = [...this.stagedFilesQueue()];
    for (const file of incoming) {
      const lower = file.name.toLowerCase();
      let icon: '🖼️' | '📄' | '📊' = '🖼️';
      let fileKind: 'image' | 'pdf' | 'excel' = 'image';

      if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
        icon = '📄';
        fileKind = 'pdf';
      } else if (
        lower.endsWith('.xlsx') ||
        lower.endsWith('.xls') ||
        file.type.includes('spreadsheet') ||
        file.type.includes('excel')
      ) {
        icon = '📊';
        fileKind = 'excel';
      } else if (
        lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') ||
        lower.endsWith('.png') ||
        lower.endsWith('.webp') ||
        file.type.startsWith('image/')
      ) {
        icon = '🖼️';
        fileKind = 'image';
      } else {
        this.stateService.showToast(`Formato file non supportato: ${file.name}`, 'warning');
        continue;
      }

      const stageId = `stg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const sizeKb = `${(file.size / 1024).toFixed(1)} KB`;
      const previewUrl = fileKind === 'image' ? URL.createObjectURL(file) : undefined;
      const predetectedTarget = fileKind === 'image' ? this.guessTargetFromFilename(file.name) : 'AUTO';

      current.push({
        stageId,
        file,
        name: file.name,
        sizeKb,
        icon,
        fileKind,
        status: 'WAITING',
        statusText: 'Pronto (Agente Locale Gratuito attivo)',
        previewUrl,
        forcedTarget: predetectedTarget,
      });
    }

    this.stagedFilesQueue.set(current);
  }

  setStagedFileTarget(stageId: string, target: StagedTargetCategory): void {
    this.stagedFilesQueue.update((list) =>
      list.map((it) => (it.stageId === stageId ? { ...it, forcedTarget: target } : it))
    );
  }

  removeStagedFile(stageId: string): void {
    const item = this.stagedFilesQueue().find((i) => i.stageId === stageId);
    if (item?.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }
    this.stagedFilesQueue.update((list) => list.filter((it) => it.stageId !== stageId));
  }

  clearAllStagedFiles(): void {
    for (const item of this.stagedFilesQueue()) {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
    }
    this.stagedFilesQueue.set([]);
    this.progressPercent.set(0);
    this.currentStatusLabel.set('');
  }

  async startStagedFilesProcessing(): Promise<void> {
    const queue = this.stagedFilesQueue();
    if (!queue.length || this.isProcessing()) return;

    this.isProcessing.set(true);
    this.progressPercent.set(5);
    const logs: string[] = [];

    try {
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        this.currentStatusLabel.set(`Analisi (${i + 1}/${queue.length}): ${item.name}...`);
        this.updateItemStatus(item.stageId, 'PROCESSING', 'Lettura in corso...');

        try {
          const msg = await this.processSingleUploadedFile(item.file, item.forcedTarget);
          logs.push(`✅ ${item.name}: ${msg}`);
          this.updateItemStatus(item.stageId, 'DONE', msg);
        } catch (err: any) {
          const errMsg = err?.message || 'Errore durante la lettura del file';
          logs.push(`⚠️ ${item.name}: ${errMsg}`);
          this.updateItemStatus(item.stageId, 'ERROR', errMsg);
        }

        const pct = Math.round(((i + 1) / queue.length) * 100);
        this.progressPercent.set(pct);
      }

      this.lastProcessSummary.set(logs);
      // Svuotamento automatico della coda e consolidamento finale come da Specifica 6.1.3
      this.clearAllStagedFiles();
      this.stateService.manualSaveChanges(true);
      this.stateService.showToast(
        `Elaborazione completata (${queue.length} file) e mese consolidato!`,
        'success'
      );
    } finally {
      this.isProcessing.set(false);
    }
  }

  private updateItemStatus(
    stageId: string,
    status: StagedFileItem['status'],
    statusText: string
  ): void {
    this.stagedFilesQueue.update((list) =>
      list.map((it) => (it.stageId === stageId ? { ...it, status, statusText } : it))
    );
  }

  async processSingleUploadedFile(
    file: File,
    forcedTarget: StagedTargetCategory = 'AUTO'
  ): Promise<string> {
    const lower = file.name.toLowerCase();

    if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
      return this.processPdfFile(file);
    }
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      return this.processExcelFile(file);
    }
    return this.processImageSmart(file, forcedTarget);
  }

  /**
   * Gestione Immagini tramite Agente Locale Gratuito (Tesseract.js OCR + Analisi Visiva Canvas + Motore di Continuità Storica)
   */
  private async processImageSmart(
    file: File,
    forcedTarget: StagedTargetCategory = 'AUTO'
  ): Promise<string> {
    const parsed = await this.processImageWithFreeLocalAgent(file, forcedTarget);
    return this.applyParsedImageReading(parsed);
  }

  /**
   * AGENTE LOCALE GRATUITO (ZERO API KEY):
   * Combina:
   * 1. Pre-elaborazione Canvas (contrasto potenziato + analisi cromatica coperchio rosso / display LCD verde)
   * 2. OCR Locale nel Browser tramite Tesseract.js (nessun costo, nessuna chiave richiesta)
   * 3. Motore Esperto di Continuità Storica (confronta le cifre lette con le letture iniziali dei 6 contatori della villa)
   */
  private async processImageWithFreeLocalAgent(
    file: File,
    forcedTarget: StagedTargetCategory = 'AUTO'
  ): Promise<ParsedImageReading> {
    const visualAnalysis = await this.analyzeAndEnhanceImageOnCanvas(file);
    let ocrText = '';

    if (window.Tesseract) {
      try {
        this.currentStatusLabel.set(`🤖 Agente OCR Locale in lettura su ${file.name}...`);
        // Passaggio 1 sull'immagine migliorata ad alto contrasto
        const resEnhanced = await window.Tesseract.recognize(visualAnalysis.enhancedDataUrl, 'eng+ita');
        ocrText += ' ' + (resEnhanced?.data?.text || '');

        // Passaggio 2 sull'immagine originale se ci sono poche cifre
        if ((ocrText.match(/\d/g) || []).length < 3) {
          const resOrig = await window.Tesseract.recognize(file, 'eng+ita');
          ocrText += ' ' + (resOrig?.data?.text || '');
        }
      } catch (ocrErr) {
        console.warn('Errore parziale Tesseract OCR:', ocrErr);
      }
    }

    return this.interpretOcrAndVisuals(file.name, ocrText, visualAnalysis, forcedTarget);
  }

  private interpretOcrAndVisuals(
    fileName: string,
    ocrText: string,
    visual: { redRatio: number; greenLcdRatio: number },
    forcedTarget: StagedTargetCategory
  ): ParsedImageReading {
    const combinedText = `${fileName} ${ocrText}`.toLowerCase();
    const period = this.stateService.activePeriod();

    // 1. Controllo contatori esclusi dalla formula (12-370024 o HMD contaore)
    if (
      forcedTarget === 'ALTRO' ||
      combinedText.includes('370024') ||
      /\bhmd\b/i.test(combinedText) ||
      combinedText.includes('piano terra') ||
      combinedText.includes('interrato')
    ) {
      return {
        category: 'ALTRO',
        value: null,
        description: 'Contatore escluso dalla formula (12-370024 / HMD)',
      };
    }

    // 2. Determinazione categoria tramite selezione utente, parole chiave OCR o nome file
    let category: StagedTargetCategory = forcedTarget;

    if (category === 'AUTO') {
      category = this.guessTargetFromFilename(fileName);
    }

    if (category === 'AUTO') {
      if (
        /totale\s+fattura|totale\s+da\s+pagare|importo\s+da\s+pagare|quanto\s+devo\s+pagare|bolletta|fattura/i.test(
          combinedText
        )
      ) {
        if (/acea|idric|acquedotto|acqua/i.test(combinedText)) category = 'BOLLETTA_ACQUA';
        else if (/gas|smc|metano/i.test(combinedText)) category = 'BOLLETTA_GAS';
        else category = 'BOLLETTA_LUCE';
      } else if (/370035|12-370035/i.test(combinedText)) {
        category = 'ACQUA_SUB';
      } else if (/orbis|contax|3221/i.test(combinedText)) {
        category = 'LUCE_SUB';
      } else if (/tot\.?\s*a\+|areti|distribuzione|enel/i.test(combinedText)) {
        category = 'LUCE_GEN';
      } else if (/themis|\bels\d*/i.test(combinedText)) {
        category = 'GAS_GEN';
      } else if (/meter\s*italia|mg4|\bg4\b/i.test(combinedText)) {
        category = 'GAS_SUB';
      } else if (/acea/i.test(combinedText)) {
        category = 'ACQUA_GEN';
      }
    }

    // 3. Se è una BOLLETTA cartacea, cerchiamo l'importo in Euro con decimali
    if (
      category === 'BOLLETTA_LUCE' ||
      category === 'BOLLETTA_GAS' ||
      category === 'BOLLETTA_ACQUA'
    ) {
      const amount = this.extractEuroAmountFromText(ocrText);
      if (amount !== null) {
        return {
          category,
          value: amount,
          description: `Importo estratto da Agente OCR Locale`,
        };
      }
    }

    // 4. Estrazione di tutti i candidati numerici interi dal testo OCR (e dal nome file se presenti)
    const intCandidates = this.extractMeterIntegerCandidates(ocrText + ' ' + fileName);

    // 5. MOTORE ESPERTO DI CONTINUITÀ STORICA:
    // Confrontiamo i numeri letti dall'OCR con le letture di inizio periodo (genStart / subStart)
    const expectedRanges: Array<{
      cat: StagedTargetCategory;
      start: number;
      maxDelta: number;
    }> = [
      { cat: 'LUCE_GEN', start: period.luce.genStart, maxDelta: 4500 },
      { cat: 'LUCE_SUB', start: period.luce.subStart, maxDelta: 2500 },
      { cat: 'GAS_GEN', start: period.gas.genStart, maxDelta: 1500 },
      { cat: 'GAS_SUB', start: period.gas.subStart, maxDelta: 1000 },
      { cat: 'ACQUA_SUB', start: period.acqua.subStart, maxDelta: 400 },
      { cat: 'ACQUA_GEN', start: period.acqua.genStart, maxDelta: 400 },
    ];

    // Se la categoria è già nota, cerchiamo il candidato numerico più vicino (>= start)
    if (category !== 'AUTO') {
      const targetRange = expectedRanges.find((r) => r.cat === category);
      if (targetRange && targetRange.start > 0) {
        const bestMatch = this.findBestCandidateForStart(
          intCandidates,
          targetRange.start,
          targetRange.maxDelta
        );
        if (bestMatch !== null) {
          return {
            category,
            value: bestMatch,
            description: 'Lettura validata su continuità storica',
          };
        }
      }

      // Se non c'è match nel range storico stretto, prendiamo il numero più plausibile per lunghezza cifre
      if (intCandidates.length > 0) {
        const fallbackVal = intCandidates[0];
        return {
          category,
          value: fallbackVal,
          description: 'Lettura estratta da OCR Locale',
        };
      }
    }

    // Se la categoria è ancora AUTO, usiamo la continuità storica per identificare SIA il contatore SIA la lettura!
    let bestHistoricalMatch: {
      cat: StagedTargetCategory;
      val: number;
      score: number;
    } | null = null;

    for (const cand of intCandidates) {
      for (const r of expectedRanges) {
        if (r.start > 0 && cand >= r.start && cand <= r.start + r.maxDelta) {
          const delta = cand - r.start;
          // Più il consumo delta è realistico (proporzionale a maxDelta), migliore è lo score
          const score = 1 - delta / r.maxDelta;
          if (!bestHistoricalMatch || score > bestHistoricalMatch.score) {
            bestHistoricalMatch = { cat: r.cat, val: cand, score };
          }
        }
      }
    }

    if (bestHistoricalMatch) {
      return {
        category: bestHistoricalMatch.cat,
        value: bestHistoricalMatch.val,
        description: 'Riconosciuto automaticamente per continuità storica contatore',
      };
    }

    // Fallback finale basato sull'analisi cromatica dell'immagine (rosso = ACQUA_SUB, verde = LUCE_GEN)
    if (intCandidates.length > 0) {
      let guessedCat: StagedTargetCategory = 'LUCE_GEN';
      if (visual.redRatio > 0.14) {
        guessedCat = 'ACQUA_SUB';
      } else if (visual.greenLcdRatio > 0.12) {
        guessedCat = 'LUCE_GEN';
      }
      return {
        category: guessedCat,
        value: intCandidates[0],
        description: 'Lettura estratta da Agente Visivo Locale',
      };
    }

    throw new Error(
      'Nessuna cifra leggibile rilevata nella foto. Suggerimento: seleziona il contatore dal menu a tendina sulla miniatura o usa una foto più nitida.'
    );
  }

  private guessTargetFromFilename(fileName: string): StagedTargetCategory {
    const fn = fileName.toLowerCase();
    if (fn.includes('370024') || fn.includes('hmd')) return 'ALTRO';
    if (fn.includes('bolletta') || fn.includes('fattura')) {
      if (fn.includes('acqua') || fn.includes('acea')) return 'BOLLETTA_ACQUA';
      if (fn.includes('gas')) return 'BOLLETTA_GAS';
      if (fn.includes('luce') || fn.includes('enel') || fn.includes('elettr')) return 'BOLLETTA_LUCE';
    }
    if (fn.includes('luce_gen') || fn.includes('areti') || (fn.includes('luce') && fn.includes('gen'))) {
      return 'LUCE_GEN';
    }
    if (fn.includes('luce_sub') || fn.includes('orbis') || fn.includes('contax') || (fn.includes('luce') && fn.includes('sub'))) {
      return 'LUCE_SUB';
    }
    if (fn.includes('gas_gen') || fn.includes('themis') || (fn.includes('gas') && fn.includes('gen'))) {
      return 'GAS_GEN';
    }
    if (fn.includes('gas_sub') || fn.includes('mg4') || (fn.includes('gas') && fn.includes('sub'))) {
      return 'GAS_SUB';
    }
    if (fn.includes('acqua_sub') || fn.includes('370035') || (fn.includes('acqua') && fn.includes('sub'))) {
      return 'ACQUA_SUB';
    }
    if (fn.includes('acqua_gen') || (fn.includes('acqua') && fn.includes('gen'))) {
      return 'ACQUA_GEN';
    }
    return 'AUTO';
  }

  private extractMeterIntegerCandidates(text: string): number[] {
    const results: number[] = [];
    // Gestisce sia numeri con punto decimale tipo 014689.654 (prendendo 14689) sia interi a 3-6 cifre
    const decimalMatches = text.matchAll(/\b0*(\d{3,6})[.,]\d{3}\b/g);
    for (const m of decimalMatches) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n) && n !== 370035 && n !== 370024 && n !== 3221) {
        results.push(n);
      }
    }

    const intMatches = text.matchAll(/\b0*(\d{3,6})\b/g);
    for (const m of intMatches) {
      const n = parseInt(m[1], 10);
      // Escludiamo numeri di serie noti dei contatori (370035, 370024, 3221, 2026)
      if (
        !Number.isNaN(n) &&
        n !== 370035 &&
        n !== 370024 &&
        n !== 3221 &&
        n !== 2026 &&
        n !== 128 &&
        !results.includes(n)
      ) {
        results.push(n);
      }
    }

    return results;
  }

  private findBestCandidateForStart(
    candidates: number[],
    startVal: number,
    maxDelta: number
  ): number | null {
    const valid = candidates.filter((c) => c >= startVal && c <= startVal + maxDelta);
    if (valid.length > 0) {
      // Restituisce il valore più vicino a startVal
      valid.sort((a, b) => a - b);
      return valid[0];
    }
    return null;
  }

  private extractEuroAmountFromText(text: string): number | null {
    const regexSpec =
      /(?:totale\s+fattura|totale\s+da\s+pagare|importo\s+da\s+pagare|quanto\s+devo\s+pagare)[^\d]{0,40}(\d{1,4}(?:\.\d{3})*[.,]\d{2}|\d{1,4}[.,]\d{2})/i;
    const match = text.match(regexSpec);
    if (match && match[1]) {
      return this.parseItalianNumber(match[1]);
    }
    const euroFallback =
      text.match(/(\d{1,4}[.,]\d{2})\s*€/i) || text.match(/€\s*(\d{1,4}[.,]\d{2})/i);
    if (euroFallback && euroFallback[1]) {
      return this.parseItalianNumber(euroFallback[1]);
    }
    return null;
  }

  /**
   * Analizza i colori dell'immagine su HTML5 Canvas e genera una versione ad alto contrasto per l'OCR.
   */
  private analyzeAndEnhanceImageOnCanvas(
    file: File
  ): Promise<{ enhancedDataUrl: string; redRatio: number; greenLcdRatio: number }> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxDim = 1400;
        let w = img.width || 800;
        let h = img.height || 600;
        if (w > maxDim || h > maxDim) {
          const scale = maxDim / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ enhancedDataUrl: '', redRatio: 0, greenLcdRatio: 0 });
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        let redPixels = 0;
        let greenLcdPixels = 0;
        const totalPixels = Math.max(1, w * h);

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Rilevamento rosso intenso (es. ghiera ACQUA_SUB 12-370035)
          if (r > 150 && r > g * 1.5 && r > b * 1.5) {
            redPixels++;
          }
          // Rilevamento retroilluminazione verde LCD (es. LUCE_GEN Areti)
          if (g > 130 && g > r * 1.25 && g > b * 1.25) {
            greenLcdPixels++;
          }

          // Conversione in scala di grigi ad alto contrasto per migliorare la lettura OCR
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          const contrasted = Math.min(255, Math.max(0, (lum - 128) * 1.65 + 128));
          data[i] = contrasted;
          data[i + 1] = contrasted;
          data[i + 2] = contrasted;
        }

        ctx.putImageData(imgData, 0, 0);
        resolve({
          enhancedDataUrl: canvas.toDataURL('image/png'),
          redRatio: redPixels / totalPixels,
          greenLcdRatio: greenLcdPixels / totalPixels,
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ enhancedDataUrl: '', redRatio: 0, greenLcdRatio: 0 });
      };
      img.src = url;
    });
  }

  private applyParsedImageReading(parsed: ParsedImageReading): string {
    const period = this.stateService.activePeriod();
    const val = Number(parsed.value);
    const badge = '🤖 IA Locale';

    switch (parsed.category) {
      case 'LUCE_GEN':
        if (!Number.isNaN(val) && val > 0) period.luce.genEnd = Math.round(val);
        this.stateService.saveState();
        return `[${badge}] Contatore Luce Generale: ${period.luce.genEnd} kWh`;
      case 'LUCE_SUB':
        if (!Number.isNaN(val) && val > 0) period.luce.subEnd = Math.round(val);
        this.stateService.saveState();
        return `[${badge}] Sotto-Contatore Luce (ORBIS): ${period.luce.subEnd} kWh`;
      case 'GAS_GEN':
        if (!Number.isNaN(val) && val > 0) period.gas.genEnd = Math.round(val);
        this.stateService.saveState();
        return `[${badge}] Contatore Gas Generale (Themis): ${period.gas.genEnd} m³`;
      case 'GAS_SUB':
        if (!Number.isNaN(val) && val > 0) period.gas.subEnd = Math.round(val);
        this.stateService.saveState();
        return `[${badge}] Sotto-Contatore Gas (MG4 AL): ${period.gas.subEnd} m³`;
      case 'ACQUA_GEN':
        if (!Number.isNaN(val) && val > 0) period.acqua.genEnd = Math.round(val);
        this.stateService.saveState();
        return `[${badge}] Contatore Acqua Generale (ACEA): ${period.acqua.genEnd} m³`;
      case 'ACQUA_SUB':
        if (!Number.isNaN(val) && val > 0) period.acqua.subEnd = Math.round(val);
        this.stateService.saveState();
        return `[${badge}] Sotto-Contatore Acqua (12-370035): ${period.acqua.subEnd} m³`;
      case 'BOLLETTA_LUCE':
        if (!Number.isNaN(val) && val > 0) period.luce.bill = val;
        this.stateService.saveState();
        return `[${badge}] Bolletta Luce da foto: € ${val.toFixed(2)}`;
      case 'BOLLETTA_GAS':
        if (!Number.isNaN(val) && val > 0) period.gas.bill = val;
        this.stateService.saveState();
        return `[${badge}] Bolletta Gas da foto: € ${val.toFixed(2)}`;
      case 'BOLLETTA_ACQUA':
        if (!Number.isNaN(val) && val > 0) period.acqua.bill = val;
        this.stateService.saveState();
        return `[${badge}] Bolletta Acqua da foto: € ${val.toFixed(2)}`;
      default:
        return `[${badge}] Ignorato (${parsed.description || 'Contatore non usato nella formula'})`;
    }
  }

  private async processPdfFile(file: File): Promise<string> {
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) {
      throw new Error('Libreria PDF.js non caricata.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const maxPages = Math.min(pdf.numPages, 6);
    let fullText = '';

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const strings = content.items.map((item: any) => item.str || '');
      fullText += ' ' + strings.join(' ');
    }

    const lowerText = fullText.toLowerCase();
    let detectedUtility: UtilityKey | null = null;

    if (/acea|idric|acquedotto|acqua/i.test(lowerText)) {
      detectedUtility = 'acqua';
    } else if (/gas|smc|metano/i.test(lowerText)) {
      detectedUtility = 'gas';
    } else if (/luce|kwh|energia|elettric/i.test(lowerText)) {
      detectedUtility = 'luce';
    }

    if (!detectedUtility) {
      const fn = file.name.toLowerCase();
      if (fn.includes('acqua') || fn.includes('acea')) detectedUtility = 'acqua';
      else if (fn.includes('gas')) detectedUtility = 'gas';
      else detectedUtility = 'luce';
    }

    const extractedAmount = this.extractEuroAmountFromText(fullText);
    if (extractedAmount === null || Number.isNaN(extractedAmount)) {
      throw new Error(
        `Impossibile estrarre l'importo totale dal PDF (${detectedUtility.toUpperCase()}).`
      );
    }

    const period = this.stateService.activePeriod();
    period[detectedUtility].bill = extractedAmount;
    this.stateService.saveState();

    return `[📄 PDF Locale] Bolletta ${detectedUtility.toUpperCase()} rilevata: € ${extractedAmount.toFixed(2)}`;
  }

  private async processExcelFile(file: File): Promise<string> {
    const XLSX = window.XLSX;
    if (!XLSX) {
      throw new Error('Libreria SheetJS (XLSX) non caricata.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    const ignoredSheets = ['riepilogo pagamenti', 'data bonifici channon'];
    const validSheets = workbook.SheetNames.filter(
      (name: string) => !ignoredSheets.includes(name.trim().toLowerCase())
    );

    if (!validSheets.length) {
      throw new Error('Nessun foglio mensile valido trovato nel file Excel.');
    }

    const prop = this.stateService.activeProperty();
    const applySheetToPeriod = (sheet: any, targetPeriod: any): boolean => {
      const readCellNum = (cellAddr: string): number | null => {
        const cell = sheet[cellAddr];
        if (!cell || cell.v === undefined || cell.v === null || cell.v === '') return null;
        const num = typeof cell.v === 'number' ? cell.v : this.parseItalianNumber(String(cell.v));
        return Number.isNaN(num) || num < 0 ? null : num;
      };

      let updatedAny = false;
      const luceBill = readCellNum('J5');
      const luceGenStart = readCellNum('C6');
      const luceGenEnd = readCellNum('C7');
      const luceSubStart = readCellNum('G6');
      const luceSubEnd = readCellNum('G7');

      if (luceBill !== null) { targetPeriod.luce.bill = luceBill; updatedAny = true; }
      if (luceGenStart !== null) { targetPeriod.luce.genStart = luceGenStart; updatedAny = true; }
      if (luceGenEnd !== null) { targetPeriod.luce.genEnd = luceGenEnd; updatedAny = true; }
      if (luceSubStart !== null) { targetPeriod.luce.subStart = luceSubStart; updatedAny = true; }
      if (luceSubEnd !== null) { targetPeriod.luce.subEnd = luceSubEnd; updatedAny = true; }

      const gasBill = readCellNum('J14');
      const gasGenStart = readCellNum('C15');
      const gasGenEnd = readCellNum('C16');
      const gasSubStart = readCellNum('G15');
      const gasSubEnd = readCellNum('G16');

      if (gasBill !== null) { targetPeriod.gas.bill = gasBill; updatedAny = true; }
      if (gasGenStart !== null) { targetPeriod.gas.genStart = gasGenStart; updatedAny = true; }
      if (gasGenEnd !== null) { targetPeriod.gas.genEnd = gasGenEnd; updatedAny = true; }
      if (gasSubStart !== null) { targetPeriod.gas.subStart = gasSubStart; updatedAny = true; }
      if (gasSubEnd !== null) { targetPeriod.gas.subEnd = gasSubEnd; updatedAny = true; }

      const acquaBill = readCellNum('J23');
      const acquaGenStart = readCellNum('C24');
      const acquaGenEnd = readCellNum('C25');
      const acquaSubStart = readCellNum('G24');
      const acquaSubEnd = readCellNum('G25');

      if (acquaBill !== null) { targetPeriod.acqua.bill = acquaBill; updatedAny = true; }
      if (acquaGenStart !== null) { targetPeriod.acqua.genStart = acquaGenStart; updatedAny = true; }
      if (acquaGenEnd !== null) { targetPeriod.acqua.genEnd = acquaGenEnd; updatedAny = true; }
      if (acquaSubStart !== null) { targetPeriod.acqua.subStart = acquaSubStart; updatedAny = true; }
      if (acquaSubEnd !== null) { targetPeriod.acqua.subEnd = acquaSubEnd; updatedAny = true; }

      return updatedAny;
    };

    let matchedSheetsCount = 0;
    for (const sheetName of validSheets) {
      const normalizedSheet = sheetName.trim().toLowerCase();
      const matchedPeriod = prop.periods.find(
        (p) =>
          p.name.toLowerCase().includes(normalizedSheet) ||
          normalizedSheet.includes(p.name.toLowerCase().replace(/\s+20\d\d$/, ''))
      );
      if (matchedPeriod && applySheetToPeriod(workbook.Sheets[sheetName], matchedPeriod)) {
        matchedSheetsCount++;
      }
    }

    if (matchedSheetsCount > 0) {
      this.stateService.saveState();
      return `[📊 Excel Locale] Importati ${matchedSheetsCount} fogli mensili nei rispettivi periodi`;
    }

    const period = this.stateService.activePeriod();
    const targetSheetName = validSheets[validSheets.length - 1];
    applySheetToPeriod(workbook.Sheets[targetSheetName], period);
    this.stateService.saveState();
    return `[📊 Excel Locale] Foglio "${targetSheetName}" importato nel periodo corrente`;
  }

  private parseItalianNumber(raw: string): number {
    const cleaned = raw.trim().replace(/\s/g, '');
    if (cleaned.includes(',') && cleaned.includes('.')) {
      return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    }
    if (cleaned.includes(',')) {
      return parseFloat(cleaned.replace(',', '.'));
    }
    return parseFloat(cleaned);
  }
}
