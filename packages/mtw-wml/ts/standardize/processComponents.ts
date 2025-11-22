import { GenericTree, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { standardComponentFactory } from "./componentFactory"
import { StandardComponent } from "./components/baseClasses"
import { StandardRemove, StandardReplace } from "./components/edits"
import { isSchemaComponent, SchemaTag, AssetUUID } from "@tonylb/mtw-base/ts/schema"
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload } from "@tonylb/mtw-base/ts/schema/edit"
import { ComponentTag } from "./components/dataTypes/abstract"
import { StandardKey } from "./components/reference"
import StandardRoom from "./components/room"

export type ComponentProcessingTemplate = {
    key: ComponentTag;
    legalParents?: (ComponentTag | 'Asset')[];
}

export type ComponentProcessingResult = {
    components: StandardComponent[];
    topLevel: StandardKey[];
}

//
// processComponents takes a list of component templates and a tag tree, and extracts the standard byId object.
// Now also collects parent→child edges during processing.
//
export const processComponents = (props: {
    componentTemplates: ComponentProcessingTemplate[];
    schema: GenericTree<SchemaTag>;
    componentContext?: StandardKey[];
    inContextOfRemove?: boolean;
    assetUUID?: AssetUUID;
}): ComponentProcessingResult => {
    //
    // Loop through each tag in standard order
    //
    const {
        componentTemplates,
        schema,
        componentContext = [],
        inContextOfRemove = false,
        assetUUID,
    } = props

    const recursiveResult = schema.reduce<ComponentProcessingResult>((previous, item) => {
        //
        // If the item is a remove, set inContextOfRemove to true
        //
        if (treeNodeTypeguard(isSchemaRemove)(item)) {
            const removeResult = processComponents({ ...props, schema: item.children, inContextOfRemove: true })
            return {
                components: [...previous.components, ...removeResult.components],
                topLevel: [...previous.topLevel, ...removeResult.topLevel]
            }
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
                const matchResult = processComponents({ ...props, schema: replaceMatch.children })
                const payloadResult = processComponents({ ...props, schema: replacePayload.children })
                //
                // TODO: In order to merge the two lists, we need to create a zippered list of the two,
                // matching by StandardKey.
                //
                const mergedComponents = [
                    ...(matchResult.components.map((item) => {
                        const payloadMatch = payloadResult.components.find(({ _key }) => (_key.equals(item._key)))
                        return { matchComponent: item, payloadComponent: payloadMatch }
                    })),
                    ...(payloadResult.components
                        .filter(({ _key }) => (!matchResult.components.some(({ _key: matchKey }) => (matchKey.equals(_key)))))
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
                return {
                    components: [...previous.components, ...replaceComponents],
                    topLevel: [...previous.topLevel, ...matchResult.topLevel, ...payloadResult.topLevel]
                }
            }
            throw new Error('Replace must have both a ReplaceMatch and a ReplacePayload')
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
                // Localize the key for the component if it has a parent tag, EXCEPT for the case where the component
                // is a room within a map. Because of the way maps display positions, we need to keep the room at a
                // higher level, so that the position can be displayed separately from the room.
                //
                const localizedComponent = parentTag
                    ? component instanceof StandardRoom
                        ? component.withLeastCommonContext(componentContext.filter(({ tag }) => (tag !== 'Map')))
                        : component.withLeastCommonContext(componentContext)
                    : component

                const editWrappedComponent = inContextOfRemove ? new StandardRemove(localizedComponent) : localizedComponent

                //
                // Track if this component is at Asset level (topLevel)
                //
                const isTopLevel = !parentTag && assetUUID

                // Process children recursively
                const childrenResult = processComponents({ 
                    ...props, 
                    schema: item.children, 
                    componentContext: [...componentContext, localizedComponent._key.plain] 
                })

                return {
                    components: [...previous.components, editWrappedComponent, ...childrenResult.components],
                    topLevel: isTopLevel 
                        ? [...previous.topLevel, localizedComponent._key.plain]
                        : previous.topLevel
                }
            }
        }
        const childrenResult = processComponents({ ...props, schema: item.children })
        return {
            components: [...previous.components, ...childrenResult.components],
            topLevel: [...previous.topLevel, ...childrenResult.topLevel]
        }
    }, { components: [], topLevel: [] })

    return recursiveResult
}

export default processComponents