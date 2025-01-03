import { SchemaBase } from "./baseClasses";

type SchemaAssetBase = {
    key: string;
    fileName?: string;
    zone?: string;
    subFolder?: string;
    player?: string;
} & SchemaBase

export type SchemaAssetTag = {
    tag: 'Asset';
    Story: undefined;
    update?: boolean;
} & SchemaAssetBase

export type SchemaStoryTag = {
    tag: 'Story';
    Story: true;
    instance: boolean;
} & SchemaAssetBase
