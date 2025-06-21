import { GenericTree, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { standardComponentFactory } from "./componentFactory"
import { StandardComponent } from "./components/baseClasses"
import { StandardRemove, StandardReplace } from "./components/edits"
import { isSchemaAsset, isSchemaComponent, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaImport } from "@tonylb/mtw-base/ts/schema/metaData"
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload } from "@tonylb/mtw-base/ts/schema/edit"
import { isSchemaCondition, isSchemaConditionFallthrough, isSchemaConditionStatement } from "@tonylb/mtw-base/ts/schema/condition"
import { ComponentTag } from "./components/dataTypes/abstract"
import { StandardKey } from "./components/reference"

export type ComponentProcessingTemplate = {
    key: ComponentTag;
    legalParents?: ComponentTag[];
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
// processComponents takes a list of component templates and a tag tree, and extracts the standard byId object.
//
export const processComponents = (props: {
    componentTemplates: ComponentProcessingTemplate[];
    schema: GenericTree<SchemaTag>;
    conditionalContext?: ConditionalContextItem[];
    componentContext?: StandardKey[];
    inContextOfRemove?: boolean;
}): StandardComponent[] => {
    //
    // Loop through each tag in standard order
    //
    const {
        componentTemplates,
        schema,
        conditionalContext = [],
        componentContext = [],
        inContextOfRemove = false,
    } = props

    const recursiveById = schema.reduce<StandardComponent[]>((previous, item) => {
        //
        // If the item is a remove, set inContextOfRemove to true
        //
        if (treeNodeTypeguard(isSchemaRemove)(item)) {
            return [...previous, ...processComponents({ ...props, schema: item.children, inContextOfRemove: true })]
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
                const matchComponents = processComponents({ ...props, schema: replaceMatch.children })
                const payloadComponents = processComponents({ ...props, schema: replacePayload.children })
                //
                // TODO: In order to merge the two lists, we need to create a zippered list of the two,
                // matching by StandardKey.
                //
                const mergedComponents = [
                    ...(matchComponents.map((item) => {
                        const payloadMatch = payloadComponents.find(({ _key }) => (_key.equals(item._key)))
                        return { matchComponent: item, payloadComponent: payloadMatch }
                    })),
                    ...(payloadComponents
                        .filter(({ _key }) => (!matchComponents.some(({ _key: matchKey }) => (matchKey.equals(_key)))))
                        .map((item) => ({ matchComponent: undefined, payloadComponent: item }))
                    )
                ]
                const replaceComponents = mergedComponents.reduce<StandardComponent[]>((previous, { matchComponent, payloadComponent }) => {
                    if (matchComponent && payloadComponent) {
                        return [...previous, new StandardReplace(matchComponent, payloadComponent)]
                    }
                    if (matchComponent) {
                        return [...previous, new StandardRemove(matchComponent)]
                    }
                    if (payloadComponent) {
                        return [...previous, payloadComponent]
                    }
                    return previous
                }, [])
                return [...previous, ...replaceComponents]
            }
            throw new Error('Replace must have both a ReplaceMatch and a ReplacePayload')
        }

        //
        // If the item is a condition, process each sub-statement with the condition added to the context.
        //
        if (treeNodeTypeguard(isSchemaCondition)(item)) {
            const { accumulated } = item.children.reduce<{ accumulated: StandardComponent[]; contextItem?: ConditionalContextItem; }>(({ accumulated, contextItem }, item) => {
                if (contextItem?.fallthrough) {
                    throw new Error('A statement or fallthrough occurring after a fallthrough node is an error.')
                }
                if (treeNodeTypeguard(isSchemaConditionStatement)(item)) {
                    const { if: condition } = item.data
                    const newContextItem: ConditionalContextItem = { condition, fallthrough: false, previousStatementConditions: contextItem ? [...contextItem.previousStatementConditions, contextItem.condition] : [] }
                    return {
                        accumulated: [...accumulated, ...processComponents({ ...props, schema: item.children, conditionalContext: [...conditionalContext, newContextItem] })],
                        contextItem: newContextItem
                    }
                }
                if (treeNodeTypeguard(isSchemaConditionFallthrough)(item)) {
                    if (contextItem?.fallthrough) {
                        throw new Error('A statement or fallthrough occurring after a fallthrough node is an error.')
                    }
                    const newContextItem: ConditionalContextItem = { fallthrough: true, previousStatementConditions: contextItem ? [...contextItem.previousStatementConditions, contextItem.condition] : [] }
                    return {
                        accumulated: [...accumulated, ...processComponents({ ...props, schema: item.children, conditionalContext: [...conditionalContext, newContextItem] })],
                        contextItem: newContextItem
                    }
                }
                return { accumulated, contextItem }
            }, { accumulated: previous })
            return accumulated
        }
        if (treeNodeTypeguard(isSchemaComponent)(item)) {
            const template = componentTemplates.find(({ key }) => (key === item.data.tag))
            if (template) {

                const component = standardComponentFactory(item)

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
                const localizedComponent = (parentTag && !(component.global ?? false))
                    ? component
                        .withLeastCommonContext(componentContext)
                    : component

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
                const editWrappedComponent = inContextOfRemove ? new StandardRemove(conditionalWrappedComponent) : conditionalWrappedComponent
                return [
                    ...previous,
                    editWrappedComponent,
                    ...processComponents({ ...props, schema: item.children, componentContext: [...componentContext, localizedComponent._key.plain] })
                ]
            }
        }
        return [...previous, ...processComponents({ ...props, schema: item.children })]
    }, [])

    return recursiveById
}

export default processComponents