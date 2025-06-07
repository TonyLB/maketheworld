import { objectMerge } from "../../lib/objects"
import { GenericTree, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { StandardAuthRemove } from "./components/edits"
import { isSchemaComponent, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload } from "@tonylb/mtw-base/ts/schema/edit"
import { ComponentProcessingTemplate } from "../processComponents"
import { isSchemaGrant } from "@tonylb/mtw-base/ts/schema/authorization"
import StandardGrant from "./components/grant"
import { StandardAuthorizationResource } from "./resource"
import StandardReference, { StandardReferenceSimple, StandardKey } from "../components/reference"

//
// mergeAuthByIds takes two objects keyed by resource ID and merges them together, using the merge method of the StandardAuthorizationItem class.
//

//
// TODO: Create StandardAuthorizationCollection class, and use that to handle merge processes in this function
//
const mergeAuthByIds = (byId: Record<string, StandardAuthorizationResource>, newById: Record<string, StandardAuthorizationResource>): Record<string, StandardAuthorizationResource> => {
    return Object.entries(newById).reduce((previous, [key, value]) => {
        const base = previous[key]
        if (base) {
            const merged = base.merge(value)
            if (merged) {
                return { ...previous, [key]: merged }
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
// processAuthorizations takes a list of component templates and a tag tree, and extracts the authorization objects
// embedded in that structure.
//
export const processAuthorizations = (props: {
    componentTemplates: ComponentProcessingTemplate[];
    schema: GenericTree<SchemaTag>;
    componentContext?: StandardKey[];
    inContextOfRemove?: boolean;
}): Record<string, StandardAuthorizationResource> => {
    //
    // Loop through each tag in standard order
    //
    const {
        componentTemplates,
        schema,
        componentContext = [],
        inContextOfRemove = false
    } = props

    const recursiveById = schema.reduce<Record<string, StandardAuthorizationResource>>((previous, item) => {

        //
        // If the item is a remove, set inContextOfRemove to true
        //
        if (treeNodeTypeguard(isSchemaRemove)(item)) {
            return mergeAuthByIds(previous, processAuthorizations({ ...props, schema: item.children, inContextOfRemove: true }))
        }

        //
        // If the item is a replace, manually create byId entries for the ReplaceMatch and ReplacePayload entries,
        // then use objectMerge to generate a key-by-key comparison of the two, using the diff method of the
        // StandardAuthorizationResource class to generate the final result.
        //
        if (treeNodeTypeguard(isSchemaReplace)(item)) {
            const replaceMatch = item.children.find(treeNodeTypeguard(isSchemaReplaceMatch))
            const replacePayload = item.children.find(treeNodeTypeguard(isSchemaReplacePayload))
            if (replaceMatch && replacePayload) {
                const matchById = processAuthorizations({ ...props, schema: replaceMatch.children })
                const payloadById = processAuthorizations({ ...props, schema: replacePayload.children })
                const mergedById = objectMerge(matchById, payloadById)
                const replaceById = Object.entries(mergedById).reduce<Record<string, StandardAuthorizationResource>>((previous, [key, { itemA: matchResource, itemB: payloadResource }]) => {
                    if (matchResource && payloadResource) {
                        const diff = matchResource.diff(payloadResource)
                        return diff ? { ...previous, [key]: diff } : previous
                    }
                    if (matchResource) {
                        const diff = new StandardAuthorizationResource({ referenceStack: matchResource.referenceStack, grants: [] }).diff(matchResource)
                        return diff ? { ...previous, [key]: diff } : previous
                    }
                    if (payloadResource) {
                        return { ...previous, [key]: payloadResource }
                    }
                    return previous
                }, {})
                return mergeAuthByIds(previous, replaceById)
            }
            throw new Error('Replace must have both a ReplaceMatch and a ReplacePayload')
        }

        if (treeNodeTypeguard(isSchemaComponent)(item)) {
            const template = componentTemplates.find(({ key }) => (key === item.data.tag))
            if (template) {
                //
                // If the template has legalParents, extract the nearest legal parent tags from the componentContext
                //
                const legalParentTags = template.legalParents ?? []
                const ancestorTags = componentContext.filter(({ tag }) => (legalParentTags.includes(tag)))
                const parentTag = ancestorTags.slice(-1)[0]

                //
                // Localize the key for the component if it is not global, and has a parent tag
                //
                const newComponent = new StandardReference(item.data)
                if (!(newComponent._payload instanceof StandardReferenceSimple)) {
                    throw new Error(`Component ${item.data.tag} does not have a valid reference payload`)
                }

                return mergeAuthByIds(
                    previous,
                    processAuthorizations({ ...props, schema: item.children, componentContext: [...componentContext, newComponent._payload.payload] })
                )
            }
        }

        if (treeNodeTypeguard(isSchemaGrant)(item)) {
            //
            // Create a reference to the nearest parent in the componentContext, and use
            // that to create a new StandardAuthorizationResource object to merge.
            //
            const referenceStack = componentContext.map((reference) => (new StandardReference(reference)))
            const key = referenceStack.map(({ key }) => key).join('.')
            const itemResource = new StandardAuthorizationResource({
                referenceStack,
                grants: [
                    inContextOfRemove
                        ? new StandardAuthRemove(new StandardGrant(item))
                        : new StandardGrant(item)
                ]
            })
            return mergeAuthByIds(previous, { [key]: itemResource })
        }
        return mergeAuthByIds(previous, processAuthorizations({ ...props, schema: item.children }))
    }, {})

    return recursiveById
}

export default processAuthorizations