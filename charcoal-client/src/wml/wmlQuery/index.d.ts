import { NormalForm, RoomRenderItem } from '../normalize';
import { Matcher } from 'ohm-js'

declare class WMLQueryResult {
    constructor(WMLQuery, string);
    nodes: () => any[];
    source: string;
    contents: (value?: string) => WMLQuery;
    contents: () => string;
    prop: (key: string, value: string) => WMLQuery;
    prop: (key: string) => string;
    render: (value: RoomRenderItem[]) => WMLQuery;
    render: () => RoomRenderItem[];
    removeProp: (key: string) => WMLQuery;
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
