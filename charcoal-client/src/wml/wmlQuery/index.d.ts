import { NormalForm, ComponentRenderItem } from '../normalize';
import { Matcher } from 'ohm-js'

declare class WMLQueryResult {
    constructor(WMLQuery, { search: string, extendsResult: WMLQueryResult });
    clone: () => WMLQueryResult;
    extend: () => WMLQueryResult;
    nodes: () => any[];
    children: () => WMLQueryResult;
    prepend: (source: string) => WMLQueryResult;
    addElement: (source: string, options: { position: 'before' | 'after' }) => WMLQueryResult;
    remove: () => WMLQueryResult;
    source: string;
    contents: (value?: string) => WMLQueryResult;
    contents: () => string;
    prop: (key: string, value: string | boolean, options?: { type: 'literal' | 'expression' | 'boolean'; }) => WMLQueryResult;
    prop: (key: string) => string;
    render: (value: ComponentRenderItem[]) => WMLQueryResult;
    render: () => ComponentRenderItem[];
    removeProp: (key: string) => WMLQueryResult;
    not: (search: string) => WMLQueryResult;
    add: (search: string) => WMLQueryResult;
    filter: (search: string) => WMLQueryResult;
    prettyPrint: () => WMLQueryResult;
}

export interface WMLQueryUpdateReplace {
    type: 'replace';
    startIdx: number;
    endIdx: number;
    text: string;
    wmlQuery: WMLQuery;
}

export interface WMLQueryUpdateSet {
    type: 'set';
    text: string;
    wmlQuery: WMLQuery;
}

export type WMLQueryUpdate = WMLQueryUpdateReplace | WMLQueryUpdateSet

type WMLQueryOptions = {
    onChange?: (update: WMLQueryUpdate) => void;
}

export class WMLQuery {
    constructor(string, options?: WMLQueryOptions);
    clone: () => WMLQuery;
    matcher: Matcher;
    source: string;
    setInput: (string) => void;
    normalize: () => NormalForm;
    replaceInputRange: (startIdx: number, endIdx: number, str: string) => void;
    search: (string) => WMLQueryResult;
    prettyPrint: () => WMLQuery;
}
