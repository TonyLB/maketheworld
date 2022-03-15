import { NormalForm } from '../normalize';
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
        normalize: () => NormalForm;
        replaceInputRange: (startIdx: number, endIdx: number, str: string) => void;
    }
}

export function wmlQueryFactory(sourceString: string): WMLQuery
