export interface AppTheme {
    companyName: string;
    /** Data URL of an uploaded logo, or null to use the Encore logo. */
    logo: string | null;
    /** Put the logo on a white badge so dark logos stay visible on a dark sidebar. */
    logoBadge: boolean;

    /** Buttons, links, active states, focus rings. */
    primary: string;
    /** Secondary highlights. */
    accent: string;
    /** Destructive actions and errors. */
    danger: string;

    pageBg: string;
    cardBg: string;
    text: string;

    sidebarBg: string;
    sidebarText: string;
    /** Background of the active menu item. */
    sidebarActive: string;

    headerBg: string;
    headerText: string;
}

export type ThemeColorKey = Exclude<keyof AppTheme, 'companyName' | 'logo' | 'logoBadge'>;

export const DEFAULT_THEME: AppTheme = {
    companyName: 'Encore Engineering Ltd.',
    logo: null,
    logoBadge: false,
    primary: '#39a935',
    accent: '#d5af36',
    danger: '#dc2626',
    pageBg: '#f1f5f9',
    cardBg: '#ffffff',
    text: '#1e293b',
    sidebarBg: '#06110a',
    sidebarText: '#eef6ef',
    sidebarActive: '#39a935',
    headerBg: '#ffffff',
    headerText: '#1e293b',
};

export const DEFAULT_LOGO = 'images/logo/encore-logo.png';

export interface ThemePreset {
    id: string;
    name: string;
    colors: Omit<AppTheme, 'companyName' | 'logo' | 'logoBadge'>;
}

export const THEME_PRESETS: ThemePreset[] = [
    {
        id: 'encore',
        name: 'Encore green',
        colors: {
            primary: '#39a935', accent: '#d5af36', danger: '#dc2626',
            pageBg: '#f1f5f9', cardBg: '#ffffff', text: '#1e293b',
            sidebarBg: '#06110a', sidebarText: '#eef6ef', sidebarActive: '#39a935',
            headerBg: '#ffffff', headerText: '#1e293b',
        },
    },
    {
        id: 'ocean',
        name: 'Ocean blue',
        colors: {
            primary: '#2563eb', accent: '#06b6d4', danger: '#dc2626',
            pageBg: '#eff6ff', cardBg: '#ffffff', text: '#0f172a',
            sidebarBg: '#0b1b3a', sidebarText: '#e6efff', sidebarActive: '#2563eb',
            headerBg: '#ffffff', headerText: '#0f172a',
        },
    },
    {
        id: 'royal',
        name: 'Royal purple',
        colors: {
            primary: '#7c3aed', accent: '#f59e0b', danger: '#e11d48',
            pageBg: '#f5f3ff', cardBg: '#ffffff', text: '#1e1b4b',
            sidebarBg: '#1a1033', sidebarText: '#f3edff', sidebarActive: '#7c3aed',
            headerBg: '#ffffff', headerText: '#1e1b4b',
        },
    },
    {
        id: 'sunset',
        name: 'Sunset amber',
        colors: {
            primary: '#d97706', accent: '#0f766e', danger: '#dc2626',
            pageBg: '#fffbeb', cardBg: '#ffffff', text: '#292524',
            sidebarBg: '#2b1708', sidebarText: '#fff4e0', sidebarActive: '#d97706',
            headerBg: '#ffffff', headerText: '#292524',
        },
    },
    {
        id: 'light-sidebar',
        name: 'Clean light',
        colors: {
            primary: '#0d9488', accent: '#6366f1', danger: '#dc2626',
            pageBg: '#f8fafc', cardBg: '#ffffff', text: '#0f172a',
            sidebarBg: '#ffffff', sidebarText: '#1e293b', sidebarActive: '#0d9488',
            headerBg: '#ffffff', headerText: '#0f172a',
        },
    },
    {
        id: 'midnight',
        name: 'Midnight dark',
        colors: {
            primary: '#38bdf8', accent: '#a78bfa', danger: '#f87171',
            pageBg: '#0f172a', cardBg: '#1e293b', text: '#f1f5f9',
            sidebarBg: '#020617', sidebarText: '#e2e8f0', sidebarActive: '#38bdf8',
            headerBg: '#1e293b', headerText: '#f1f5f9',
        },
    },
];
