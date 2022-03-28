import { NormalForm, RoomRenderItem } from '../normalize';
import { Matcher } from 'ohm-js'

declare class WMLQueryResult {
    constructor(WMLQuery, string);
    nodes: () => any[];
    children: () => WMLQueryResult;
    prepend: (source: string) => WMLQueryResult;
    remove: () => WMLQueryResult;
    source: string;
    contents: (value?: string) => WMLQueryResult;
    contents: () => string;
    prop: (key: string, value: string) => WMLQueryResult;
    prop: (key: string) => string;
    render: (value: RoomRenderItem[]) => WMLQueryResult;
    render: () => RoomRenderItem[];
    removeProp: (key: string) => WMLQueryResult;
    not: (search: string) => WMLQueryResult;
    add: (search: string) => WMLQueryResult;
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
    matcher: Matcher;
    source: string;
    setInput: (string) => void;
    normalize: () => NormalForm;
    replaceInputRange: (startIdx: number, endIdx: number, str: string) => void;
    search: (string) => WMLQueryResult;
}
