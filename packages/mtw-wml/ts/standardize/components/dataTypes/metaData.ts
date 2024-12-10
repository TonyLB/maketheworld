import { StandardRemoveData, StandardReplaceData } from "."
import { SchemaExitTag, SchemaImportableBase, SchemaImportTag, SchemaTag } from "../../../schema/baseClasses"
//
// TODO: Resolve circular file dependency when you deprecate StandardImportItemData
//
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

export type StandardComponentImportPayload = {
    assetId: string;
    fromKey: string;
}

export type StandardComponentImportContent = {
    action: 'Content';
    payload: StandardComponentImportPayload;
}

export type StandardComponentImportRemove = {
    action: 'Remove';
    match: StandardComponentImportPayload;
}

export type StandardComponentImportReplace = {
    action: 'Replace';
    match: StandardComponentImportPayload;
    payload: StandardComponentImportPayload
}

export type StandardComponentImport = StandardComponentImportContent | StandardComponentImportRemove | StandardComponentImportReplace

export type StandardComponentExportContent = {
    action: 'Content';
    payload: string;
}

export type StandardComponentExportRemove = {
    action: 'Remove';
    match: string;
}

export type StandardComponentExportReplace = {
    action: 'Replace';
    match: string;
    payload: string;
}

export type StandardComponentExport = StandardComponentExportContent | StandardComponentExportRemove | StandardComponentExportReplace
