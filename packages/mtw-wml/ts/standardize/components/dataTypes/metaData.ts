import { StandardRemoveData, StandardReplaceData } from ".";
import { SchemaExitTag, SchemaImportableBase, SchemaImportTag, SchemaTag } from "../../../schema/baseClasses"
import { StandardBaseData } from "./abstract"

export type StandardImportItemData = {
    key: string;
    asKey?: string;
    tag: Exclude<Extract<SchemaTag, SchemaImportableBase>, SchemaExitTag | SchemaImportTag>["tag"];
}

export type StandardImportData = {
    tag: 'Import';
    imports: Record<string, StandardImportItemData | StandardRemoveData<StandardImportItemData> | StandardReplaceData<StandardImportItemData>>;
} & StandardBaseData
