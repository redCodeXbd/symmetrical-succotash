/** Who a guide is written for. Ids match the seeded role ids. */
export type Audience = 'employee' | 'data-entry' | 'accountant' | 'manager' | 'admin' | 'client' | 'vendor' | 'customer';

export const AUDIENCES: { id: Audience; label: string; blurb: string }[] = [
    { id: 'employee', label: 'Employee', blurb: 'Ask for money, enter expenses, follow your requests' },
    { id: 'data-entry', label: 'Data entry', blurb: 'Enter expenses, vendors, clients and stock quickly' },
    { id: 'accountant', label: 'Accountant', blurb: 'Review, approve and pay; keep funds and vendors straight' },
    { id: 'manager', label: 'Manager', blurb: 'Approve first steps, run projects and watch costs' },
    { id: 'admin', label: 'Admin', blurb: 'Set up people, roles, categories and the look of the app' },
    { id: 'client', label: 'Client', blurb: 'Follow your projects and send documents' },
    { id: 'vendor', label: 'Vendor', blurb: 'Submit invoices and ask for due payments' },
    { id: 'customer', label: 'Customer', blurb: 'What you can do today' },
];

/** A highlighted spot on a screenshot, in percent of the picture. */
export interface Pin {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface HelpStepSpec {
    text: string;
    /** Playwright selector of the thing to point at; used when the screenshots are captured. */
    target?: string;
}

export interface HelpShotSpec {
    id: string;
    caption: string;
    /** How the screenshot is taken. See tools/help-capture.js. */
    capture: { as?: string; actions: unknown[]; wait?: number };
    steps: HelpStepSpec[];
}

export interface HelpGuideSpec {
    id: string;
    title: string;
    feature: string;
    audiences: Audience[];
    /** Where the "Try it" button goes. */
    openPath: string;
    brief: string;
    useCases: string[];
    shots: HelpShotSpec[];
    tips: string[];
    related: string[];
}

export interface HelpStep {
    n: number;
    text: string;
}

export interface HelpShot {
    id: string;
    caption: string;
    image: string;
    steps: (HelpStep & { pin: Pin | null })[];
}

export interface HelpGuide extends Omit<HelpGuideSpec, 'shots'> {
    shots: HelpShot[];
    stepCount: number;
}
