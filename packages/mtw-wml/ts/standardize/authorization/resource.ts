import { GenericTree } from "@tonylb/mtw-base/ts/genericTree";
import StandardReference from "../components/reference";
import { StandardAuthorizationItem } from "./components/baseClasses";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { StandardAuthorizationResourceData } from "./components/dataTypes";
import { mergeAuthWithEdits } from "./components/edits";
import StandardGrant from "./components/grant";

export class StandardAuthorizationResource {
    reference?: StandardReference;
    grants: StandardAuthorizationItem[] = [];

    constructor(props: { reference?: StandardReference; grants: StandardAuthorizationItem[] } | StandardAuthorizationResourceData) {
        if (props instanceof StandardAuthorizationResource) {
            this.reference = props.reference
            this.grants = props.grants
        }
        else {
            const { reference, grants } = props
            this.reference = reference as StandardReference | undefined;
            this.grants = grants as StandardAuthorizationItem[];
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
        const newGrants = incoming.grants.reduce((previous, grant) => {
            const base = previous.find(baseGrant => baseGrant.player === grant.player)
            if (base) {
                const merged = mergeAuthWithEdits(base, grant)
                if (merged) {
                    return [...previous.filter(baseGrant => baseGrant.player !== grant.player), merged]
                }
                else {
                    return previous
                }
            }
            else {
                return [...previous, grant]
            }
        }, this.grants)
        return new StandardAuthorizationResource({ reference: this.reference, grants: newGrants })
    }

    diff(incoming: StandardAuthorizationResource): StandardAuthorizationResource | undefined {
        const allPlayers = [...this.grants, ...incoming.grants].map(grant => grant.player)
        const newGrants = allPlayers.reduce((previous, player) => {
            const base = this.grants.find(baseGrant => baseGrant.player === player) ?? new StandardGrant({ tag: 'Grant', player, actions: [] })
            const incomingGrant = incoming.grants.find(incomingGrant => incomingGrant.player === player) ?? new StandardGrant({ tag: 'Grant', player, actions: [] })
            const diff = base.diff(incomingGrant)
            if (diff) {
                return [...previous, diff]
            }
            else {
                return previous
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