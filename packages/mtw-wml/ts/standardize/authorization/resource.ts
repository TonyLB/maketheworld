import { GenericTree, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import StandardReference from "../components/reference";
import { StandardAuthorizationItem } from "./components/baseClasses";
import { isSchemaComponent, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { isStandardAuthorizationData, isStandardAuthorizationResourceData, StandardAuthorizationData, StandardAuthorizationResourceData } from "./components/dataTypes";
import { mergeAuthWithEdits, StandardAuthRemove, StandardAuthReplace } from "./components/edits";
import StandardGrant from "./components/grant";
import { standardAuthorizationFactory } from "./authorizationFactory";
import { excludeUndefined } from "../../lib/lists";
import { diffSignedStringSets, SignedStringSet } from "./components/utils";
import { unique } from "../../list";
import { treeFromWML } from "../utils";
import { StandardReferenceData, isStandardReferenceData } from "../components/dataTypes/reference";
import { isSchemaTreeNode } from "../components/utils";
import { deepEqual } from "../../lib/objects";

export type StandardAuthorizationResourceNDJSON = {
    referenceStack: StandardReferenceData[];
    grant: StandardAuthorizationData;
}

export const isStandardAuthorizationResourceNDJSON = (value: any): value is StandardAuthorizationResourceNDJSON => {
    return typeof value === 'object' &&
        Array.isArray(value.referenceStack) && value.referenceStack.every(isStandardReferenceData) &&
        'grant' in value && isStandardAuthorizationData(value.grant)
}

export class StandardAuthorizationResource {
    referenceStack: StandardReference[];
    grants: StandardAuthorizationItem[] = [];

    constructor(props: { referenceStack: StandardReference[]; grants: StandardAuthorizationItem[] } | StandardAuthorizationResourceData | GenericTree<SchemaTag> | string | StandardAuthorizationResourceNDJSON[]) {
        const isSchemaTree = (value: any): value is GenericTree<SchemaTag> => {
            return Array.isArray(value) && value.every(isSchemaTreeNode)
        }
        if (isStandardAuthorizationResourceData(props)) {
            const { referenceStack = [], grants } = props
            this.referenceStack = referenceStack ? referenceStack.map((reference) => (new StandardReference(reference))) : []
            this.grants = grants.map(grant => standardAuthorizationFactory(grant)).filter(excludeUndefined)
            return
        }
        else if ((typeof props === 'string') || isSchemaTree(props)) {
            const schema = typeof props === 'string' ? treeFromWML(props) : props
            const extractGrants = (schema: GenericTree<SchemaTag>): { referenceStack: StandardReference[], grants: StandardAuthorizationItem[] } => {
                if (schema.length === 0) {
                    return { referenceStack: [], grants: [] }
                }
                if (schema.length === 1 && treeNodeTypeguard(isSchemaComponent)(schema[0])) {
                    const { referenceStack, grants } = extractGrants(schema[0].children)
                    return { referenceStack: [new StandardReference(schema[0]), ...referenceStack], grants }
                }
                else {
                    return { referenceStack: [], grants: schema.map(grant => standardAuthorizationFactory(grant)).filter(excludeUndefined) }
                }
            }
            const { referenceStack, grants } = extractGrants(schema)
            this.referenceStack = referenceStack
            this.grants = grants
            return
        }
        else if (Array.isArray(props) && props.every(isStandardAuthorizationResourceNDJSON)) {
            const { referenceStack, grants } = props.reduce<{ referenceStack?: StandardReference[]; grants: StandardAuthorizationItem[] }>((previous, { referenceStack, grant }) => {
                const tempReferenceStack = referenceStack.map(reference => new StandardReference(reference))
                if (previous.referenceStack && !deepEqual(previous.referenceStack.map((reference) => (reference.toJSON())), tempReferenceStack.map((reference) => (reference.toJSON())))) {
                    throw new Error('StandardAuthorizationResource NDJSON must all be from same reference')
                }
                return { referenceStack: tempReferenceStack, grants: [...previous.grants, standardAuthorizationFactory(grant)].filter(excludeUndefined) }
            }, { grants: [] })
            this.referenceStack = referenceStack ?? []
            this.grants = grants
            return
        }
        else if (typeof props === 'object') {
            if (!('grants' in props)) {
                throw new Error('Invalid StandardAuthorizationResource props')
            }
            if (!(
                props.grants.every(grant => (grant instanceof StandardGrant || grant instanceof StandardAuthRemove || grant instanceof StandardAuthReplace)) &&
                props.referenceStack.every(reference => reference instanceof StandardReference)
            )) {
                throw new Error('Invalid StandardAuthorizationResource props')
            }
            this.referenceStack = props.referenceStack
            this.grants = props.grants
            return
        }
        this.referenceStack = []
        this.grants = []
    }

    toJSON(): StandardAuthorizationResourceData {
        return {
            referenceStack: this.referenceStack.map(reference => reference.toJSON() as StandardReferenceData),
            grants: this.grants.map(grant => grant.toJSON())
        }
    }

    toNDJSON(): StandardAuthorizationResourceNDJSON[] {
        return this.grants.map(grant => ({
            referenceStack: this.referenceStack.map(reference => reference.toJSON() as StandardReferenceData),
            grant: grant.toJSON()
        }))
    }

    clone(): StandardAuthorizationResource {
        return new StandardAuthorizationResource({
            referenceStack: this.referenceStack.map(reference => reference.clone()),
            grants: this.grants.map(grant => grant.clone())
        })
    }

    get schema(): GenericTree<SchemaTag> {
        const grants = this.grants.map(grant => grant.schema)
        return this.referenceStack.reduceRight<GenericTree<SchemaTag>>((previous, reference) => {
            return [{ data: reference.schema.data, children: previous }]
        }, grants)
    }
    
    get key(): string {
        return this.referenceStack.map(reference => reference.key).join('.')
    }

    nestedSchema(props: { authorizationsById: Record<string, StandardAuthorizationResource>, sortOrder: (a: StandardAuthorizationResource, b: StandardAuthorizationResource) => number }): GenericTree<SchemaTag> {
        const { authorizationsById, sortOrder } = props
        const grants = this.grants.map(grant => grant.schema)
        const children = Object.values(authorizationsById)
            .filter((value) => value.referenceStack.length === this.referenceStack.length + 1 && value.referenceStack.slice(0, -1).every((reference, index) => reference.key === this.referenceStack[index].key))
            .sort(sortOrder)
            .map((value) => value.nestedSchema({ authorizationsById, sortOrder }))
            .flat(1)

        const finalReference = this.referenceStack.slice(-1)[0]
        if (finalReference) {
            return [{ data: finalReference.schema.data, children: [...grants, ...children] }]
        }
        else {
            return [...grants, ...children]
        }
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
        return new StandardAuthorizationResource({ referenceStack: this.referenceStack, grants: newGrants })
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
            return new StandardAuthorizationResource({ referenceStack: this.referenceStack, grants: newGrants })
        }
        else {
            return undefined
        }
    }   
}