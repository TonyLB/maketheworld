import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { NestedSchemaOptions, StandardComponent, StandardDiffOptions } from "./baseClasses"
import { StandardMomentData } from "./dataTypes/moment"
import { assureItemInReferenceList, childReferenceFactory, mapReferenceToFormat, mergeUniqueReferences, ReferenceFormat } from "./utils/references"
import { AssetUUID, ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaMessage, isSchemaMoment } from "@tonylb/mtw-base/ts/schema/components"
import StandardReference, { diffStandardReferenceList, ReferenceList, StandardKey } from "./reference"
import { deepEqual } from "../../lib/objects"
import { StandardReferenceData } from "./dataTypes/reference"
import { excludeUndefined } from "../../lib/lists"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import { isSchemaRemove } from "@tonylb/mtw-base/ts/schema/edit"
import { renderReference } from "./utils/schema"

export class StandardMomentPayload implements ComponentConstructorMethods<StandardMomentData> {
    _messages: ReferenceList;
    tag = 'Moment' as const

    constructor(previous?: StandardMomentPayload) {
        if (previous) {
            this._messages = previous._messages.clone()
        }
        else {
            this._messages = new ReferenceList([])
        }
    }

    fromJSON(props: StandardMomentData) {
        this._messages = new ReferenceList(props.messages?.map((reference) => (new StandardReference(reference))) ?? [])
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaMoment)(node)) {
            this._messages = new ReferenceList(node.children.filter(wrappedNodeTypeGuard(isSchemaMessage)).map((reference) => {
                if (treeNodeTypeguard(isSchemaMessage)(reference) || treeNodeTypeguard(isSchemaRemove)(reference)) {
                    return childReferenceFactory([reference])
                }
                throw new Error('Schema mismatch in StandardMoment constructor')
            }))
            return
        }
        throw new Error('Schema mismatch in StandardMoment constructor')
    }

    get messages() { return this._messages }

    toJSON(): Omit<StandardMomentData, 'key' | 'universalKey'> {
        return {
            tag: 'Moment',
            messages: this.messages.toJSON()
        }
    }

    schema(key: string, universalKey?: ComponentUUID): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Moment', key, uuid: universalKey },
            children: this.messages.schema
        }
    }

    nestedSchema(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { key } = options
        return {
            data: key.schema[0].data,
            children: this.messages.payload.map(renderReference({ lookup, options })).filter(excludeUndefined).flat(1)
        }
    }
    
    merge(incoming: this): this {
        const returnValue = new StandardMomentPayload()
        returnValue._messages = this.messages.merge(incoming.messages) ?? new ReferenceList([])
        return returnValue as this
    }

    subset(): this {
        return new StandardMomentPayload() as this
    }

    referencedKeys(): { key: StandardKey; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency" }[] {
        return [
            ...this.messages.payload.map((reference) => ({ referenceType: 'Direct' as const, key: reference._payload.plain })),
            ...this.messages.payload.map((reference) => ({ referenceType: 'Dependency' as const, key: reference._payload.plain })),
        ]
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        return this
    }

    remapReferences(props: { mappings: StandardKey[]; mapTo: ReferenceFormat }): this {
        const returnValue = new StandardMomentPayload(this)
        const mapReference = mapReferenceToFormat(props.mappings, props.mapTo)
        returnValue._messages = returnValue._messages.map(mapReference as any)
        return returnValue as this
    }
    
    withChild(child: StandardReference): this {
        const returnValue = new StandardMomentPayload(this)
        if (child._payload.plain.tag === 'Message') {
            returnValue._messages = returnValue._messages.assureItem(child)
        }
        else {
            throw new Error(`Invalid child type ${child._payload.tag} for StandardMoment`)
        }
        return returnValue as this
    }

}

export class StandardMoment extends componentClassFactory(StandardMomentPayload, 'StandardMoment') {
    get messages() { return this._payload.messages }

    override clone(): StandardMoment {
        const returnValue = new StandardMoment(this)
        returnValue._payload = new StandardMomentPayload(this._payload)
        return returnValue
    }

    override equals(incoming: StandardComponent): boolean {
        if (!(incoming instanceof StandardMoment)) {
            return false
        }
        return !(this.messages.diff(incoming.messages)?.payload?.length)
    }

    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardMoment(super.merge(incoming) as StandardMoment)
    }

    override diff(incoming: StandardComponent, options?: StandardDiffOptions): StandardComponent | undefined {
        if (!(incoming instanceof StandardMoment)) {
            throw new Error('Mismatched component types in diff')
        }
        const messagesDiff = this._payload._messages.diff(incoming._payload._messages) ?? new ReferenceList([])
        if (deepEqual(this.toJSON(), incoming.toJSON()) && !messagesDiff.payload.length) {
            return undefined
        }
        const base = this.clone()
        base._payload = new StandardMomentPayload()
        base._payload._messages = messagesDiff
        return base
    }

    override withKey(key: string): StandardComponent {
        return new StandardMoment(super.withKey(key) as StandardMoment)
    }
    
    override withUniversalKey(key: ComponentUUID): StandardComponent {
        return new StandardMoment(super.withUniversalKey(key) as StandardMoment)
    }

    override withFileName(key: string): StandardComponent {
        return new StandardMoment(super.withFileName(key) as StandardMoment)
    }

    override withMapping(mapping: StandardKey[]): StandardComponent {
        return new StandardMoment(super.withMapping(mapping) as StandardMoment)
    }

    override withImport(fromAsset: AssetUUID): StandardComponent {
        return new StandardMoment(super.withImport(fromAsset) as StandardMoment)
    }

}

export default StandardMoment
