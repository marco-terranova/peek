import { Injectable } from '@angular/core';
import { DatabaseService } from './database';
import { firstValueFrom } from 'rxjs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

@Injectable({
  providedIn: 'root'
})
export class ExportService {

  constructor(private dbService: DatabaseService) {}

  async stampaEtichetteBox(boxId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.dbService.getEtichetteBox(boxId).subscribe({
        next: (data: any) => {
          const { box, oggetti } = data;
          const html = this.buildEtichetteHtml(box, oggetti);
          this.apriFinestraStampa(html);
          resolve();
        },
        error: (err: any) => reject(err)
      });
    });
  }

  private buildEtichetteHtml(box: any, oggetti: any[]): string {
    const etichette = oggetti.map(ogg => `
      <div class="etichetta">
        <div class="etichetta-header">
          <span class="etichetta-box">${this.esc(box.nome)}</span>
          ${ogg.fragile ? '<span class="fragile-badge">FRAGILE</span>' : ''}
        </div>
        <div class="etichetta-nome">${this.esc(ogg.nome)}</div>
        <div class="etichetta-footer">
          <span class="etichetta-tipo">${this.esc(ogg.tipo || '—')}</span>
          <span class="etichetta-qty">Q.tà: ${ogg.quantita}</span>
        </div>
        ${ogg.descrizione ? `<div class="etichetta-desc">${this.esc(ogg.descrizione)}</div>` : ''}
      </div>
    `).join('');

    return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Etichette — ${this.esc(box.nome)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      background: #fff;
      padding: 12mm;
    }

    h1 {
      font-size: 14pt;
      margin-bottom: 8mm;
      color: #1a1a2e;
      border-bottom: 1px solid #ccc;
      padding-bottom: 4mm;
    }

    .griglia {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6mm;
    }

    .etichetta {
      border: 1.5px solid #333;
      border-radius: 4mm;
      padding: 4mm 5mm;
      min-height: 32mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-inside: avoid;
    }

    .etichetta-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2mm;
    }

    .etichetta-box {
      font-size: 7pt;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .fragile-badge {
      background: #e53935;
      color: #fff;
      font-size: 6pt;
      font-weight: bold;
      padding: 1px 3px;
      border-radius: 2px;
    }

    .etichetta-nome {
      font-size: 11pt;
      font-weight: 700;
      color: #1a1a2e;
      line-height: 1.2;
      margin: 1mm 0;
      word-break: break-word;
    }

    .etichetta-footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 2mm;
    }

    .etichetta-tipo {
      font-size: 7.5pt;
      color: #444;
      font-style: italic;
    }

    .etichetta-qty {
      font-size: 7.5pt;
      font-weight: 600;
      color: #333;
    }

    .etichetta-desc {
      font-size: 6.5pt;
      color: #777;
      margin-top: 2mm;
      border-top: 0.5px dashed #ccc;
      padding-top: 1.5mm;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    @media print {
      body { padding: 8mm; }
      .griglia { gap: 4mm; }
    }
  </style>
</head>
<body>
  <h1>📦 Etichette box — ${this.esc(box.nome)} (${this.esc(box.armadio)})</h1>
  <div class="griglia">
    ${etichette}
  </div>
</body>
</html>`;
  }

  generaHtmlStampaBox(box: any, oggetti: any[]): string {
    const boxName = (box?.nome || 'BOX').toUpperCase();
    const spazio = box?.rif_armadio || '—';
    const data = box?.data_creazione
      ? new Date(box.data_creazione).toLocaleDateString('it-IT')
      : '—';

    const itemsHtml = oggetti.map((o, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${this.esc(o.nome || '—')}</td>
        <td>${this.esc(o.descrizione || '—')}</td>
        <td>${this.esc(o.categoria || '—')}</td>
      </tr>
    `).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${this.esc(boxName)} — PeekBox</title>
  <style>
    body {
      font-family: 'Segoe UI', -apple-system, sans-serif;
      padding: 32px 40px;
      color: #1E293B;
      background: #fff;
    }
    .header {
      display: flex; align-items: center; gap: 16px;
      margin-bottom: 28px; padding-bottom: 16px;
      border-bottom: 3px solid #3AABDB;
    }
    .header h1 {
      font-size: 1.6rem; font-weight: 900;
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .header h1 span { color: #7DC740; }
    .meta {
      display: flex; gap: 32px; margin-bottom: 24px;
      font-size: 0.85rem; color: #64748B;
    }
    .meta strong { color: #1E293B; }
    table {
      width: 100%; border-collapse: collapse;
      font-size: 0.85rem;
    }
    th {
      background: #3AABDB; color: #fff;
      text-align: left; padding: 10px 14px;
      font-weight: 700; text-transform: uppercase;
      font-size: 0.75rem; letter-spacing: 0.3px;
    }
    td {
      padding: 10px 14px; border-bottom: 1px solid #E2E8F0;
    }
    tr:nth-child(even) td { background: #F8FAFC; }
    .footer {
      margin-top: 32px; padding-top: 12px;
      border-top: 1px solid #E2E8F0;
      font-size: 0.75rem; color: #94A3B8; text-align: center;
    }
    .no-items {
      text-align: center; padding: 48px 0;
      color: #94A3B8; font-size: 0.95rem;
    }
    @media print {
      body { padding: 20px; }
      .header { border-bottom-color: #3AABDB; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${this.esc(boxName)} <span>— ${this.esc(spazio)}</span></h1>
  </div>
  <div class="meta">
    <span><strong>Data creazione:</strong> ${this.esc(data)}</span>
    <span><strong>Oggetti:</strong> ${oggetti.length}</span>
    <span><strong>Spazio:</strong> ${this.esc(spazio)}</span>
  </div>
  ${oggetti.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th style="width:40px">#</th>
        <th>Nome</th>
        <th>Descrizione</th>
        <th>Categoria</th>
      </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>` : `
  <div class="no-items">— Nessun oggetto in questa box —</div>`}
  <div class="footer">
    Generato da PeekBox — ${new Date().toLocaleDateString('it-IT')}
  </div>
</body>
</html>`;
  }

  apriFinestraStampa(html: string): void {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 400);
  }


  downloadCsv(utenteId: string): void {
    this.dbService.getExportCsv(utenteId).subscribe({
      next: (blob: Blob) => {
        this.triggerDownload(blob, `peekbox-inventario.csv`, 'text/csv;charset=utf-8;');
      },
      error: (err: any) => console.error('Errore export CSV:', err)
    });
  }


  downloadJson(utenteId: string): void {
    this.dbService.getExportJson(utenteId).subscribe({
      next: (blob: Blob) => {
        this.triggerDownload(blob, `peekbox-inventario.json`, 'application/json');
      },
      error: (err: any) => console.error('Errore export JSON:', err)
    });
  }


  async stampaBox(boxId: number, elencoBox: any[]): Promise<void> {
    const resOgg: any = await firstValueFrom(
      this.dbService.getOggettiPerBox(boxId) as any
    );
    const box = elencoBox.find(b => b.id == boxId);
    const oggetti: any[] = resOgg?.oggetti ?? resOgg ?? [];

    const html = this.generaHtmlStampaBox(box, oggetti);
    this.apriFinestraStampa(html);
  }


  async generaReportPdf(dati: any[], scope: string, logoBase64: string): Promise<jsPDF> {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    if (logoBase64 && logoBase64.startsWith('data:image')) {
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const targetH = 14;
          const targetW = (img.naturalWidth / img.naturalHeight) * targetH;
          doc.addImage(logoBase64, 'PNG', 14, 10, targetW, targetH);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = logoBase64;
      });
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`CONFIGURAZIONE: ${scope === 'tutto' ? 'TUTTO' : 'SOLO BOX ATTIVE'}`, 130, 14);
    doc.text(`DATA GENERAZIONE: ${new Date().toLocaleDateString('it-IT')}`, 130, 18);

    doc.setDrawColor(58, 171, 219);
    doc.setLineWidth(0.3);
    doc.line(14, 23, 196, 23);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    doc.text('Estratto Analitico dell\'Inventario Spazi e Contenitori', 14, 30);

    autoTable(doc, {
      startY: 35,
      head: [['NOME CONTENITORE / BOX', 'ELENCO OGGETTI INTERNI', 'Q.TÀ', 'ZONA / SPAZIO']],
      body: dati.map((r: any) => [
        r.box,
        r.contenuto,
        r.nOggetti.toString(),
        r.spazio,
      ]),
      theme: 'striped',
      headStyles: {
        fillColor: [58, 171, 219],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
        cellPadding: 4
      },
      bodyStyles: {
        textColor: [30, 41, 59],
        valign: 'middle',
        fontSize: 8,
        cellPadding: 4
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 42, fontStyle: 'bold' },
        1: { cellWidth: 'auto', overflow: 'linebreak' },
        2: { cellWidth: 16, halign: 'center' },
        3: { cellWidth: 36 },
      },
      styles: { font: 'helvetica', overflow: 'linebreak' },
      margin: { left: 14, right: 14 }
    });

    const totPagine = (doc as any).internal.getNumberOfPages();
    const dataOggi  = new Date().toLocaleDateString('it-IT');
    for (let i = 1; i <= totPagine; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Generato da PeekBox • ${dataOggi} — Pagina ${i} di ${totPagine}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' }
      );
    }

    return doc;
  }

  downloadPdf(exportScope: string, dati: any[], logoBase64: string): Promise<void> {
    return this.generaReportPdf(dati, exportScope, logoBase64).then(doc => {
      doc.save(`peekbox_report_${exportScope}_${new Date().toISOString().slice(0, 10)}.pdf`);
    });
  }


  generaReportCsv(dati: any[]): string {
    const header = '"NOME CONTENITORE / BOX","ELENCO OGGETTI INTERNI","Q.TÀ","DATA CREAZIONE","ZONA / SPAZIO"';
    const rows = dati.map(r => {
      const box = (r.box || '').replace(/"/g, '""');
      const contenuto = (r.contenuto || '').replace(/"/g, '""');
      const qta = r.nOggetti ?? 0;
      const data = (r.data || '').replace(/"/g, '""');
      const spazio = (r.spazio || '').replace(/"/g, '""');
      return `"${box}","${contenuto}","${qta}","${data}","${spazio}"`;
    });
    return '\uFEFF' + header + '\r\n' + rows.join('\r\n');
  }


  triggerDownload(blob: Blob, filename: string, mimeType: string): void {
    const url = URL.createObjectURL(new Blob([blob], { type: mimeType }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private esc(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
