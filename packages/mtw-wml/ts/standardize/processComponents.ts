import { objectMerge } from "../lib/objects"
import { unique } from "../list"
import SchemaTagTree from "../tagTree/schema"
import { GenericTree, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { standardComponentFactory } from "./componentFactory"
import { StandardComponent } from "./components/component"
import { ExportItemContent, ExportItemRemove, ImportItemContent, ImportItemRemove, StandardExportItem, StandardImportItem } from "./components/metaData"
import { mergeWithEdits, StandardRemove, StandardReplace } from "./edits"
import { isImportable, isSchemaAsset, isSchemaComponent, isSchemaWithKey, SchemaTag, SchemaWithKey } from "@tonylb/mtw-base/ts/schema"
import { isSchemaExport, isSchemaImport } from "@tonylb/mtw-base/ts/schema/metaData"
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload } from "@tonylb/mtw-base/ts/schema/edit"
import { isSchemaCondition, isSchemaConditionFallthrough, isSchemaConditionStatement } from "@tonylb/mtw-base/ts/schema/condition"
import { ComponentTag } from "./components/dataTypes/abstract"

export type ComponentProcessingTemplate = {
    key: ComponentTag;
    legalParents?: ComponentTag[];
}

const keysByComponentTypeFactory = (tagTree: SchemaTagTree) => (tag: ComponentTag) => {
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
            const merged = mergeWithEdits(base, value)
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
    schema: GenericTree<SchemaTag>;
    conditionalContext?: ConditionalContextItem[];
    componentContext?: { key: string; tag: ComponentTag; }[];
    inContextOfRemove?: boolean;
    metaDataContext?: { type: 'Import', from: string } | { type: 'Export' };
}): Record<string, StandardComponent> => {
    //
    // Loop through each tag in standard order
    //
    const {
        componentTemplates,
        schema,
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
            return mergeByIds(previous, processComponents({ ...props, schema: item.children, metaDataContext: { type: 'Import', from: item.data.from } }))
        }
        //
        // If the item is an export, set metaDataContext to 'Export'
        //
        if (treeNodeTypeguard(isSchemaExport)(item)) {
            return mergeByIds(previous, processComponents({ ...props, schema: item.children, metaDataContext: { type: 'Export' } }))
        }

        //
        // If the item is a remove, set inContextOfRemove to true
        //
        if (treeNodeTypeguard(isSchemaRemove)(item)) {
            return mergeByIds(previous, processComponents({ ...props, schema: item.children, inContextOfRemove: true }))
        }

        //
        // If the item is a replace, manually create byId entries for the ReplaceMatch and ReplacePayload entries,
        // then use objectMerge to generate a key-by-key comparison of the two:
        //    - If the key is present in both, merge a StandardReplace entry
        //    - If the key is present only in the ReplaceMatch, merge a StandardRemove entry
        //    - If the key is present only in the ReplacePayload, merge the StandardComponent entry
        //
        if (treeNodeTypeguard(isSchemaReplace)(item)) {
            const replaceMatch = item.children.find(treeNodeTypeguard(isSchemaReplaceMatch))
            const replacePayload = item.children.find(treeNodeTypeguard(isSchemaReplacePayload))
            if (replaceMatch && replacePayload) {
                const matchById = processComponents({ ...props, schema: replaceMatch.children })
                const payloadById = processComponents({ ...props, schema: replacePayload.children })
                const mergedById = objectMerge(matchById, payloadById)
                const replaceById = Object.entries(mergedById).reduce<Record<string, StandardComponent>>((previous, [key, { itemA: matchComponent, itemB: payloadComponent }]) => {
                    if (matchComponent && payloadComponent) {
                        return { ...previous, [key]: new StandardReplace(matchComponent, payloadComponent) }
                    }
                    if (matchComponent) {
                        return { ...previous, [key]: new StandardRemove(matchComponent) }
                    }
                    if (payloadComponent) {
                        return { ...previous, [key]: payloadComponent }
                    }
                    return previous
                }, {})
                return mergeByIds(previous, replaceById)
            }
            throw new Error('Replace must have both a ReplaceMatch and a ReplacePayload')
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
        if (treeNodeTypeguard(isSchemaComponent)(item)) {
            const template = componentTemplates.find(({ key }) => (key === item.data.tag))
            if (template) {
                //
                // Decode the key and import/export fields for the component
                //
                const dynamicRename: string = (!(metaDataContext?.type === 'Import') || treeNodeTypeguard(isSchemaAsset)(item)) ? item.data.key : (item.data as any).as ?? item.data.key
                const exportRename: string = (metaDataContext?.type === 'Export' || treeNodeTypeguard(isSchemaAsset)(item)) ? (item.data as any).as ?? item.data.key : item.data.key
                const temp = standardComponentFactory(item)
                const component = metaDataContext
                    ? metaDataContext.type === 'Import'
                        ? inContextOfRemove
                            ? temp?.withKey(dynamicRename)?.withImport(new ImportItemRemove(metaDataContext.from, item.data.key))
                            : temp?.withKey(dynamicRename)?.withImport(new ImportItemContent(metaDataContext.from, item.data.key))
                        : inContextOfRemove
                            ? temp?.withExport(new ExportItemRemove(exportRename))
                            : temp?.withExport(new ExportItemContent(exportRename))
                    : temp

                //
                // If the template has legalParents, extract the nearest legal parent tags from the componentContext
                //
                const legalParentTags = template.legalParents ?? []
                const ancestorTags = componentContext.filter(({ tag }) => (legalParentTags.includes(tag)))
                const parentTag = ancestorTags.slice(-1)[0]

                if (!component) {
                    return previous
                }

                //
                // Localize the key for the component if it is not global, and has a parent tag
                //
                const localizedComponent = (parentTag && !component.global) ? component.withKey(`${parentTag.key}.${component.key}`) : component

                //
                // Wrap the component contents in conditional statements as necessary
                //
                const conditionalWrappedComponent = conditionalContext.reduceRight((previous, conditionItem) => {
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
                }, localizedComponent)
                const editWrappedComponent = (!metaDataContext && inContextOfRemove) ? new StandardRemove(conditionalWrappedComponent) : conditionalWrappedComponent
                return mergeByIds(
                    mergeByIds(previous, { [component.key]: editWrappedComponent }),
                    processComponents({ ...props, metaDataContext: undefined, schema: item.children, componentContext: [...componentContext, { key: component.key, tag: item.data.tag }] })
                )
            }
        }
        return mergeByIds(previous, processComponents({ ...props, schema: item.children }))
    }, {})

    return recursiveById
}

export default processComponents