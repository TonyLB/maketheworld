import { GenericTree, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { StandardAuthRemove, StandardAuthReplace } from "./components/edits"
import { isSchemaComponent, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload } from "@tonylb/mtw-base/ts/schema/edit"
import { isSchemaGrant } from "@tonylb/mtw-base/ts/schema/authorization"
import StandardGrant from "./components/grant"
import { StandardAuthorizationResource } from "./resource"
import StandardReference, { StandardReferenceSimple } from "../components/reference"
import { StandardAuthorizationItem } from "./components/baseClasses"

//
// Helper to check if two component references are equal (handles undefined for global grants)
//
const componentEqual = (a?: StandardReference, b?: StandardReference): boolean => {
    if (a === undefined && b === undefined) {
        return true  // Both global
    }
    if (a === undefined || b === undefined) {
        return false  // One global, one not
    }
    return a.equal(b)
}

//
// Merge authorization resources with the same component
//
const mergeAuthResources = (resources: StandardAuthorizationResource[]): StandardAuthorizationResource[] => {
    return resources.reduce<StandardAuthorizationResource[]>((previous, resource) => {
        const existing = previous.find((r) => componentEqual(r.component, resource.component))
        if (existing) {
            const merged = existing.merge(resource)
            return [...previous.filter((r) => r !== existing), merged]
        }
        return [...previous, resource]
    }, [])
}

//
// processAuthorizations takes a tag tree and extracts the authorization objects
// embedded in that structure. Returns a flat array of resources (one per component with grants).
//
export const processAuthorizations = (props: {
    schema: GenericTree<SchemaTag>;
    inContextOfRemove?: boolean;
}): StandardAuthorizationResource[] => {
    //
    // Loop through each tag in standard order
    //
    const {
        schema,
        inContextOfRemove = false
    } = props

    const resources = schema.reduce<StandardAuthorizationResource[]>((previous, item) => {

        //
        // Handle global grants (grants directly on Asset, not in any component)
        //
        if (treeNodeTypeguard(isSchemaGrant)(item)) {
            const grant = inContextOfRemove 
                ? new StandardAuthRemove(new StandardGrant(item))
                : new StandardGrant(item)
            // Global grants have no component (undefined)
            const globalResource = new StandardAuthorizationResource({
                component: undefined,
                grants: [grant]
            })
            return mergeAuthResources([...previous, globalResource])
        }

        //
        // If the item is a remove, set inContextOfRemove to true
        //
        if (treeNodeTypeguard(isSchemaRemove)(item)) {
            return mergeAuthResources([...previous, ...processAuthorizations({ ...props, schema: item.children, inContextOfRemove: true })])
        }

        //
        // If the item is a replace, process match and payload separately, then create diff resources
        //
        if (treeNodeTypeguard(isSchemaReplace)(item)) {
            const replaceMatch = item.children.find(treeNodeTypeguard(isSchemaReplaceMatch))
            const replacePayload = item.children.find(treeNodeTypeguard(isSchemaReplacePayload))
            if (replaceMatch && replacePayload) {
                const matchResources = processAuthorizations({ ...props, schema: replaceMatch.children })
                const payloadResources = processAuthorizations({ ...props, schema: replacePayload.children })
                
                // Group by component and create diffs
                const allComponents = [...matchResources, ...payloadResources]
                    .map(r => r.component)
                    .filter((comp, index, self) => 
                        self.findIndex(c => componentEqual(c, comp)) === index
                    )
                
                const diffResources = allComponents.map((component) => {
                    const matchResource = matchResources.find(r => componentEqual(r.component, component))
                    const payloadResource = payloadResources.find(r => componentEqual(r.component, component))
                    
                    if (matchResource && payloadResource) {
                        return matchResource.diff(payloadResource)
                    }
                    if (matchResource) {
                        return new StandardAuthorizationResource({ component: matchResource.component, grants: [] }).diff(matchResource)
                    }
                    if (payloadResource) {
                        return payloadResource
                    }
                    return undefined
                }).filter((r): r is StandardAuthorizationResource => r !== undefined)
                
                return mergeAuthResources([...previous, ...diffResources])
            }
            throw new Error('Replace must have both a ReplaceMatch and a ReplacePayload')
        }

        if (treeNodeTypeguard(isSchemaComponent)(item)) {
            //
            // Pass [item] as a GenericTree so payloadFactory can extract uuid and convert to universalKey
            // Flat structure: Component with grants directly inside, no nesting
            //
            const componentRef = new StandardReference([item])
            if (!(componentRef._payload instanceof StandardReferenceSimple)) {
                throw new Error(`Component ${item.data.tag} does not have a valid reference payload`)
            }

                // Extract authorization items (grants, removes, replaces) from this component's children
                const authItems: StandardAuthorizationItem[] = []
                const nonAuthChildren: GenericTree<SchemaTag> = []
                
                item.children.forEach((child) => {
                    if (treeNodeTypeguard(isSchemaGrant)(child)) {
                        authItems.push(inContextOfRemove 
                            ? new StandardAuthRemove(new StandardGrant(child))
                            : new StandardGrant(child))
                    } else if (treeNodeTypeguard(isSchemaRemove)(child)) {
                        // Process grants inside Remove
                        child.children.filter(treeNodeTypeguard(isSchemaGrant)).forEach((grantItem) => {
                            authItems.push(new StandardAuthRemove(new StandardGrant(grantItem)))
                        })
                    } else if (treeNodeTypeguard(isSchemaReplace)(child)) {
                        // Process Replace for grants
                        const match = child.children.find(treeNodeTypeguard(isSchemaReplaceMatch))
                        const payload = child.children.find(treeNodeTypeguard(isSchemaReplacePayload))
                        if (match && payload) {
                            const matchGrants = match.children.filter(treeNodeTypeguard(isSchemaGrant))
                            const payloadGrants = payload.children.filter(treeNodeTypeguard(isSchemaGrant))
                            // For now, assume single grant replacement
                            if (matchGrants.length > 0 && payloadGrants.length > 0) {
                                authItems.push(new StandardAuthReplace(
                                    new StandardGrant(matchGrants[0]),
                                    new StandardGrant(payloadGrants[0])
                                ))
                            }
                        }
                    } else {
                        // Not an auth item, keep for recursive processing
                        nonAuthChildren.push(child)
                    }
                })

                // If this component has auth items, create a resource for it
                const componentResource = authItems.length > 0
                    ? [new StandardAuthorizationResource({ component: componentRef, grants: authItems })]
                    : []

                // Recursively process child components (nested components, not grants)
                const childResources = processAuthorizations({ ...props, schema: nonAuthChildren })

            return mergeAuthResources([...previous, ...componentResource, ...childResources])
        }

        return mergeAuthResources([...previous, ...processAuthorizations({ ...props, schema: item.children })])
    }, [])

    return resources
}

export default processAuthorizations