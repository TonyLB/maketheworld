import { StandardBaseData } from "./abstract"

export type StandardVariableData = {
    tag: 'Variable';
    default: string;
} & StandardBaseData
