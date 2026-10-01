export interface Notification {
    id: string;
    icon?: string;
    image?: string;
    title?: string;
    description?: string;
    time: string;
    link?: string;
    queryParams?: Record<string, string>;
    useRouter?: boolean;
    read: boolean;
}
