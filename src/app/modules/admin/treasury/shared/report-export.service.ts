import { Injectable } from '@angular/core';
import { ThemeService } from 'app/core/theme/theme.service';
import { DateTime } from 'luxon';
import { DetailDoc, ReportDoc, ReportFormat, TableDoc } from './report.types';

/** Builds Excel, PDF and Word files in the browser. Libraries load only when a file is requested. */
@Injectable({ providedIn: 'root' })
export class ReportExportService {
    constructor(private _theme: ThemeService) {}

    private get _primary(): string {
        return this._theme.theme().primary;
    }

    private get _company(): string {
        return this._theme.theme().companyName;
    }

    async download(doc: ReportDoc, format: ReportFormat): Promise<void> {
        const blob = await this.toBlob(doc, format);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = this.fileName(doc, format);
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    toBlob(doc: ReportDoc, format: ReportFormat): Promise<Blob> {
        switch (format) {
            case 'xlsx':
                return this._xlsx(doc);
            case 'pdf':
                return this._pdf(doc);
            default:
                return this._docx(doc);
        }
    }

    fileName(doc: ReportDoc, format: ReportFormat): string {
        const slug = doc.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return `encore-${slug}-${DateTime.now().toFormat('yyyy-MM-dd')}.${format}`;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Excel
    // -----------------------------------------------------------------------------------------------------

    private async _xlsx(doc: ReportDoc): Promise<Blob> {
        const writeXlsxFile = (await import('write-excel-file/browser')).default;
        const table: TableDoc = doc.kind === 'table' ? doc : this._detailAsTable(doc);
        const text = (value: string | number, extra: object = {}) => ({ value: String(value), ...extra });
        const num = (value: number, extra: object = {}) => ({ value, type: Number, format: '#,##0.00', ...extra });
        const cell = (value: string | number, i: number, extra: object = {}) =>
            table.columns[i]?.format === 'number' && typeof value === 'number'
                ? num(value, extra)
                : text(value, extra);

        const rows: any[][] = [[text(table.title, { fontWeight: 'bold', fontSize: 14 })]];
        if (table.subtitle) {
            rows.push([text(table.subtitle)]);
        }
        rows.push([text(`Generated ${DateTime.now().toFormat('dd MMM y, h:mm a')}`)], []);
        rows.push(
            table.columns.map((c) =>
                text(c.header, {
                    fontWeight: 'bold',
                    backgroundColor: '#e8f5e9',
                    align: c.format === 'number' ? 'right' : 'left',
                })
            )
        );
        for (const row of table.rows) {
            rows.push(row.map((v, i) => cell(v, i)));
        }
        if (table.footer) {
            rows.push(table.footer.map((v, i) => cell(v, i, { fontWeight: 'bold' })));
        }
        const columns = table.columns.map((c, i) => ({
            width: Math.min(
                40,
                Math.max(12, c.header.length + 2, ...table.rows.map((r) => String(r[i] ?? '').length + 2))
            ),
        }));
        return writeXlsxFile(rows, { columns, sheet: 'Report' }).toBlob();
    }

    /** Flattens a detail report into a two-column sheet. Not offered in the UI today. */
    private _detailAsTable(doc: DetailDoc): TableDoc {
        return {
            kind: 'table',
            title: doc.title,
            subtitle: doc.subtitle,
            columns: [{ header: 'Field' }, { header: 'Value' }],
            rows: doc.sections.flatMap((s) => s.rows),
        };
    }

    // -----------------------------------------------------------------------------------------------------
    // @ PDF
    // -----------------------------------------------------------------------------------------------------

    private async _pdf(doc: ReportDoc): Promise<Blob> {
        const { jsPDF } = await import('jspdf');
        const autoTable = (await import('jspdf-autotable')).default;
        const wide = doc.kind === 'table' && doc.columns.length > 6;
        const pdf = new jsPDF({ orientation: wide ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
        const margin = 40;
        const pageWidth = pdf.internal.pageSize.getWidth();

        const logo = await this._logo();
        if (logo) {
            pdf.addImage(logo.data, logo.format, margin, 28, logo.width, logo.height);
        } else {
            pdf.setFontSize(13).setTextColor(this._primary);
            pdf.text(this._company, margin, 48);
        }
        pdf.setFontSize(9).setTextColor(110);
        pdf.text(`Generated ${DateTime.now().toFormat('dd MMM y, h:mm a')}`, pageWidth - margin, 40, { align: 'right' });

        pdf.setFontSize(18).setTextColor(20);
        pdf.text(doc.title, margin, 90);
        let y = 90;
        if (doc.subtitle) {
            pdf.setFontSize(10).setTextColor(100);
            pdf.text(doc.subtitle, margin, (y += 16));
        }
        if (doc.kind === 'detail' && doc.badge) {
            pdf.setFontSize(10).setTextColor(40);
            pdf.text(`Status: ${doc.badge}`, margin, (y += 16));
        }
        y += 16;

        const fmt = (v: string | number) => (typeof v === 'number' ? this._n(v) : v);
        const headStyles = { fillColor: this._primary as any, textColor: 255 };

        if (doc.kind === 'table') {
            autoTable(pdf, {
                startY: y,
                margin: { left: margin, right: margin },
                head: [doc.columns.map((c) => c.header)],
                body: doc.rows.map((r) => r.map(fmt)),
                foot: doc.footer ? [doc.footer.map(fmt)] : undefined,
                styles: { fontSize: 8.5, cellPadding: 5 },
                headStyles,
                footStyles: { fillColor: [240, 240, 240] as any, textColor: 20 },
                columnStyles: Object.fromEntries(
                    doc.columns.map((c, i) => [i, { halign: c.format === 'number' ? 'right' : 'left' }])
                ) as any,
            });
        } else {
            for (const section of doc.sections) {
                autoTable(pdf, {
                    startY: y,
                    margin: { left: margin, right: margin },
                    head: section.heading ? [[section.heading, '']] : undefined,
                    body: section.rows,
                    theme: 'plain',
                    styles: { fontSize: 9.5, cellPadding: 4 },
                    headStyles: { fontStyle: 'bold', textColor: 20 },
                    columnStyles: { 0: { textColor: 110, cellWidth: 150 } },
                });
                y = (pdf as any).lastAutoTable.finalY + 14;
            }
            for (const t of doc.tables) {
                pdf.setFontSize(11).setTextColor(20);
                pdf.text(t.heading, margin, y + 4);
                autoTable(pdf, {
                    startY: y + 12,
                    margin: { left: margin, right: margin },
                    head: [t.columns],
                    body: t.rows.length ? t.rows : [['None', ...t.columns.slice(1).map(() => '')]],
                    styles: { fontSize: 8.5, cellPadding: 5 },
                    headStyles,
                });
                y = (pdf as any).lastAutoTable.finalY + 14;
            }
        }

        const pages = pdf.getNumberOfPages();
        const pageHeight = pdf.internal.pageSize.getHeight();
        for (let i = 1; i <= pages; i++) {
            pdf.setPage(i).setFontSize(8).setTextColor(130);
            pdf.text(`${this._company}   |   Page ${i} of ${pages}`, pageWidth / 2, pageHeight - 20, {
                align: 'center',
            });
        }
        return pdf.output('blob');
    }

    /** The company logo as an image jsPDF can embed, scaled to fit the header. SVG logos are skipped. */
    private async _logo(): Promise<{ data: string; format: 'PNG' | 'JPEG' | 'WEBP'; width: number; height: number } | null> {
        try {
            const blob = await (await fetch(this._theme.logoUrl())).blob();
            const format = { 'image/png': 'PNG', 'image/jpeg': 'JPEG', 'image/webp': 'WEBP' }[blob.type] as 'PNG' | 'JPEG' | 'WEBP';
            if (!format) {
                return null;
            }
            const data: string = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            const size: { w: number; h: number } = await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
                img.onerror = reject;
                img.src = data;
            });
            const scale = Math.min(120 / size.w, 40 / size.h);
            return { data, format, width: size.w * scale, height: size.h * scale };
        } catch {
            return null;
        }
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Word
    // -----------------------------------------------------------------------------------------------------

    private async _docx(doc: ReportDoc): Promise<Blob> {
        const d = await import('docx');
        const border = { style: d.BorderStyle.SINGLE, size: 4, color: 'D0D5DD' };
        const borders = { top: border, bottom: border, left: border, right: border };
        const cellOf = (text: string, opts: { bold?: boolean; fill?: string; right?: boolean; color?: string; width?: number } = {}) =>
            new d.TableCell({
                borders,
                width: opts.width ? { size: opts.width, type: d.WidthType.PERCENTAGE } : undefined,
                shading: opts.fill ? { type: d.ShadingType.CLEAR, fill: opts.fill, color: 'auto' } : undefined,
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [
                    new d.Paragraph({
                        alignment: opts.right ? d.AlignmentType.RIGHT : d.AlignmentType.LEFT,
                        children: [new d.TextRun({ text, bold: opts.bold, color: opts.color, size: 19 })],
                    }),
                ],
            });
        const gridTable = (head: string[], body: string[][], rightCols: number[] = []) =>
            new d.Table({
                width: { size: 100, type: d.WidthType.PERCENTAGE },
                rows: [
                    new d.TableRow({
                        tableHeader: true,
                        children: head.map((h, i) => cellOf(h, { bold: true, fill: this._primary.replace('#', '').toUpperCase(), color: 'FFFFFF', right: rightCols.includes(i) })),
                    }),
                    ...body.map((r) => new d.TableRow({ children: r.map((v, i) => cellOf(v, { right: rightCols.includes(i) })) })),
                ],
            });
        const heading = (text: string) =>
            new d.Paragraph({ heading: d.HeadingLevel.HEADING_2, spacing: { before: 280, after: 100 }, children: [new d.TextRun({ text, bold: true, color: '1F2937' })] });

        const children: (import('docx').Paragraph | import('docx').Table)[] = [
            new d.Paragraph({ children: [new d.TextRun({ text: this._company, bold: true, color: this._primary.replace('#', '').toUpperCase(), size: 22 })] }),
            new d.Paragraph({ heading: d.HeadingLevel.HEADING_1, spacing: { before: 120 }, children: [new d.TextRun({ text: doc.title, bold: true })] }),
        ];
        if (doc.subtitle) {
            children.push(new d.Paragraph({ children: [new d.TextRun({ text: doc.subtitle, color: '6B7280' })] }));
        }
        children.push(new d.Paragraph({ spacing: { after: 160 }, children: [new d.TextRun({ text: `Generated ${DateTime.now().toFormat('dd MMM y, h:mm a')}`, color: '6B7280', size: 18 })] }));

        if (doc.kind === 'detail') {
            if (doc.badge) {
                children.push(new d.Paragraph({ children: [new d.TextRun({ text: 'Status: ', bold: true }), new d.TextRun({ text: doc.badge })] }));
            }
            for (const section of doc.sections) {
                if (section.heading) {
                    children.push(heading(section.heading));
                }
                children.push(
                    new d.Table({
                        width: { size: 100, type: d.WidthType.PERCENTAGE },
                        rows: section.rows.map(
                            ([label, value]) =>
                                new d.TableRow({ children: [cellOf(label, { fill: 'F3F4F6', width: 35, color: '4B5563' }), cellOf(value, { width: 65 })] })
                        ),
                    })
                );
            }
            for (const t of doc.tables) {
                children.push(heading(t.heading));
                children.push(
                    t.rows.length
                        ? gridTable(t.columns, t.rows)
                        : new d.Paragraph({ children: [new d.TextRun({ text: 'None', color: '6B7280' })] })
                );
            }
        } else {
            const right = doc.columns.map((c, i) => (c.format === 'number' ? i : -1)).filter((i) => i >= 0);
            const str = (r: (string | number)[]) => r.map((v) => (typeof v === 'number' ? this._n(v) : v));
            children.push(gridTable(doc.columns.map((c) => c.header), doc.rows.map(str), right));
            if (doc.footer) {
                children.push(new d.Paragraph({ spacing: { before: 120 }, children: [new d.TextRun({ text: str(doc.footer).filter(Boolean).join('   '), bold: true })] }));
            }
        }

        const wide = doc.kind === 'table' && doc.columns.length > 6;
        const document = new d.Document({
            creator: 'Encore ERP',
            title: doc.title,
            sections: [
                {
                    properties: wide ? { page: { size: { orientation: d.PageOrientation.LANDSCAPE } } } : {},
                    children,
                },
            ],
        });
        return d.Packer.toBlob(document);
    }

    private _n(n: number): string {
        return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
}
