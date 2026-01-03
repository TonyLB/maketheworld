import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { NestedSchemaOptions, StandardComponent, StandardComponentReferenceKey, StandardDiffOptions } from "./baseClasses"
import { StandardMomentData } from "./dataTypes/moment"
import { childReferenceFactory, ReferenceFormat } from "./utils/references"
import { AssetUUID, ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaMessage, isSchemaMoment } from "@tonylb/mtw-base/ts/schema/components"
import StandardReference, { ReferenceList } from "./reference"
import { StandardKey } from "../keys/key"
import { StandardReferenceData } from "./dataTypes/reference"
import { StandardExplicitParent } from "../explicit"
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
                    return childReferenceFactory(reference)
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
            ...(this.messages.payload.length ? { messages: this.messages.toJSON() } : {})
        }
    }

    schema(key: string, universalKey?: ComponentUUID, mappings?: StandardReference[]): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Moment', key, uuid: universalKey },
            children: this.messages.schema
        }
    }

    nestedSchema(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { key } = options
        
        // If organization is available, use assured references from organization
        // Otherwise, fall back to stored reference lists
        let messagesToRender = this.messages
        
        if (options.organization) {
            // Get children from organization and assure references
            const children = options.organization.getChildrenOfParent(key) ?? []
            const assured = this.assureReferences(children)
            messagesToRender = assured.messages
        }
        
        return {
            data: { tag: 'Moment', key: key.key ?? '', uuid: key.universalKey },
            children: messagesToRender.payload.map(renderReference({ lookup, options })).filter(excludeUndefined).flat(1)
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

    referencedKeys(): StandardComponentReferenceKey[] {
        return [
            ...this.messages.payload.map((reference) => ({ referenceType: 'Direct' as const, reference })),
            ...this.messages.payload.map((reference) => ({ referenceType: 'Dependency' as const, reference })),
        ]
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        return this
    }

    remapReferences(props: { mappings: StandardReference[]; mapTo: ReferenceFormat }): this {
        const returnValue = new StandardMomentPayload(this)
        returnValue._messages = returnValue._messages.toFormat(props.mapTo, props.mappings)
        return returnValue as this
    }
    
    withChild(child: StandardReference): this {
        const returnValue = new StandardMomentPayload(this)
        if (child.tag === 'Message') {
            returnValue._messages = returnValue._messages.assureItem(child)
        }
        else {
            throw new Error(`Invalid child type ${child.tag} for StandardMoment`)
        }
        return returnValue as this
    }

    isEmpty(): boolean {
        // A moment is empty if it has no messages
        return this._messages.payload.length === 0
    }

    invert(): this {
        const returnValue = new StandardMomentPayload()
        // Invert messages ReferenceList
        returnValue._messages = this._messages.invert()
        return returnValue as this
    }

    assureReferences(children: StandardReference[]): this {
        const returnValue = new StandardMomentPayload(this)
        
        // Filter and map children by type, creating references with ref={0}
        const messageReferences = new ReferenceList(
            children
                .filter(child => child.tag === 'Message')
                .map(child => child.withRef(0))
        )
        
        // Merge with existing bucket, preserving ref={0} references
        // cleanEmptyReferences: false ensures ref={0} entries are preserved when merging
        returnValue._messages = this._messages.merge(messageReferences, { cleanEmptyReferences: false }) ?? this._messages
        
        return returnValue as this
    }

    removeReferences(references: StandardReference[]): this {
        const returnValue = new StandardMomentPayload(this)
        
        // Filter reference list by removing items that match any reference in the input
        returnValue._messages = this._messages.filter(
            item => !references.some(ref => item.sameKey(ref))
        )
        
        return returnValue as this
    }

}

export class StandardMoment extends componentClassFactory(StandardMomentPayload, 'StandardMoment') {
    get messages() { return this._payload.messages }

    override _wrap(instance: StandardComponent): this {
        return new StandardMoment(instance as StandardMoment) as this
    }

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

}

export default StandardMoment
