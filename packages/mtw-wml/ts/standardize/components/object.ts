import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { NestedSchemaOptions, StandardComponent, StandardComponentReferenceKey } from "./baseClasses"
import { StandardToJSONOptions } from "./baseClasses"
import { ReferenceFormat } from "./utils/references"
import { StandardObjectData } from "./dataTypes/object"
import { ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaObject } from "@tonylb/mtw-base/ts/schema/components"
import { StandardKey } from "../keys/key"
import StandardReference from "../keys/reference"
import { StandardFormSubsetRequest } from "../baseClasses"
import { StandardLiteral } from "../literal"
import type { StandardFormConstructionOptions, StandardizeFromSchemaContext } from "../wmlStandardizeMode"
import {
    createShortNameFromJSON,
    invertShortName,
    mergeShortName,
    shortNameSchemaChildren,
    shortNameToJSON,
    standardizeShortNameConsumer,
} from "./shortNameField"
import { processWithConsumers, StandardizeConsumerInline } from "./fromSchemaPipeline"
import { defaultedEquals } from "./utils"

export class StandardObjectPayload implements ComponentConstructorMethods<StandardObjectData, StandardObjectData> {
    _shortName?: StandardLiteral;
    tag = 'Object' as const

    constructor(previous?: StandardObjectPayload) {
        if (previous) {
            this._shortName = previous._shortName
        }
    }

    fromJSON(props: StandardObjectData) {
        const { shortName } = props
        this._shortName = createShortNameFromJSON(shortName)
    }

    fromSchema(node: GenericTreeNode<SchemaTag>, _context?: StandardizeFromSchemaContext): GenericTree<SchemaTag> {
        if (treeNodeTypeguard(isSchemaObject)(node)) {
            const consumers = [
                standardizeShortNameConsumer(this),
                new StandardizeConsumerInline(),
            ]

            const returnRemainder = processWithConsumers(this, consumers, node.children)
            return returnRemainder
        }
        throw new Error('Schema mismatch in StandardObject constructor')
    }

    get shortName() {
        return this._shortName
    }

    toJSON(_options?: StandardToJSONOptions): Omit<StandardObjectData, 'key' | 'universalKey'> {
        return {
            tag: 'Object',
            ...(this.shortName ? { shortName: shortNameToJSON(this.shortName) } : {}),
        }
    }

    schema(_key: string, universalKey?: ComponentUUID, _mappings?: StandardReference[]): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Object', uuid: universalKey },
            children: shortNameSchemaChildren(this.shortName),
        }
    }

    subset({ requestType }: StandardFormSubsetRequest): this {
        if (requestType === 'Full') {
            return new StandardObjectPayload(this) as this
        }
        return new StandardObjectPayload() as this
    }

    merge(incoming: this): this {
        const returnValue = new StandardObjectPayload()
        returnValue._shortName = mergeShortName(this._shortName, incoming._shortName)
        return returnValue as this
    }

    referencedKeys(_mapping: StandardReference[]): StandardComponentReferenceKey[] {
        return []
    }

    isEmpty(): boolean {
        return typeof this._shortName === 'undefined'
    }

    invert(): this {
        const returnValue = new StandardObjectPayload()
        returnValue._shortName = invertShortName(this._shortName)
        return returnValue as this
    }

    mapContents(_callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        return new StandardObjectPayload(this) as this
    }

    remapReferences(_props: { mappings: StandardReference[]; mapTo: ReferenceFormat }): this {
        return new StandardObjectPayload(this) as this
    }

    nestedSchema(_lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { key } = options
        return {
            data: { tag: 'Object', uuid: key.universalKey },
            children: shortNameSchemaChildren(this.shortName),
        }
    }
}

export class StandardObject extends componentClassFactory(StandardObjectPayload, 'StandardObject') {
    constructor(
        props: string | StandardObjectData | GenericTreeNode<SchemaTag> | StandardObject,
        options?: StandardFormConstructionOptions,
    ) {
        super(props, options)
    }

    override _wrap(instance: StandardComponent): this {
        return new StandardObject(instance as StandardObject) as this
    }

    override clone(): StandardObject {
        const returnValue = new StandardObject(this)
        returnValue._payload = new StandardObjectPayload(this._payload)
        return returnValue
    }

    override equals(incoming: StandardComponent): boolean {
        if (!(incoming instanceof StandardObject)) {
            return false
        }
        return defaultedEquals(this.shortName, incoming.shortName)
    }
}

export default StandardObject
