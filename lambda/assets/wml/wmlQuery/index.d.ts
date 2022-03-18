import { NormalForm } from '../normalize';
import { Matcher } from 'ohm-js'

declare class WMLQueryResult {
    constructor(WMLQuery, string);
    nodes: () => any[];
    source: string;
    contents: (value?: string) => WMLQuery;
    contents: () => string;
    prop: (key: string, value: string) => WMLQuery;
    prop: (key: string) => string;
    removeProp: (key: string) => WMLQuery;

}

export class WMLQuery {
    constructor(string);
    matcher: Matcher;
    source: string;
    setInput: (string) => void;
    normalize: () => NormalForm;
    replaceInputRange: (startIdx: number, endIdx: number, str: string) => void;
    search: (string) => WMLQueryResult;
}
