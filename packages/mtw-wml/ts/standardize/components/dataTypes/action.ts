import { StandardBaseData } from "./abstract"

export type StandardActionData = {
    tag: 'Action';
    src: string;
} & StandardBaseData
