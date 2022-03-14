import { Matcher } from 'ohm-js'

export interface WMLQuery {
    (search: string): {
        matcher: () => Matcher;
        nodes?: any;
        source: () => string;
        contents: (value?: string) => WMLQuery;
        contents: () => string;
        prop: (key: string, value: string) => WMLQuery;
        prop: (key: string) => string;
        removeProp: (key: string) => WMLQuery;
        normalize: () => any;
    }
}

export function wmlQueryFactory(sourceString: string): WMLQuery
