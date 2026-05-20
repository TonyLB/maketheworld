import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardComponent, StandardComponentReferenceKey } from "./baseClasses"
import { StandardImageData } from "./dataTypes/image"
import { AssetUUID, ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { isSchemaImage } from "@tonylb/mtw-base/ts/schema/image";
import StandardReference from "../keys/reference";
import { StandardKey } from "../keys/key";
import { StandardExplicitParent } from "../explicit"
import { StandardLiteral } from "../literal"
import type { StandardizeFromSchemaContext } from "../wmlStandardizeMode"
import {
    createShortNameFromJSON,
    invertShortName,
    mergeShortName,
    shortNameSchemaChildren,
    shortNameToJSON,
    standardizeShortNameConsumer,
} from "./shortNameField"
import {
    processWithConsumers,
} from "./fromSchemaPipeline"

export class StandardImagePayload implements ComponentConstructorMethods<StandardImageData, StandardImageData> {
    _shortName?: StandardLiteral;
    tag = 'Image' as const;

    constructor(previous?: StandardImagePayload) {
        if (previous) {
            this._shortName = previous._shortName
        }
    }

    fromJSON(props: StandardImageData) {
        this._shortName = createShortNameFromJSON(props.shortName)
    }

    fromSchema(node: GenericTreeNode<SchemaTag>, _context?: StandardizeFromSchemaContext): GenericTree<SchemaTag> {
        if (treeNodeTypeguard(isSchemaImage)(node)) {
            const consumers = [
                standardizeShortNameConsumer(this),
            ]
            const returnRemainder = processWithConsumers(this, consumers, node.children)
            return returnRemainder
        }
        throw new Error('Schema mismatch in StandardImage constructor')
    }

    get shortName() { return this._shortName }

    toJSON(): Omit<StandardImageData, 'key' | 'universalKey'> {
        return {
            tag: 'Image',
            ...(this._shortName ? { shortName: shortNameToJSON(this._shortName) } : {})
        }
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Image', key },
            children: [
                ...shortNameSchemaChildren(this._shortName)
            ]
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardImagePayload()
        returnValue._shortName = mergeShortName(this._shortName, incoming._shortName)
        return returnValue as this
    }

    subset(): this {
        return new StandardImagePayload() as this
    }

    referencedKeys(): StandardComponentReferenceKey[] {
        return []
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        return this
    }

    isEmpty(): boolean {
        return !Boolean(this._shortName)
    }

    invert(): this {
        const returnValue = new StandardImagePayload()
        returnValue._shortName = invertShortName(this._shortName)
        return returnValue as this
    }
}

export class StandardImage extends componentClassFactory(StandardImagePayload, 'StandardImage') {

    override _wrap(instance: StandardComponent): this {
        return new StandardImage(instance as StandardImage) as this
    }

    override clone(): StandardImage {
        const returnValue = new StandardImage(this)
        returnValue._payload = new StandardImagePayload(this._payload)
        return returnValue
    }

}

export default StandardImage
