import { GenericTree, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { standardComponentFactory } from "./componentFactory"
import { StandardComponent } from "./components/baseClasses"
import { isSchemaComponent, SchemaTag, AssetUUID } from "@tonylb/mtw-base/ts/schema"
import { isSchemaRemove, isSchemaReplace } from "@tonylb/mtw-base/ts/schema/edit"
import { ComponentTag } from "./components/dataTypes/abstract"
import { StandardKey, StandardReferenceSimple } from "./components/reference"
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
    topLevel: StandardKey[];
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
                topLevel: [...previous.topLevel, ...removeResult.topLevel]
            }
        }

        //
        // Replace tags are not permitted at component level, so we throw an error
        //
        if (treeNodeTypeguard(isSchemaReplace)(item)) {
            throw new Error('Replace tags are not permitted at component level')
        }

        if (treeNodeTypeguard(isSchemaComponent)(item)) {
            const template = componentTemplates.find(({ key }) => (key === item.data.tag))
            if (template) {

                const component = standardComponentFactory(item)

                //
                // If the template has legalParents, check if there are any legal parent tags in the componentContext
                //
                const legalParentTags = template.legalParents ?? []
                const ancestorTags = componentContext.filter((tag) => (legalParentTags.includes(tag)))

                if (!component) {
                    return previous
                }

                //
                // Note: We no longer set context here. Parent relationships are determined later by
                // generateImplicitParents() which builds a graph from component.referencedKeys() edges.
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
                //
                const isTopLevel = ancestorTags.length === 0 && assetUUID

                // Process children recursively
                // Component tag is always a ComponentTag (not 'Remove' or 'Replace') since we only store plain components
                const componentTag = plainComponent.tag as ComponentTag
                const childrenResult = processComponents({ 
                    ...props, 
                    schema: item.children,
                    componentContext: [...componentContext, componentTag]
                })

                return {
                    components: [...previous.components, plainComponent, ...childrenResult.components],
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

    // Build ReferenceCollection from all components
    const references = recursiveResult.components
        .map(component => {
            try {
                const referenceData = component.referenceData
                return new StandardReferenceSimple(referenceData)
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