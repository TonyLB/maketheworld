import { StandardBaseData } from "./abstract"

export type StandardComputedData = {
    tag: 'Computed';
    src: string;
    dependencies?: string[];
} & StandardBaseData
