import { SchemaExitTag, SchemaImportableBase, SchemaImportTag, SchemaTag } from "../../../schema/baseClasses"
import { StandardBaseData } from "./abstract"

export type StandardImportItemData = {
    fromKey: string;
    asKey?: string;
    tag: Exclude<Extract<SchemaTag, SchemaImportableBase>, SchemaExitTag | SchemaImportTag>["tag"];
    remove?: boolean;
    match?: StandardImportItemData;
}

export type StandardImportData = {
    tag: 'Import';
    imports: Record<string, StandardImportItemData>;
} & StandardBaseData
