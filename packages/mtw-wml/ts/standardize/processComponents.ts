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

//
// Edge type: parent can be either a StandardKey (for nested components) or AssetUUID (for Asset-level components)
// child is always a StandardKey (components don't have universalKey during processing)
//
export type ComponentProcessingEdge = {
    parent: StandardKey | AssetUUID;
    child: StandardKey;
}

export type ComponentProcessingResult = {
    components: StandardComponent[];
    edges: ComponentProcessingEdge[];
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
                edges: [...previous.edges, ...removeResult.edges]
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
                    edges: [...previous.edges, ...matchResult.edges, ...payloadResult.edges]
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
                // Track parent→child edge for this component
                //
                const newEdges: ComponentProcessingEdge[] = []
                if (parentTag) {
                    // Component has a parent in the hierarchy: parent → child edge
                    newEdges.push({
                        parent: parentTag,
                        child: localizedComponent._key.plain
                    })
                } else if (assetUUID) {
                    // Component is at Asset level (no parent tag): Asset → child edge
                    newEdges.push({
                        parent: assetUUID,
                        child: localizedComponent._key.plain
                    })
                }

                // Process children recursively
                const childrenResult = processComponents({ 
                    ...props, 
                    schema: item.children, 
                    componentContext: [...componentContext, localizedComponent._key.plain] 
                })

                return {
                    components: [...previous.components, editWrappedComponent, ...childrenResult.components],
                    edges: [...previous.edges, ...newEdges, ...childrenResult.edges]
                }
            }
        }
        const childrenResult = processComponents({ ...props, schema: item.children })
        return {
            components: [...previous.components, ...childrenResult.components],
            edges: [...previous.edges, ...childrenResult.edges]
        }
    }, { components: [], edges: [] })

    return recursiveResult
}

export default processComponents