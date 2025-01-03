import { SchemaImportableBase } from "./baseClasses";

export type SchemaImageTag = {
    tag: 'Image';
    key: string;
    fileURL?: string;
} & SchemaImportableBase
