import { excludeUndefined } from "../lib/lists"
import { objectFilterEntries } from "../lib/objects"
import { unwrapSubject, wrappedNodeTypeGuard } from "../schema/utils"
import { GenericTree, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { ImportItemContent, ImportItemRemove, ImportItemReplace, StandardImportItem } from "./components/metaData"
import { isImportable, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaImport } from "@tonylb/mtw-base/ts/schema/metaData"
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload } from "@tonylb/mtw-base/ts/schema/edit"

//
// Utility function to create exportItemById and importItemById objects, then use them to inform the
// creation of StandardForm byId
//
export const importExportFromTree = (tree: GenericTree<SchemaTag>): { importItemById: Record<string, StandardImportItem> } => {
    const mergeImportIntoEntries = (previous: Record<string, StandardImportItem>, incoming: Record<string, StandardImportItem>): Record<string, StandardImportItem> => {
        const [[key, incomingItem]] = Object.entries(incoming)
        const baseItem = previous[key]
        const mergedItem = baseItem ? baseItem.merge(incomingItem) : incomingItem
        if (mergedItem) {
            return {
                ...previous,
                [key]: mergedItem
            }
        }
        else {
            return objectFilterEntries(previous, ([checkKey]) => (checkKey !== key))
        }
    }
    const importItemById = tree.filter(wrappedNodeTypeGuard(isSchemaImport))
        .reduce<Record<string, StandardImportItem>>((previous, node) => {
            if (treeNodeTypeguard(isSchemaRemove)(node)) {
                const child = node.children[0]
                if (child && treeNodeTypeguard(isSchemaImport)(child)) {
                    return child.children
                        .map(unwrapSubject)
                        .filter(excludeUndefined)
                        .map(({ data }) => (data))
                        .filter(isImportable)
                        .map(({ key, as }) => ({ [as ?? key ?? '']: new ImportItemRemove(child.data.from, key ?? '') }))
                        .reduce<Record<string, StandardImportItem>>(mergeImportIntoEntries, previous)
                }
            }
            if (treeNodeTypeguard(isSchemaReplace)(node)) {
                throw new Error('Top-level replace of Export tags not yet implemented')
            }
            if (treeNodeTypeguard(isSchemaImport)(node)) {
                const removeActions: Record<string, StandardImportItem>[] = node.children
                    .filter(treeNodeTypeguard(isSchemaRemove))
                    .map(unwrapSubject)
                    .filter(excludeUndefined)
                    .map(({ data }) => (data))
                    .filter(isImportable)
                    .map(({ key, as }) => ({ [as ?? key ?? '']: new ImportItemRemove(node.data.from, key ?? '') }))
                const replaceActions = node.children
                    .filter(treeNodeTypeguard(isSchemaReplace))
                    .map(({ children }) => ({
                        match: children.find(treeNodeTypeguard(isSchemaReplaceMatch))?.children?.[0],
                        payload: children.find(treeNodeTypeguard(isSchemaReplacePayload))?.children?.[0]
                    }))
                    .map(({ match, payload }) => (
                        (match && treeNodeTypeguard(isImportable)(match) && payload && treeNodeTypeguard(isImportable)(payload))
                            ? [{ [match.data.as ?? match.data.key ?? '']: new ImportItemReplace(
                                { assetId: node.data.from, fromKey: match.data.key ?? '' },
                                { assetId: node.data.from, fromKey: payload.data.key ?? '' }
                            ) }]
                            : []
                    ))
                    .flat(1)
                const contentActions = node.children
                    .filter(treeNodeTypeguard(isImportable))
                    .map(({ data }) => (data))
                    .map(({ key, as }) => ({ [as ?? key ?? '']: new ImportItemContent(node.data.from, key ?? '') }))
                return contentActions.reduce(
                    mergeImportIntoEntries,
                    replaceActions.reduce(
                        mergeImportIntoEntries,
                        removeActions.reduce(
                            mergeImportIntoEntries,
                            previous
                        )
                    )
                )
            }
            return previous
        }, {})
    return { importItemById }
}

export default importExportFromTree
