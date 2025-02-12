import { deepEqual } from "../../../lib/objects";
import { GenericTree, GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree";
import { NestedSchemaOptions, StandardComponent } from "../../components/baseClasses";
import { StandardAuthNonEditData, StandardAuthRemoveData, StandardAuthReplaceData } from "./dataTypes";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize"
import { StandardAuthorizationItem } from "./baseClasses";
import StandardGrant from "./grant";

//
// StandardRemove class provides a class that contains a matching StandardComponent to be removed. Note that merge
// methods at this level do NOT contain the functionality to handle component-level edits ... that is included
// at the StandardForm level, rather than on the individual component classes.
//
export class StandardAuthRemove implements StandardAuthorizationItem {
    _match: StandardAuthorizationItem;
    tag: 'Grant' | 'Remove' | 'Replace' = 'Remove' as const;
    constructor(props: StandardAuthRemove | StandardAuthorizationItem) {
        if (props instanceof StandardAuthRemove) {
            this._match = props._match.clone()
            return
        }
        this._match = props as StandardAuthorizationItem
        return
    }

    get player() { return this._match.player }
    
    clone(): StandardAuthRemove {
        return new StandardAuthRemove(this)
    }

    toJSON(): StandardAuthRemoveData {
        return {
            tag: 'Remove',
            component: this._match.toJSON() as StandardAuthNonEditData
        }
    }

    get schema(): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Remove' },
            children: [this._match.schema]
        }
    }

    nestedSchema(byId: Record<string, StandardAuthorizationItem>, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { removeContext} = options
        if (removeContext) {
            return this._match.nestedSchema(byId, options)
        }
        return {
            data: { tag: 'Remove' },
            children: [this._match.nestedSchema(byId, { ...options, removeContext: true })]
        }
    }

    merge(incoming: StandardAuthorizationItem): StandardAuthorizationItem | undefined {
        throw new Error('StandardRemove types cannot be directly merged')
    }

    diff(incoming: StandardAuthorizationItem): StandardAuthorizationItem | undefined {
        return undefined
    }

}

//
// StandardReplace class provides a class that contains a matching StandardComponent to be removed. Note that merge
// methods at this level do NOT contain the functionality to handle component-level edits ... that is included
// at the StandardForm level, rather than on the individual component classes.
//
export class StandardAuthReplace implements StandardAuthorizationItem {
    _match: StandardAuthorizationItem;
    _payload: StandardAuthorizationItem;
    tag: 'Grant' | 'Remove' | 'Replace' = 'Replace' as const;
    constructor(...propsArray: [StandardAuthReplace] | [StandardAuthorizationItem, StandardAuthorizationItem]) {
        if (propsArray.length > 1) {
            const match = propsArray[0] as StandardAuthorizationItem
            const payload = propsArray[1] as StandardAuthorizationItem
            this._match = match
            this._payload = payload
            return
        }
        const [props] = propsArray as [string | StandardAuthReplaceData | GenericTreeNode<SchemaTag> | StandardAuthReplace]
        if (props instanceof StandardAuthReplace) {
            this._match = props._match.clone()
            this._payload = props._payload.clone()
            return
        }
        throw new Error('StandardReplace constructor called with invalid arguments')
    }

    get player() { return this._match.player }

    clone(): StandardAuthorizationItem {
        return new StandardAuthReplace(this)
    }

    toJSON(): StandardAuthReplaceData {
        return {
            tag: 'Replace',
            match: this._match.toJSON() as StandardAuthNonEditData,
            payload: this._payload.toJSON() as StandardAuthNonEditData
        }
    }

    get schema(): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Replace' },
            children: [
                { data: { tag: 'ReplaceMatch' }, children: [this._match.schema] },
                { data: { tag: 'ReplacePayload' }, children: [this._payload.schema] }
            ]
        }
    }

    nestedSchema(byId: Record<string, StandardAuthorizationItem>, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Replace' },
            children: [
                { data: { tag: 'ReplaceMatch' }, children: [this._match.nestedSchema(byId, options)] },
                { data: { tag: 'ReplacePayload' }, children: [this._payload.nestedSchema(byId, options)] }
            ]
        }
    }

    merge(incoming: StandardAuthorizationItem): StandardAuthorizationItem | undefined {
        if (!(incoming instanceof StandardAuthReplace)) {
            throw new Error('Type mismatch in StandardReplace merge')
        }
        if (!(deepEqual(this._payload.toJSON(), incoming._match.toJSON()))) {
            throw new MergeConflictError()
        }
        return new StandardAuthReplace(this, incoming._payload)
    }

    diff(incoming: StandardAuthorizationItem): StandardAuthorizationItem | undefined {
        return undefined
    }

}

export const mergeAuthWithEdits = (base: StandardAuthorizationItem, incomingComponent: StandardAuthorizationItem): StandardAuthorizationItem | undefined => {
    //
    // Branch out to the several possible cases of combining edit tags and/or content
    //
    if (base) {
        if (incomingComponent) {
            if (base instanceof StandardAuthRemove) {
                if (incomingComponent instanceof StandardAuthRemove) {
                    throw new Error('StandardRemove types cannot be directly merged')
                }
                if (incomingComponent instanceof StandardAuthReplace) {
                    throw new MergeConflictError()
                }
                //
                // A remove operation followed by an add should be merged into a Replace
                //
                return new StandardAuthReplace(base._match, incomingComponent)
            }
            else if (base instanceof StandardAuthReplace) {
                //
                // A replace followed by a remove should be merged into a remove of the original content
                //
                if (incomingComponent instanceof StandardAuthRemove) {
                    if (!deepEqual(base._payload.toJSON(), incomingComponent._match.toJSON())) {
                        throw new MergeConflictError()
                    }
                    return new StandardAuthRemove(base._match)
                }
                //
                // Two replace operations should be merged into a single chained operation
                //
                if (incomingComponent instanceof StandardAuthReplace) {
                    if (!deepEqual(base._payload.toJSON(), incomingComponent._match.toJSON())) {
                        throw new MergeConflictError()
                    }
                    return new StandardAuthReplace(base._match, incomingComponent._payload)
                }
                //
                // A replace operation followed by more content should be merged to a replace with combined payload
                //
                const mergedPayload = base._payload.merge(incomingComponent)
                if (!mergedPayload) {
                    throw new MergeConflictError()
                }
                return new StandardAuthReplace(base._match, mergedPayload)
            }
            else {
                //
                // Remove should evaluate the match and then remove the relevant component
                //
                if (incomingComponent instanceof StandardAuthRemove) {
                    if (!deepEqual(base.toJSON(), incomingComponent._match.toJSON())) {
                        throw new MergeConflictError()
                    }
                    return undefined
                }
                //
                // Replace should evaluate the match and then replace the relevant component
                //
                if (incomingComponent instanceof StandardAuthReplace) {
                    if (!deepEqual(base.toJSON(), incomingComponent._match.toJSON())) {
                        throw new MergeConflictError()
                    }
                    return incomingComponent._payload
                }
                return base.merge(incomingComponent as any)
            }
        }
        else {
            return base
        }
    }
    else {
        return incomingComponent
    }
}
