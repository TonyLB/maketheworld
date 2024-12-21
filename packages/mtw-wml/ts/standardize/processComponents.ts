import { unique } from "../list";
import { isImportable, isSchemaImport, SchemaTag, SchemaWithKey } from "../schema/baseClasses"
import applyEdits from "../schema/treeManipulation/applyEdits";
import { TagListItem, TagTreeMatchOperation } from "../tagTree";
import SchemaTagTree from "../tagTree/schema";
import { treeNodeTypeguard } from "../tree/baseClasses";
import { standardComponentFactory } from "./componentFactory";
import { StandardComponent } from "./components/component";
import { StandardExportItem, StandardImportItem } from "./components/metaData";
import importExportFromTree from "./importExportFromTree";

export type ComponentProcessingTemplate = {
    key: SchemaWithKey["tag"];
}

const keysByComponentTypeFactory = (tagTree: SchemaTagTree) => (tag: SchemaWithKey["tag"]) => {
    const keysExtract = (imported: boolean) => (
        tagTree
            .filter({ and: [{ match: tag }, imported ? { match: 'Import' } : { not: { match: 'Import' } }] })
            .prune({ after: { match: tag } })
            .prune({ before: { match: tag } })
            .tree
            .map(({ data }) => {
                if (data.tag !== tag) {
                    throw new Error('standardizeSchema tag mismatch')
                }
                if (imported && isImportable(data)) {
                    return data.as ?? data.key
                }
                return data.key
            })
    )
    return unique(keysExtract(true), keysExtract(false)).sort()
}

//
// processComponents takes a list of component templates and a tag tree, and extracts the standard byId object.
// NOTE: This function is not pure. It side-effects the byId object, rather than returning a new object functionally.
//
export const processComponents = (props: {
    componentTemplates: ComponentProcessingTemplate[];
    tagTree: SchemaTagTree;
    byId: Record<string, StandardComponent>;
    importItemById: Record<string, StandardImportItem>;
    exportItemById: Record<string, StandardExportItem>;
}): void => {
    //
    // Loop through each tag in standard order
    //
    const { componentTemplates, tagTree, byId, importItemById, exportItemById } = props

    const anyKeyedComponent: TagTreeMatchOperation<SchemaTag> = { or: componentTemplates.map(({ key }) => ({ match: key })) }
    componentTemplates.forEach((processingTemplate) => {
        const { key: tag } = processingTemplate
        //
        // Loop through each key present for that tag
        //
        const keys = keysByComponentTypeFactory(tagTree)(tag)
        keys.forEach((key) => {
            //
            // Aggregate and reorder all top-level information
            //
            const nodeMatch: TagTreeMatchOperation<SchemaTag> = { match: ({ data }, stack) => (data.tag === tag && ('as' in data ? data.as === key : data.key === key)) }
            const nodeMatchImport: TagTreeMatchOperation<SchemaTag> = { match: ({ data }, stack) => (data.tag === tag && (((Boolean(stack.find(isSchemaImport)) && isImportable(data)) ? data.as ?? data.key : data.key) === key)) }
            const editTag: TagTreeMatchOperation<SchemaTag> = { or: [{ match: 'Replace' }, { match: 'Remove' }] }
            const adjustTagTree = (tagTree: SchemaTagTree, nodeMatch: TagTreeMatchOperation<SchemaTag>): SchemaTagTree => {
                const prunedTagTree = tagTree
                    .prune({ after: { sequence: [nodeMatch, anyKeyedComponent] } })
                    .reorderFunctional(
                        [{ match: tag }, { match: 'Replace'}, { match: 'ReplaceMatch' }, { match: 'ReplacePayload' }, { match: 'Remove' }, { match: 'Name' }, { match: 'ShortName' }, { match: 'Description' }, { match: 'Summary' }, { match: 'If' }, { match: 'Statement' }, { match: 'Fallthrough' }],
                        (tagItem) => {
                            const isEditTag = (value: TagListItem<SchemaTag, {}>): boolean => (['Replace', 'ReplaceMatch', 'ReplacePayload', 'Remove'].includes(value.data.tag))
                            const isConditionalTag = (value: TagListItem<SchemaTag, {}>): boolean => (['If', 'Statement', 'Fallthrough'].includes(value.data.tag))
                            const { componentTags, valueTags, conditionalTags } = tagItem.reduce<{ componentTags: TagListItem<SchemaTag>[]; valueTags: TagListItem<SchemaTag>[]; conditionalTags: TagListItem<SchemaTag>[]; matchedAlready: boolean }>((previous, subItem) => {
                                if (subItem.data.tag === tag) {
                                    return {
                                        ...previous,
                                        componentTags: [...previous.componentTags, subItem],
                                        matchedAlready: true
                                    }
                                }
                                if (isEditTag(subItem)) {
                                    if (previous.matchedAlready) {
                                        return {
                                            ...previous,
                                            valueTags: [...previous.valueTags, subItem]
                                        }
                                    }
                                    else {
                                        return {
                                            ...previous,
                                            componentTags: [...previous.componentTags, subItem]
                                        }
                                    }
                                }
                                if (isConditionalTag(subItem)) {
                                    return {
                                        ...previous,
                                        conditionalTags: [...previous.conditionalTags, subItem]
                                    }
                                }
                                else {
                                    return {
                                        ...previous,
                                        valueTags: [...previous.valueTags, subItem]
                                    }
                                }
                            }, { componentTags: [], valueTags: [], conditionalTags: [], matchedAlready: false })
                            const relativeOrder: Partial<Record<SchemaTag["tag"], number>> = {
                                Remove: 1,
                                Replace: 1,
                                ReplaceMatch: 2,
                                ReplacePayload: 2,
                                [tag]: 3,
                                Name: 4,
                                ShortName: 4,
                                Description: 4,
                                Summary: 4
                            }
                            const sortInPlace = (tags: TagListItem<SchemaTag>[]): TagListItem<SchemaTag>[] => (
                                [...tags].sort((a, b) => ((relativeOrder[a.data.tag] ?? Infinity) - (relativeOrder[b.data.tag] ?? Infinity)))
                            )
                            return [...sortInPlace(componentTags), ...sortInPlace(valueTags), ...conditionalTags]
                        }
                    )
                    .filter({ not: { sequence: [{ or: [ { match: 'Remove' }, { match: 'Replace' }] }, { or: [{ match: 'Import' }, { match: 'Export' }] }] }})
                    .prune({ and: [{ before: nodeMatch }, { not: { or: [editTag, { after: editTag }] }}] })
                    .prune({ or: [{ match: 'Import' }, { match: 'Export' }] })
                switch(tag) {
                    case 'Room':
                        return prunedTagTree.prune({ or: [{ match: 'Map' }, { match: 'Position' }]})
                    case 'Map':
                        return tagTree
                            .prune({ or: [{ and: [{ after: { sequence: [nodeMatch, anyKeyedComponent] } }, { not: { match: 'Position'} }] }, { match: 'Import' }, { match: 'Export' }] })
                            .reordered([{ match: tag }, { or: [{ match: 'Name' }, { match: 'Description' }] }, { or: [{ match: 'Room' }, { connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] } ]}])
                            .filter({ or: [{ and: [{ match: 'Room' }, { or: [{ match: 'Position' }, { match: 'Exit' }]}]}, { not: { match: 'Room' }}]})
                            .prune({ before: nodeMatch })
                }
                return prunedTagTree
            }

            const filteredTagTree = adjustTagTree(tagTree.filter({ and: [nodeMatch, { not: { match: 'Import' } }] }), nodeMatch)
            const importedTagTree = adjustTagTree(tagTree.filter({ and: [nodeMatchImport, { match: 'Import' }] }), nodeMatchImport)

            const adjustedTree = [
                ...(applyEdits(adjustTagTree(importedTagTree, nodeMatch).tree)
                    .map((item) => (
                        (treeNodeTypeguard(isImportable)(item) && item.data.as)
                            ? { ...item, data: { ...item.data, key: item.data.as } }
                            : item
                    ))),
                ...applyEdits(adjustTagTree(filteredTagTree, nodeMatch).tree)
            ]
            adjustedTree.forEach((item) => {
                const standardItem = standardComponentFactory(item)
                if (standardItem) {
                    const base = byId[standardItem.key]
                    if (base) {
                        const merged = base.merge(standardItem as any)
                        if (merged) {
                            const mergedImport = base.import && standardItem.import ? base.import.merge(standardItem.import) : base.import ?? standardItem.import
                            const mergedExport = base.export && standardItem.export ? base.export.merge(standardItem.export) : base.export ?? standardItem.export
                            byId[standardItem.key] = merged.withImport(mergedImport).withExport(mergedExport)
                        }
                        else {
                            delete byId[standardItem.key]
                        }
                    }
                    else {
                        byId[standardItem.key] = standardItem.withImport(importItemById[standardItem.key]).withExport(exportItemById[standardItem.key])
                    }
                }
            })
        })
    })
}

export default processComponents