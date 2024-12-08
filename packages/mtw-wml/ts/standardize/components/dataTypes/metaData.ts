import { StandardRemoveData, StandardReplaceData } from ".";
import { deepEqual } from "../../../lib/objects";
import { SchemaExitTag, SchemaImportableBase, SchemaImportTag, SchemaTag } from "../../../schema/baseClasses"
import { MergeConflictError } from "../../baseClasses";
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

export const mergeStandardComponentImport = (a: StandardComponentImport, b: StandardComponentImport): StandardComponentImport | undefined => {
    if (a.action === 'Remove') {
        if (b.action === 'Content') {
            return {
                action: 'Replace',
                match: a.match,
                payload: b.payload
            }
        }
        throw new MergeConflictError()
    }
    if (a.action === 'Replace') {
        if (b.action === 'Remove') {
            if (deepEqual(a.payload, b.match)) {
                return {
                    action: 'Remove',
                    match: a.match
                }
            }
            throw new MergeConflictError()
        }
        if (b.action === 'Replace') {
            if (deepEqual(a.payload, b.match)) {
                return {
                    action: 'Replace',
                    match: a.match,
                    payload: b.payload
                }
            }
            throw new MergeConflictError()
        }
        const mergedPayload = mergeStandardComponentImport({ action: 'Content', payload: a.payload }, b)
        if (mergedPayload && mergedPayload.action === 'Content') {
            return {
                action: 'Replace',
                match: a.match,
                payload: mergedPayload.payload
            }
        }
        throw new MergeConflictError()
    }
    if (b.action === 'Remove') {
        if (deepEqual(a.payload, b.match)) {
            return undefined
        }
        throw new MergeConflictError()
    }
    if (b.action === 'Replace') {
        if (deepEqual(a.payload, b.match)) {
            return {
                action: 'Content',
                payload: b.payload
            }
        }
        throw new MergeConflictError()
    }
    if (deepEqual(a.payload, b.payload)) {
        return a
    }
    console.log(`a: ${JSON.stringify(a, null, 4)}`)
    console.log(`b: ${JSON.stringify(b, null, 4)}`)
    throw new MergeConflictError()
}

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

export const mergeStandardComponentExport = (a: StandardComponentExport, b: StandardComponentExport): StandardComponentExport | undefined => {
    if (a.action === 'Remove') {
        if (b.action === 'Content') {
            return {
                action: 'Replace',
                match: a.match,
                payload: b.payload
            }
        }
        throw new MergeConflictError()
    }
    if (a.action === 'Replace') {
        if (b.action === 'Remove') {
            if (deepEqual(a.payload, b.match)) {
                return {
                    action: 'Remove',
                    match: a.match
                }
            }
            throw new MergeConflictError()
        }
        if (b.action === 'Replace') {
            if (deepEqual(a.payload, b.match)) {
                return {
                    action: 'Replace',
                    match: a.match,
                    payload: b.payload
                }
            }
            throw new MergeConflictError()
        }
        const mergedPayload = mergeStandardComponentExport({ action: 'Content', payload: a.payload }, b)
        if (mergedPayload && mergedPayload.action === 'Content') {
            return {
                action: 'Replace',
                match: a.match,
                payload: mergedPayload.payload
            }
        }
        throw new MergeConflictError()
    }
    if (b.action === 'Remove') {
        if (deepEqual(a.payload, b.match)) {
            return undefined
        }
        throw new MergeConflictError()
    }
    if (b.action === 'Replace') {
        if (deepEqual(a.payload, b.match)) {
            return {
                action: 'Content',
                payload: b.payload
            }
        }
        throw new MergeConflictError()
    }
    if (deepEqual(a.payload, b.payload)) {
        return a
    }
    throw new MergeConflictError()
}