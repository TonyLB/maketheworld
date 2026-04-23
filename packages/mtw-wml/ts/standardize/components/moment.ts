import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { AssureReferencesResult, componentClassFactory, ComponentConstructorMethods } from "./component"
import { NestedSchemaOptions, StandardComponent, StandardComponentReferenceKey, StandardDiffOptions } from "./baseClasses"
import { StandardMomentData } from "./dataTypes/moment"
import { ReferenceFormat } from "./utils/references"
import { AssetUUID, ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaMoment } from "@tonylb/mtw-base/ts/schema/components"
import { ReferenceList } from "./reference"
import StandardReference from "../keys/reference"
import { StandardKey } from "../keys/key"
import { StandardReferenceData } from "./dataTypes/reference"
import { StandardExplicitParent } from "../explicit"
import { excludeUndefined } from "../../lib/lists"
import { renderReference } from "./utils/schema"
import { StandardLiteral } from "../literal"
import type { StandardizeFromSchemaContext } from "../wmlStandardizeMode"
import {
    processWithConsumers,
    StandardizeConsumerInline,
    StandardizeConsumerReferenceList,
    StandardizeConsumerStandardLiteral,
} from "./fromSchemaPipeline"

export class StandardMomentPayload implements ComponentConstructorMethods<StandardMomentData, StandardMomentData> {
    _shortName?: StandardLiteral;
    _messages: ReferenceList;
    tag = 'Moment' as const

    constructor(previous?: StandardMomentPayload) {
        if (previous) {
            this._shortName = previous._shortName
            this._messages = previous._messages.clone()
        }
        else {
            this._messages = new ReferenceList([])
        }
    }

    fromJSON(props: StandardMomentData) {
        this._shortName = props.shortName ? new StandardLiteral(props.shortName, { tag: 'ShortName' }) : undefined
        this._messages = new ReferenceList(props.messages?.map((reference) => (new StandardReference(reference))) ?? [])
    }

    fromSchema(node: GenericTreeNode<SchemaTag>, _context?: StandardizeFromSchemaContext): GenericTree<SchemaTag> {
        if (treeNodeTypeguard(isSchemaMoment)(node)) {
            const consumers = [
                new StandardizeConsumerStandardLiteral(this, {
                    tag: "ShortName",
                    update(literal) {
                        this._shortName = literal
                    },
                }),
                new StandardizeConsumerReferenceList(this, {
                    tag: "Message",
                    update(list) {
                        this._messages = list
                    },
                }),
                new StandardizeConsumerInline(),
            ]
            const returnRemainder = processWithConsumers(this, consumers, node.children)
            return returnRemainder
        }
        throw new Error('Schema mismatch in StandardMoment constructor')
    }

    get shortName() { return this._shortName }
    get messages() { return this._messages }

    toJSON(): Omit<StandardMomentData, 'key' | 'universalKey'> {
        return {
            tag: 'Moment',
            ...(this._shortName ? { shortName: this._shortName.toJSON() } : {}),
            ...(this.messages.payload.length ? { messages: this.messages.toJSON() } : {})
        }
    }

    schema(key: string, universalKey?: ComponentUUID, mappings?: StandardReference[]): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Moment', key, uuid: universalKey },
            children: [
                ...(this._shortName ? this._shortName.nestedSchema() : []),
                ...this.messages.schema
            ]
        }
    }

    nestedSchema(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { key } = options
        
        // If organization is available, use assured references from organization
        // Otherwise, fall back to stored reference lists
        let messagesToRender = this.messages
        let inlineRemainder: StandardReference[] = []

        if (options.organization) {
            // Get children from organization and assure references
            const children = options.organization.getChildrenOfParent(key) ?? []
            const { payload: assured, inlineRemainder: remainder } = this.assureReferences(children)
            messagesToRender = assured.messages
            inlineRemainder = remainder
        }

        return {
            data: { tag: 'Moment', key: key.key ?? '', uuid: key.universalKey },
            children: [
                ...(this._shortName ? this._shortName.nestedSchema() : []),
                ...messagesToRender.payload.map(renderReference({ lookup, options })).filter(excludeUndefined).flat(1),
                ...inlineRemainder.map(renderReference({ lookup, options })).filter(excludeUndefined),
            ]
        }
    }
    
    merge(incoming: this): this {
        const returnValue = new StandardMomentPayload()
        returnValue._shortName = (this._shortName && incoming._shortName) ? this._shortName.merge(incoming._shortName) : this._shortName ?? incoming._shortName
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
        returnValue._shortName = this._shortName ? this._shortName.invert() as StandardLiteral : undefined
        // Invert messages ReferenceList
        returnValue._messages = this._messages.invert()
        return returnValue as this
    }

    assureReferences(children: StandardReference[]): AssureReferencesResult<this> {
        const BUCKET_TAGS = ['Message'] as const
        const bucketChildren = children.filter(c => BUCKET_TAGS.includes(c.tag as (typeof BUCKET_TAGS)[number]))
        const remainder = children.filter(c => !BUCKET_TAGS.includes(c.tag as (typeof BUCKET_TAGS)[number]))

        const returnValue = new StandardMomentPayload(this)
        const messageReferences = new ReferenceList(
            bucketChildren.filter(child => child.tag === 'Message').map(child => child.withRef(0))
        )
        returnValue._messages = this._messages.merge(messageReferences, { cleanEmptyReferences: false }) ?? this._messages

        return {
            payload: returnValue as this,
            inlineRemainder: remainder.map(c => c.withRef(0))
        }
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
    get shortName() { return this._payload.shortName }
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
        const shortNameEqual = (this.shortName?.toJSON() ?? '') === (incoming.shortName?.toJSON() ?? '')
        return shortNameEqual && !(this.messages.diff(incoming.messages)?.payload?.length)
    }

}

export default StandardMoment
