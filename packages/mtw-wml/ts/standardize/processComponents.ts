import { unique } from "../list"
import {
    isImportable,
    isSchemaCondition,
    isSchemaConditionStatement,
    isSchemaConditionFallthrough,
    isSchemaImport,
    SchemaTag,
    SchemaWithKey,
    isSchemaWithKey,
    isSchemaAsset,
    SchemaAssetTag,
    SchemaStoryTag,
    isSchemaExport
} from "../schema/baseClasses"
import applyEdits from "../schema/treeManipulation/applyEdits"
import { TagListItem, TagTreeMatchOperation } from "../tagTree"
import SchemaTagTree from "../tagTree/schema"
import { GenericTree, treeNodeTypeguard } from "../tree/baseClasses"
import { standardComponentFactory } from "./componentFactory"
import { StandardComponent } from "./components/component"
import { StandardExportItem, StandardImportItem } from "./components/metaData"

export type ComponentProcessingTemplate = {
    key: SchemaWithKey["tag"];
    legalParents?: SchemaWithKey["tag"];
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

type ConditionalContextItem = {
    previousStatementConditions: string[];
} & ({
    condition: string;
    fallthrough: false;
} | {
    fallthrough: true;
})

//
// mergeByIds takes two byId objects and merges them together, using the merge method of the StandardComponent class.
//
const mergeByIds = (byId: Record<string, StandardComponent>, newById: Record<string, StandardComponent>): Record<string, StandardComponent> => {
    return Object.entries(newById).reduce((previous, [key, value]) => {
        const base = previous[key]
        if (base) {
            const merged = base.merge(value)
            if (merged) {
                const mergedImport = base.import && value.import ? base.import.merge(value.import) : base.import ?? value.import
                const mergedExport = base.export && value.export ? base.export.merge(value.export) : base.export ?? value.export
                return { ...previous, [key]: merged.withImport(mergedImport).withExport(mergedExport) }
            }
            else {
                const { [key]: _, ...rest } = previous
                return rest
            }
        }
        else {
            return { ...previous, [key]: value }
        }
    }, byId)
}

//
// processComponents takes a list of component templates and a tag tree, and extracts the standard byId object.
//
export const processComponents = (props: {
    componentTemplates: ComponentProcessingTemplate[];
    tagTree: SchemaTagTree;
    schema: GenericTree<SchemaTag>;
    importItemById: Record<string, StandardImportItem>;
    exportItemById: Record<string, StandardExportItem>;
    conditionalContext?: ConditionalContextItem[];
    componentContext?: { key: string; tag: SchemaWithKey["tag"]; }[];
    inContextOfRemove?: boolean;
    metaDataContext?: 'Import' | 'Export';
}): Record<string, StandardComponent> => {
    //
    // Loop through each tag in standard order
    //
    let byId: Record<string, StandardComponent> = {}
    const {
        componentTemplates,
        tagTree,
        schema,
        importItemById,
        exportItemById,
        conditionalContext = [],
        componentContext = [],
        inContextOfRemove = false,
        metaDataContext
    } = props

    const recursiveById = schema.reduce<Record<string, StandardComponent>>((previous, item) => {
        //
        // If the item is an import, set metaDataContext to 'Import'
        //
        if (treeNodeTypeguard(isSchemaImport)(item)) {
            return mergeByIds(previous, processComponents({ ...props, schema: item.children, metaDataContext: 'Import' }))
        }
        //
        // If the item is an export, set metaDataContext to 'Export'
        //
        if (treeNodeTypeguard(isSchemaExport)(item)) {
            return mergeByIds(previous, processComponents({ ...props, schema: item.children, metaDataContext: 'Export' }))
        }

        //
        // If the item is a condition, process each sub-statement with the condition added to the context.
        //
        if (treeNodeTypeguard(isSchemaCondition)(item)) {
            const { accumulatedById } = item.children.reduce<{ accumulatedById: Record<string, StandardComponent>; contextItem?: ConditionalContextItem; }>(({ accumulatedById, contextItem }, item) => {
                if (contextItem?.fallthrough) {
                    throw new Error('A statement or fallthrough occurring after a fallthrough node is an error.')
                }
                if (treeNodeTypeguard(isSchemaConditionStatement)(item)) {
                    const { if: condition } = item.data
                    const newContextItem: ConditionalContextItem = { condition, fallthrough: false, previousStatementConditions: contextItem ? [...contextItem.previousStatementConditions, contextItem.condition] : [] }
                    return {
                        accumulatedById: mergeByIds(accumulatedById, processComponents({ ...props, schema: item.children, conditionalContext: [...conditionalContext, newContextItem] })),
                        contextItem: newContextItem
                    }
                }
                if (treeNodeTypeguard(isSchemaConditionFallthrough)(item)) {
                    if (contextItem?.fallthrough) {
                        throw new Error('A statement or fallthrough occurring after a fallthrough node is an error.')
                    }
                    const newContextItem: ConditionalContextItem = { fallthrough: true, previousStatementConditions: contextItem ? [...contextItem.previousStatementConditions, contextItem.condition] : [] }
                    return {
                        accumulatedById: mergeByIds(accumulatedById, processComponents({ ...props, schema: item.children, conditionalContext: [...conditionalContext, newContextItem] })),
                        contextItem: newContextItem
                    }
                }
                return { accumulatedById, contextItem }
            }, { accumulatedById: previous })
            return accumulatedById
        }
        if (treeNodeTypeguard(isSchemaWithKey)(item)) {
            const template = componentTemplates.find(({ key }) => (key === item.data.tag))
            if (template) {
                const dynamicRename: string = (metaDataContext !== 'Import' || treeNodeTypeguard(isSchemaAsset)(item)) ? item.data.key : (item.data as any).as ?? item.data.key
                const component = standardComponentFactory(item)
                    ?.withKey(dynamicRename)
                    ?.withImport(importItemById[dynamicRename])
                    ?.withExport(exportItemById[dynamicRename])
                //
                // Wrap the component contents in conditional statements as necessary
                //
                if (!component) {
                    return previous
                }
                const wrappedComponent = conditionalContext.reduceRight((previous, conditionItem) => {
                    return previous.mapContents((content): GenericTree<SchemaTag> => {
                        if (content.length) {
                            return [{
                                data: { tag: 'If' as const },
                                children: [
                                    ...conditionItem.previousStatementConditions.map((condition) => ({ data: { tag: 'Statement' as const, if: condition }, children: [] })),
                                    conditionItem.fallthrough
                                        ? { data: { tag: 'Fallthrough' as const }, children: content }
                                        : { data: { tag: 'Statement' as const, if: conditionItem.condition }, children: content }
                                ]
                            }]
                        }
                        else {
                            return []
                        }
                    })
                }, component)
                return mergeByIds(
                    mergeByIds(previous, { [component.key]: wrappedComponent }),
                    processComponents({ ...props, schema: item.children, componentContext: [...componentContext, { key: component.key, tag: item.data.tag }] })
                )
            }
        }
        return mergeByIds(previous, processComponents({ ...props, schema: item.children }))
    }, {})
    // const anyKeyedComponent: TagTreeMatchOperation<SchemaTag> = { or: componentTemplates.map(({ key }) => ({ match: key })) }
    // componentTemplates.forEach((processingTemplate) => {
    //     const { key: tag } = processingTemplate
    //     //
    //     // Loop through each key present for that tag
    //     //
    //     const keys = keysByComponentTypeFactory(tagTree)(tag)
    //     keys.forEach((key) => {
    //         //
    //         // Aggregate and reorder all top-level information
    //         //
    //         const nodeMatch: TagTreeMatchOperation<SchemaTag> = { match: ({ data }, stack) => (data.tag === tag && ('as' in data ? data.as === key : data.key === key)) }
    //         const nodeMatchImport: TagTreeMatchOperation<SchemaTag> = { match: ({ data }, stack) => (data.tag === tag && (((Boolean(stack.find(isSchemaImport)) && isImportable(data)) ? data.as ?? data.key : data.key) === key)) }
    //         const editTag: TagTreeMatchOperation<SchemaTag> = { or: [{ match: 'Replace' }, { match: 'Remove' }] }
    //         const adjustTagTree = (tagTree: SchemaTagTree, nodeMatch: TagTreeMatchOperation<SchemaTag>): SchemaTagTree => {
    //             const prunedTagTree = tagTree
    //                 .prune({ after: { sequence: [nodeMatch, anyKeyedComponent] } })
    //                 .reorderFunctional(
    //                     [{ match: tag }, { match: 'Replace'}, { match: 'ReplaceMatch' }, { match: 'ReplacePayload' }, { match: 'Remove' }, { match: 'Name' }, { match: 'ShortName' }, { match: 'Description' }, { match: 'Summary' }, { match: 'If' }, { match: 'Statement' }, { match: 'Fallthrough' }],
    //                     (tagItem) => {
    //                         const isEditTag = (value: TagListItem<SchemaTag, {}>): boolean => (['Replace', 'ReplaceMatch', 'ReplacePayload', 'Remove'].includes(value.data.tag))
    //                         const isConditionalTag = (value: TagListItem<SchemaTag, {}>): boolean => (['If', 'Statement', 'Fallthrough'].includes(value.data.tag))
    //                         const { componentTags, valueTags, conditionalTags } = tagItem.reduce<{ componentTags: TagListItem<SchemaTag>[]; valueTags: TagListItem<SchemaTag>[]; conditionalTags: TagListItem<SchemaTag>[]; matchedAlready: boolean }>((previous, subItem) => {
    //                             if (subItem.data.tag === tag) {
    //                                 return {
    //                                     ...previous,
    //                                     componentTags: [...previous.componentTags, subItem],
    //                                     matchedAlready: true
    //                                 }
    //                             }
    //                             if (isEditTag(subItem)) {
    //                                 if (previous.matchedAlready) {
    //                                     return {
    //                                         ...previous,
    //                                         valueTags: [...previous.valueTags, subItem]
    //                                     }
    //                                 }
    //                                 else {
    //                                     return {
    //                                         ...previous,
    //                                         componentTags: [...previous.componentTags, subItem]
    //                                     }
    //                                 }
    //                             }
    //                             if (isConditionalTag(subItem)) {
    //                                 return {
    //                                     ...previous,
    //                                     conditionalTags: [...previous.conditionalTags, subItem]
    //                                 }
    //                             }
    //                             else {
    //                                 return {
    //                                     ...previous,
    //                                     valueTags: [...previous.valueTags, subItem]
    //                                 }
    //                             }
    //                         }, { componentTags: [], valueTags: [], conditionalTags: [], matchedAlready: false })
    //                         const relativeOrder: Partial<Record<SchemaTag["tag"], number>> = {
    //                             Remove: 1,
    //                             Replace: 1,
    //                             ReplaceMatch: 2,
    //                             ReplacePayload: 2,
    //                             [tag]: 3,
    //                             Name: 4,
    //                             ShortName: 4,
    //                             Description: 4,
    //                             Summary: 4
    //                         }
    //                         const sortInPlace = (tags: TagListItem<SchemaTag>[]): TagListItem<SchemaTag>[] => (
    //                             [...tags].sort((a, b) => ((relativeOrder[a.data.tag] ?? Infinity) - (relativeOrder[b.data.tag] ?? Infinity)))
    //                         )
    //                         return [...sortInPlace(componentTags), ...sortInPlace(valueTags), ...conditionalTags]
    //                     }
    //                 )
    //                 .filter({ not: { sequence: [{ or: [ { match: 'Remove' }, { match: 'Replace' }] }, { or: [{ match: 'Import' }, { match: 'Export' }] }] }})
    //                 .prune({ and: [{ before: nodeMatch }, { not: { or: [editTag, { after: editTag }] }}] })
    //                 .prune({ or: [{ match: 'Import' }, { match: 'Export' }] })
    //             switch(tag) {
    //                 case 'Room':
    //                     return prunedTagTree.prune({ or: [{ match: 'Map' }, { match: 'Position' }]})
    //                 case 'Map':
    //                     return tagTree
    //                         .prune({ or: [{ and: [{ after: { sequence: [nodeMatch, anyKeyedComponent] } }, { not: { match: 'Position'} }] }, { match: 'Import' }, { match: 'Export' }] })
    //                         .reordered([{ match: tag }, { or: [{ match: 'Name' }, { match: 'Description' }] }, { or: [{ match: 'Room' }, { connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] } ]}])
    //                         .filter({ or: [{ and: [{ match: 'Room' }, { or: [{ match: 'Position' }, { match: 'Exit' }]}]}, { not: { match: 'Room' }}]})
    //                         .prune({ before: nodeMatch })
    //             }
    //             return prunedTagTree
    //         }

    //         const filteredTagTree = adjustTagTree(tagTree.filter({ and: [nodeMatch, { not: { match: 'Import' } }] }), nodeMatch)
    //         const importedTagTree = adjustTagTree(tagTree.filter({ and: [nodeMatchImport, { match: 'Import' }] }), nodeMatchImport)

    //         const adjustedTree = [
    //             ...(applyEdits(adjustTagTree(importedTagTree, nodeMatch).tree)
    //                 .map((item) => (
    //                     (treeNodeTypeguard(isImportable)(item) && item.data.as)
    //                         ? { ...item, data: { ...item.data, key: item.data.as } }
    //                         : item
    //                 ))),
    //             ...applyEdits(adjustTagTree(filteredTagTree, nodeMatch).tree)
    //         ]
    //         adjustedTree.forEach((item) => {
    //             const standardItem = standardComponentFactory(item)
    //             if (standardItem) {
    //                 const base = byId[standardItem.key]
    //                 if (base) {
    //                     const merged = base.merge(standardItem as any)
    //                     if (merged) {
    //                         const mergedImport = base.import && standardItem.import ? base.import.merge(standardItem.import) : base.import ?? standardItem.import
    //                         const mergedExport = base.export && standardItem.export ? base.export.merge(standardItem.export) : base.export ?? standardItem.export
    //                         byId[standardItem.key] = merged.withImport(mergedImport).withExport(mergedExport)
    //                     }
    //                     else {
    //                         delete byId[standardItem.key]
    //                     }
    //                 }
    //                 else {
    //                     byId[standardItem.key] = standardItem.withImport(importItemById[standardItem.key]).withExport(exportItemById[standardItem.key])
    //                 }
    //             }
    //         })
    //     })
    // })

    return recursiveById
}

export default processComponents