import { GenericTree } from "@tonylb/mtw-base/ts/genericTree";
import StandardReference from "../components/reference";
import { StandardAuthorizationItem } from "./components/baseClasses";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { StandardAuthorizationResourceData } from "./components/dataTypes";

export class StandardAuthorizationResource {
    reference?: StandardReference;
    grants: StandardAuthorizationItem[] = [];

    constructor(props: { reference?: StandardReference; grants: StandardAuthorizationItem[] } | StandardAuthorizationResourceData) {
        if (props instanceof StandardAuthorizationResource) {
            this.reference = props.reference
            this.grants = props.grants
        }
        else {
            if (typeof props.reference !== 'object') {
                throw new Error('Invalid argument in StandardAuthorizationResource')
            }
            const { reference, grants } = props
            this.reference = reference as StandardReference;
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
        console.log(`reference: ${JSON.stringify(reference, null, 4)}`)
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
                const merged = base.merge(grant)
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
}