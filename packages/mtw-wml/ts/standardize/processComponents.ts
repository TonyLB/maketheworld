import { GenericTree, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { standardComponentFactory } from "./componentFactory"
import { StandardComponent } from "./components/baseClasses"
import { isSchemaComponent, SchemaTag, AssetUUID } from "@tonylb/mtw-base/ts/schema"
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload } from "@tonylb/mtw-base/ts/schema/edit"
import { ComponentTag } from "./components/dataTypes/abstract"
import { ReferenceList } from "./keys/referenceList"
import StandardReference from "./keys/reference"
import { ReferenceCollection } from "./components/utils/referenceCollection"
import { excludeUndefined } from "@tonylb/mtw-base/ts/utils/lists"

export type ComponentProcessingTemplate = {
    key: ComponentTag;
    legalParents?: (ComponentTag | 'Asset')[];
}

// Non-edit component type - excludes components wrapped in Remove or Replace
// Matches the pattern of StandardComponentNonEditData for data types
//
// TEMPORARY: This is a temporary type to allow us to store non-edit components in the ComponentProcessingResult,
// pending the removal of component-level edit as an option.
export type StandardComponentNonEdit = StandardComponent & {
    tag: ComponentTag;
}

export type ComponentProcessingResult = {
    components: StandardComponentNonEdit[];
    topLevel: ReferenceList;
    referenceCollection: ReferenceCollection;
}

//
// processComponents takes a list of component templates and a tag tree, and extracts the standard byId object.
// Now also collects parent→child edges during processing.
//
export const processComponents = (props: {
    componentTemplates: ComponentProcessingTemplate[];
    schema: GenericTree<SchemaTag>;
    componentContext?: ComponentTag[];
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

    const recursiveResult = schema.reduce<Omit<ComponentProcessingResult, 'referenceCollection'>>((previous, item) => {
        //
        // If the item is a remove, invert inContextOfRemove
        //
        if (treeNodeTypeguard(isSchemaRemove)(item)) {
            const removeResult = processComponents({ ...props, schema: item.children, inContextOfRemove: !(inContextOfRemove ?? false) })
            return {
                components: [...previous.components, ...removeResult.components],
                topLevel: previous.topLevel.merge(removeResult.topLevel) ?? new ReferenceList([])
            }
        }

        //
        // Replace tags: Only throw error if they contain component-type tags
        // Non-component Replace tags (like asset Summary) can be ignored
        //
        if (treeNodeTypeguard(isSchemaReplace)(item)) {
            const match = item.children.find(treeNodeTypeguard(isSchemaReplaceMatch))
            const payload = item.children.find(treeNodeTypeguard(isSchemaReplacePayload))
            
            // Helper function to recursively check if any component tags exist in a tree
            const hasComponentTag = (nodes: GenericTree<SchemaTag>): boolean => {
                return nodes.some(node => {
                    // Check if this node is a component tag
                    if (componentTemplates.some(template => template.key === node.data.tag)) {
                        return true
                    }
                    // Recursively check children
                    return hasComponentTag(node.children)
                })
            }
            
            // Check if either match or payload contains component-type tags
            const hasComponentInMatch = match ? hasComponentTag(match.children) : false
            const hasComponentInPayload = payload ? hasComponentTag(payload.children) : false
            
            if (hasComponentInMatch || hasComponentInPayload) {
                throw new Error('Replace tags are not permitted at component level')
            }
            // If no component tags found, return empty (non-component Replace tags are ignored)
            return previous
        }

        if (treeNodeTypeguard(isSchemaComponent)(item)) {
            const template = componentTemplates.find(({ key }) => (key === item.data.tag))
            if (template) {

                const { component, remainder } = standardComponentFactory(item)

                //
                // If the template has legalParents, check if there are any legal parent tags in the componentContext
                //
                const legalParentTags = template.legalParents ?? []
                const ancestorTags = componentContext.filter((tag) => (legalParentTags.includes(tag)))

                if (!component) {
                    return previous
                }

                //
                // Note: We no longer set context here. Parent relationships are determined by
                // SchemaOrganization which builds a graph from component.referencedKeys() edges.
                // The componentContext parameter is still used for topLevel tracking,
                // but we don't need to set context on the component itself.
                //
                const localizedComponent = component

                // Invert component if in Remove context - this distributes Remove operations into component fields
                // Result is always a non-edit component (not wrapped in Remove/Replace)
                const plainComponent: StandardComponentNonEdit = (inContextOfRemove && localizedComponent.invert) 
                    ? localizedComponent.invert() as StandardComponentNonEdit
                    : localizedComponent as StandardComponentNonEdit

                //
                // Track if this component is at Asset level (topLevel)
                // NOTE: This uses ancestorTags.length === 0, which means components without legalParents
                // will always be considered topLevel even when nested. Components that can be nested
                // should have their legalParents properly configured in componentTemplates.
                //
                const isTopLevel = ancestorTags.length === 0 && assetUUID

                // Process children recursively
                // Component tag is always a ComponentTag (not 'Remove' or 'Replace') since we only store plain components
                const componentTag = plainComponent.tag as ComponentTag
                const childrenResult = processComponents({
                    ...props,
                    schema: remainder,
                    componentContext: [...componentContext, componentTag]
                })

                // Build topLevel ReferenceList
                let updatedTopLevel = previous.topLevel
                if (isTopLevel) {
                    // Create reference from schema node to preserve ref attribute
                    // StandardReference constructor extracts ref from node.data if present
                    const baseReference = new StandardReference([item])
                    const reference = inContextOfRemove
                        ? baseReference.invert()
                        : baseReference
                    
                    const topLevelReferenceList = new ReferenceList([reference])
                    const merged = previous.topLevel.merge(topLevelReferenceList)
                    updatedTopLevel = merged ?? new ReferenceList([])
                }

                const finalTopLevel = updatedTopLevel.merge(childrenResult.topLevel) ?? new ReferenceList([])

                return {
                    components: [...previous.components, plainComponent, ...childrenResult.components],
                    topLevel: finalTopLevel
                }
            }
        }
        const childrenResult = processComponents({ ...props, schema: item.children })
        return {
            components: [...previous.components, ...childrenResult.components],
            topLevel: previous.topLevel.merge(childrenResult.topLevel) ?? new ReferenceList([])
        }
    }, { components: [], topLevel: new ReferenceList([]) })

    // Build ReferenceCollection from all components
    const references = recursiveResult.components
        .map(component => {
            try {
                const referenceData = component.referenceData
                return new StandardReference(referenceData)
            } catch (error) {
                // Skip components that don't have valid referenceData
                return undefined
            }
        })
        .filter(excludeUndefined)
    
    const referenceCollection = new ReferenceCollection(references)

    return {
        ...recursiveResult,
        referenceCollection
    }
}

export default processComponents