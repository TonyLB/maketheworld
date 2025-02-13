import { GenericTree } from "@tonylb/mtw-base/ts/genericTree";
import StandardReference from "../components/reference";
import { StandardAuthorizationItem } from "./components/baseClasses";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { isStandardAuthorizationResourceData, StandardAuthorizationResourceData } from "./components/dataTypes";
import { mergeAuthWithEdits, StandardAuthRemove, StandardAuthReplace } from "./components/edits";
import StandardGrant from "./components/grant";
import { standardAuthorizationFactory } from "./authorizationFactory";
import { excludeUndefined } from "../../lib/lists";
import { diffSignedStringSets, removeStringsFromList, SignedStringSet } from "./components/utils";
import { unique } from "../../list";

export class StandardAuthorizationResource {
    reference?: StandardReference;
    grants: StandardAuthorizationItem[] = [];

    constructor(props: { reference?: StandardReference; grants: StandardAuthorizationItem[] } | StandardAuthorizationResourceData) {
        if (isStandardAuthorizationResourceData(props)) {
            const { reference, grants } = props
            this.reference = reference ? new StandardReference(reference) : undefined
            this.grants = grants.map(grant => standardAuthorizationFactory(grant)).filter(excludeUndefined)
        }
        else {
            if (!(props.grants.every(grant => (grant instanceof StandardGrant || grant instanceof StandardAuthRemove || grant instanceof StandardAuthReplace)) && (!props.reference || props.reference instanceof StandardReference))) {
                throw new Error('Invalid StandardAuthorizationResource props')
            }
            this.reference = props.reference
            this.grants = props.grants
        }
    }

    toJSON() {
        return {
            reference: this.reference?.toJSON(),
            grants: this.grants.map(grant => grant.toJSON())
        }
    }

    get schema(): GenericTree<SchemaTag> {
        const reference = this.reference?.schema
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
        console.log(`merging: ${JSON.stringify(incoming.toJSON(), null, 4)}`)
        const newGrants = incoming.grants.reduce((previous, grant) => {
            const base = previous.find(baseGrant => baseGrant.player === grant.player)
            console.log(`base: ${JSON.stringify(base?.toJSON(), null, 4)}`)
            if (base) {
                const previousWithoutMatch = previous.filter(baseGrant => baseGrant.player !== grant.player)
                const merged = mergeAuthWithEdits(base, grant)
                console.log(`merged: ${JSON.stringify(merged?.toJSON(), null, 4)}`)
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
        return new StandardAuthorizationResource({ reference: this.reference, grants: newGrants })
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
            return new StandardAuthorizationResource({ reference: this.reference, grants: newGrants })
        }
        else {
            return undefined
        }
    }   
}