import { GenericTree } from "@tonylb/mtw-base/ts/genericTree";
import StandardReference from "../components/reference";
import { StandardAuthorizationItem } from "./components/baseClasses";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { isStandardAuthorizationResourceData, StandardAuthorizationResourceData } from "./components/dataTypes";
import { mergeAuthWithEdits, StandardAuthRemove, StandardAuthReplace } from "./components/edits";
import StandardGrant from "./components/grant";
import { standardAuthorizationFactory } from "./authorizationFactory";
import { excludeUndefined } from "../../lib/lists";
import { diffSignedStringSets, SignedStringSet } from "./components/utils";
import { unique } from "../../list";
import { treeFromWML } from "../utils";
import { StandardReferenceData } from "../components/dataTypes";

export class StandardAuthorizationResource {
    referenceStack: StandardReference[];
    grants: StandardAuthorizationItem[] = [];

    constructor(props: { referenceStack: StandardReference[]; grants: StandardAuthorizationItem[] } | StandardAuthorizationResourceData | GenericTree<SchemaTag> | string) {
        if (isStandardAuthorizationResourceData(props)) {
            const { referenceStack = [], grants } = props
            this.referenceStack = referenceStack ? referenceStack.map((reference) => (new StandardReference(reference))) : []
            this.grants = grants.map(grant => standardAuthorizationFactory(grant)).filter(excludeUndefined)
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
        const schema = typeof props === 'string' ? treeFromWML(props) : props
        const referenceStack = schema.length === 1 ? [new StandardReference(schema[0])] : []
        const grants = referenceStack ? schema[0].children.map(grant => standardAuthorizationFactory(grant)).filter(excludeUndefined) : schema.map(grant => standardAuthorizationFactory(grant)).filter(excludeUndefined)
        this.referenceStack = referenceStack
        this.grants = grants
    }

    toJSON(): StandardAuthorizationResourceData {
        return {
            referenceStack: this.referenceStack.map(reference => reference.toJSON() as StandardReferenceData),
            grants: this.grants.map(grant => grant.toJSON())
        }
    }

    clone(): StandardAuthorizationResource {
        return new StandardAuthorizationResource({
            referenceStack: this.referenceStack.map(reference => reference.clone()),
            grants: this.grants.map(grant => grant.clone())
        })
    }

    get schema(): GenericTree<SchemaTag> {
        const reference = this.referenceStack[0]?.schema
        const grants = this.grants.map(grant => grant.schema)
        if (reference) {
            return [{
                data: reference.data,
                children: grants
            }]
        }
        else {
            return grants
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