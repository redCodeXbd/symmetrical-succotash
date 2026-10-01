export type ReportFormat = 'xlsx' | 'pdf' | 'docx';

export const FORMAT_LABELS: Record<ReportFormat, string> = {
    xlsx: 'Excel (.xlsx)',
    pdf: 'PDF',
    docx: 'Word (.docx)',
};

export interface TableColumn {
    header: string;
    /** `number` cells are right-aligned and written as numbers in Excel. */
    format?: 'text' | 'number';
}

/** A list report, such as a transaction statement. Cells line up with `columns`. */
export interface TableDoc {
    kind: 'table';
    title: string;
    subtitle?: string;
    columns: TableColumn[];
    rows: (string | number)[][];
    footer?: (string | number)[];
}

export interface DetailSection {
    heading?: string;
    rows: [string, string][];
}

export interface DetailTable {
    heading: string;
    columns: string[];
    rows: string[][];
}

/** A single record: labelled fields plus optional sub-tables such as payments. */
export interface DetailDoc {
    kind: 'detail';
    title: string;
    subtitle?: string;
    badge?: string;
    sections: DetailSection[];
    tables: DetailTable[];
}

export type ReportDoc = TableDoc | DetailDoc;

/** Formats that make sense for each kind of report. */
export const FORMATS_BY_KIND: Record<ReportDoc['kind'], ReportFormat[]> = {
    table: ['xlsx', 'pdf'],
    detail: ['pdf', 'docx'],
};
