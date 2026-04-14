import { GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { StandardGrantData } from "./dataTypes/grant"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { NestedSchemaOptions, StandardComponentReferenceKey, StandardToJSONOptions } from "../../components/baseClasses";
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize";
import { unique } from "../../../list";
import { isSchemaGrant } from "@tonylb/mtw-base/ts/schema/authorization";
import { isSchemaTreeNode, nodeFromWML } from "../../../schema";
import { deepEqual } from "../../../lib/objects";
import { StandardAuthorizationItem } from "./baseClasses";
import { StandardAuthReplace } from "./edits";
import type { StandardizeFromSchemaContext } from "../../wmlStandardizeMode";

export class StandardGrantPayload {
    _player: string;
    _actions: string[];
    tag = 'Grant' as const;

    constructor(previous?: StandardGrantPayload) {
        if (previous) {
            this._player = `${previous.player}`
            this._actions = previous.actions ? [...previous.actions] : []
        }
        this._player = ''
        this._actions = []
    }

    fromJSON(props: StandardGrantData) {
        this._player = props.player
        this._actions = [...props.actions]
    }

    fromSchema(node: GenericTreeNode<SchemaTag>, _context?: StandardizeFromSchemaContext) {
        if (treeNodeTypeguard(isSchemaGrant)(node)) {
            this._player = node.data.player
            this._actions = [...node.data.actions]
            return
        }
        throw new Error('Schema mismatch in StandardGrant constructor')
    }

    get player() { return this._player }
    get actions() { return this._actions }

    toJSON(options?: StandardToJSONOptions): StandardGrantData {
        return {
            tag: 'Grant',
            player: this.player,
            actions: this.actions
        }
    }

    schema(): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Grant', player: this.player, actions: this.actions },
            children: []
        }
    }

    nestedSchema(byId: Record<string, StandardAuthorizationItem>, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        return this.schema()
    }

    merge(incoming: this): this {
        const returnValue = new StandardGrantPayload(this)
        if (incoming.player !== this.player) {
            throw new MergeConflictError(`Players do not match on merging grants: ${this.player} vs ${incoming.player}`)
        }
        returnValue._player = this.player
        returnValue._actions = unique(this.actions, incoming.actions)
        return returnValue as this
    }

    referencedKeys(): StandardComponentReferenceKey[] {
        return []
    }

}

export class StandardGrant implements StandardAuthorizationItem {
    _payload: StandardGrantPayload;
    constructor(props: string | StandardGrantData | GenericTreeNode<SchemaTag> | StandardGrant) {
        this._payload = new StandardGrantPayload()
        if (props instanceof StandardGrant) {
            this._payload = props._payload
            return
        }
        if (isSchemaTreeNode(props) || typeof props === 'string') {
            const node = typeof props === 'string'
                ? nodeFromWML(props)
                : props
            this._payload.fromSchema(node)
            return
        }
        this._payload.fromJSON(props)
    }

    get tag(): 'Grant' { return this._payload.tag }
    get player() { return this._payload.player }
    get actions() { return this._payload.actions }

    clone(): StandardGrant {
        return new StandardGrant(this)
    }

    toJSON(options?: StandardToJSONOptions): StandardGrantData {
        return this._payload.toJSON(options)
    }

    get schema(): GenericTreeNode<SchemaTag> {
        return this._payload.schema()
    }

    nestedSchema(byId: Record<string, StandardAuthorizationItem>, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        return this._payload.nestedSchema
            ? this._payload.nestedSchema(byId, options)
            : this._payload.schema()
    }

    //
    // The merge method at this level does *not* cope with edit-tags like Replace and Remove.
    // That functionality is handled at the StandardAuthorization level: Merge at the Component level
    // is strictly for merging the content of two non-edit Components. It will, however, merge
    // edit tags on the import and export information of the components
    //
    merge(incoming: StandardAuthorizationItem): StandardAuthorizationItem {
        const returnValue = new StandardGrant(this)
        returnValue._payload = this._payload.merge((incoming as any)._payload)

        return returnValue as StandardGrant
    }

    diff(incoming: StandardAuthorizationItem): StandardAuthorizationItem | undefined {
        if (deepEqual(this.toJSON(), incoming.toJSON())) {
            return undefined
        }
        else {
            return new StandardAuthReplace(this, incoming)
        }
    }

}

export default StandardGrant
