import { GenericTree, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import StandardReference from "../keys/reference";
import { StandardAuthorizationItem } from "./components/baseClasses";
import { isSchemaComponent, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { isStandardAuthorizationData, isStandardAuthorizationResourceData, StandardAuthorizationData, StandardAuthorizationResourceData } from "./components/dataTypes";
import { mergeAuthWithEdits, StandardAuthRemove, StandardAuthReplace } from "./components/edits";
import StandardGrant from "./components/grant";
import { standardAuthorizationFactory } from "./authorizationFactory";
import { excludeUndefined } from "../../lib/lists";
import { diffSignedStringSets, SignedStringSet } from "./components/utils";
import { unique } from "../../list";
import { StandardReferenceData, isStandardReferenceData } from "../keys/dataTypes/reference";
import { isSchemaTreeNode, treeFromWML } from "../../schema";

export type StandardAuthorizationResourceNDJSON = {
    component?: StandardReferenceData;  // Undefined for global (Asset-level) grants
    grant: StandardAuthorizationData;
}

export const isStandardAuthorizationResourceNDJSON = (value: any): value is StandardAuthorizationResourceNDJSON => {
    return typeof value === 'object' &&
        (!('component' in value) || value.component === undefined || isStandardReferenceData(value.component)) &&
        'grant' in value && isStandardAuthorizationData(value.grant)
}

export class StandardAuthorizationResource {
    component?: StandardReference;  // Undefined for global (Asset-level) grants
    grants: StandardAuthorizationItem[] = [];

    constructor(props: { component?: StandardReference; grants: StandardAuthorizationItem[] } | StandardAuthorizationResourceData | GenericTree<SchemaTag> | string | StandardAuthorizationResourceNDJSON[]) {
        const isSchemaTree = (value: any): value is GenericTree<SchemaTag> => {
            return Array.isArray(value) && value.every(isSchemaTreeNode)
        }
        if (isStandardAuthorizationResourceData(props)) {
            const { component, grants } = props
            if (component) {
                this.component = new StandardReference(component)
            } else {
                this.component = undefined
            }
            this.grants = grants.map(grant => standardAuthorizationFactory(grant)).filter(excludeUndefined)
            return
        }
        else if ((typeof props === 'string') || isSchemaTree(props)) {
            const schema = typeof props === 'string' ? treeFromWML(props) : props
            // Expect flat structure: <Component><Grant /></Component>
            if (schema.length === 1 && treeNodeTypeguard(isSchemaComponent)(schema[0])) {
                this.component = new StandardReference([schema[0]])
                this.grants = schema[0].children.map(grant => standardAuthorizationFactory(grant)).filter(excludeUndefined)
                return
            }
            throw new Error('StandardAuthorizationResource WML must be a single component with grants')
        }
        else if (Array.isArray(props) && props.every(isStandardAuthorizationResourceNDJSON)) {
            const { component, grants } = props.reduce<{ component?: StandardReference; grants: StandardAuthorizationItem[] }>((previous, { component, grant }) => {
                let tempComponent: StandardReference | undefined = undefined
                if (component) {
                    tempComponent = new StandardReference(component)
                }
                
                // Only check consistency if we've already seen items (previous.grants.length > 0)
                if (previous.grants.length > 0) {
                    if ((previous.component === undefined) !== (tempComponent === undefined)) {
                        throw new Error('StandardAuthorizationResource NDJSON must all be from same component')
                    }
                    if (previous.component && tempComponent && !previous.component.equal(tempComponent)) {
                        throw new Error('StandardAuthorizationResource NDJSON must all be from same component')
                    }
                }
                
                return { 
                    component: tempComponent,
                    grants: [...previous.grants, standardAuthorizationFactory(grant)].filter(excludeUndefined) 
                }
            }, { grants: [] })
            this.component = component
            this.grants = grants
            return
        }
        else if (typeof props === 'object') {
            if (!('grants' in props)) {
                throw new Error('Invalid StandardAuthorizationResource props')
            }
            if (!(
                props.grants.every(grant => (grant instanceof StandardGrant || grant instanceof StandardAuthRemove || grant instanceof StandardAuthReplace)) &&
                (!props.component || props.component instanceof StandardReference)
            )) {
                throw new Error('Invalid StandardAuthorizationResource props')
            }
            this.component = props.component
            this.grants = props.grants
            return
        }
        throw new Error('Invalid StandardAuthorizationResource constructor arguments')
    }

    toJSON(): StandardAuthorizationResourceData {
        return {
            component: this.component?.toJSON(),
            grants: this.grants.map(grant => grant.toJSON())
        }
    }

    toNDJSON(): StandardAuthorizationResourceNDJSON[] {
        return this.grants.map(grant => ({
            component: this.component?.toJSON(),
            grant: grant.toJSON()
        }))
    }

    clone(): StandardAuthorizationResource {
        return new StandardAuthorizationResource({
            component: this.component?.clone(),
            grants: this.grants.map(grant => grant.clone())
        })
    }

    get schema(): GenericTree<SchemaTag> {
        const grants = this.grants.map(grant => grant.schema)
        // Simple flat structure: <Component>...grants...</Component>
        // For global grants (no component), return grants directly
        if (!this.component) {
            return grants.flat()
        }
        return [{ data: this.component.schema[0].data, children: grants }]
    }
    
    get sortKey(): string {
        // String identifier for sorting: local key > universalKey > empty (for global)
        return this.component?.key ?? this.component?.universalKey ?? ''
    }


    merge(incoming: StandardAuthorizationResource): StandardAuthorizationResource {
        const newGrants = incoming.grants.reduce((previous, grant) => {
            const base = previous.find(baseGrant => baseGrant.player === grant.player)
            if (base) {
                const previousWithoutMatch = previous.filter(baseGrant => baseGrant.player !== grant.player)
                const merged = mergeAuthWithEdits(base, grant)
                if (merged) {
                    return [...previousWithoutMatch, merged]
                }
                else {
                    return previousWithoutMatch
                }
            }
            else {
                return [...previous, grant]
            }
        }, this.grants)
        return new StandardAuthorizationResource({ component: this.component, grants: newGrants })
    }

    diff(incoming: StandardAuthorizationResource): StandardAuthorizationResource | undefined {
        const allPlayers = unique([...this.grants, ...incoming.grants].map(grant => grant.player))
        const newGrants = allPlayers.reduce((previous, player) => {
            const base = this.grants.find(baseGrant => baseGrant.player === player) ?? new StandardGrant({ tag: 'Grant', player, actions: [] })
            const incomingGrant = incoming.grants.find(incomingGrant => incomingGrant.player === player) ?? new StandardGrant({ tag: 'Grant', player, actions: [] })
            const baseSignedActions: SignedStringSet = base instanceof StandardAuthReplace
                ? {
                    add: base._payload instanceof StandardGrant ? base._payload.actions : [],
                    remove: base._match instanceof StandardGrant ? base._match.actions : []
                }
                : base instanceof StandardAuthRemove
                    ? { add: [], remove: base._match instanceof StandardGrant ? base._match.actions : [] }
                    : { add: base instanceof StandardGrant ? base.actions : [], remove: [] }
            const incomingSignedActions: SignedStringSet = incomingGrant instanceof StandardAuthReplace
                ? {
                    add: incomingGrant._payload instanceof StandardGrant ? incomingGrant._payload.actions : [],
                    remove: incomingGrant._match instanceof StandardGrant ? incomingGrant._match.actions : []
                }
                : incomingGrant instanceof StandardAuthRemove
                    ? { add: [], remove: incomingGrant._match instanceof StandardGrant ? incomingGrant._match.actions : [] }
                    : { add: incomingGrant instanceof StandardGrant ? incomingGrant.actions : [], remove: [] }
            const diffedActions = diffSignedStringSets(baseSignedActions, incomingSignedActions)
            if (diffedActions.add.length > 0) {
                if (diffedActions.remove.length > 0) {
                    return [...previous, new StandardAuthReplace(
                        new StandardGrant({ tag: 'Grant', player: base.player, actions: diffedActions.remove }),
                        new StandardGrant({ tag: 'Grant', player: base.player, actions: diffedActions.add })
                    )]
                }
                else {
                    return [...previous, new StandardGrant({ tag: 'Grant', player: base.player, actions: diffedActions.add })]
                }
            }
            else {
                if (diffedActions.remove.length > 0) {
                    return [...previous, new StandardAuthRemove(new StandardGrant({ tag: 'Grant', player: base.player, actions: diffedActions.remove }))]
                }
                else {
                    return previous
                }
            }
        }, [] as StandardAuthorizationItem[])
        if (newGrants.length > 0) {
            return new StandardAuthorizationResource({ component: this.component, grants: newGrants })
        }
        else {
            return undefined
        }
    }   
}