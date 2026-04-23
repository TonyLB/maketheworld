import { excludeUndefined } from "../../lib/lists"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { EditWrappedStandardNode } from "../baseClasses"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardCharacterData } from "./dataTypes/character"
import { AssetUUID, ComponentUUID, isSchemaCharacter, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaImage, SchemaImageTag } from "@tonylb/mtw-base/ts/schema/image"
import { isSchemaDisplayName, SchemaDisplayNameTag } from "@tonylb/mtw-base/ts/schema/example"
import { StandardLiteral } from "../literal"
import type { StandardFormConstructionOptions, StandardizeFromSchemaContext } from "../wmlStandardizeMode"
import { StandardComponent, StandardComponentReferenceKey } from "./baseClasses"
import StandardReference from "../keys/reference"
import { StandardKey } from "../keys/key"
import { StandardRender } from "../render"
import { StandardExplicitParent } from "../explicit"
import {
    processWithConsumers,
    StandardizeConsumerRender,
    StandardizeConsumerSimple,
    StandardizeConsumerStandardLiteral,
} from "./fromSchemaPipeline"

export class StandardCharacterPayload implements ComponentConstructorMethods<StandardCharacterData, StandardCharacterData> {
    _displayName?: StandardLiteral;
    _shortName?: StandardLiteral;
    _pronouns?: StandardLiteral;
    _image?: EditWrappedStandardNode<SchemaImageTag, SchemaTag>;
    tag = 'Character' as const

    constructor(previous?: StandardCharacterPayload) {
        if (previous) {
            this._shortName = previous._shortName
            this._displayName = previous._displayName
            this._image = previous._image
            this._pronouns = previous._pronouns
        }
    }

    fromJSON(props: StandardCharacterData) {
        const { shortName, pronouns, displayName } = props
        this._shortName = shortName ? new StandardLiteral(shortName, { tag: 'ShortName' }) : undefined
        this._pronouns = pronouns ? new StandardLiteral(pronouns, { tag: 'Pronouns' }) : undefined
        this._displayName = displayName ? new StandardLiteral(displayName, { tag: 'DisplayName' }) : undefined
        this._image = props.image
    }

    fromSchema(node: GenericTreeNode<SchemaTag>, _context?: StandardizeFromSchemaContext): GenericTree<SchemaTag> {
        if (treeNodeTypeguard(isSchemaCharacter)(node)) {
            const consumers = [
                new StandardizeConsumerStandardLiteral(this, {
                    tag: "ShortName",
                    update(literal) {
                        this._shortName = literal
                    },
                }),
                new StandardizeConsumerStandardLiteral(this, {
                    tag: "Pronouns",
                    update(literal) {
                        this._pronouns = literal
                    },
                }),
                new StandardizeConsumerStandardLiteral(this, {
                    tag: "DisplayName",
                    update(literal) {
                        this._displayName = literal
                    },
                }),
                new StandardizeConsumerSimple(this, {
                    tag: "Image",
                    update(matched) {
                        const findImage = (nodes: GenericTree<SchemaTag>): EditWrappedStandardNode<SchemaImageTag, SchemaTag> | undefined => {
                            for (const node of nodes) {
                                if (treeNodeTypeguard(isSchemaImage)(node)) {
                                    return node as EditWrappedStandardNode<SchemaImageTag, SchemaTag>
                                }
                                const childFound = findImage(node.children)
                                if (childFound) {
                                    return childFound
                                }
                            }
                            return undefined
                        }
                        this._image = findImage(matched)
                    },
                }),
            ]
            const returnRemainder = processWithConsumers(this, consumers, node.children)
            return returnRemainder
        }
        throw new Error('Schema mismatch in StandardCharacter constructor')
    }

    get shortName() { return this._shortName }
    get pronouns() { return this._pronouns}
    get displayName() { return this._displayName }
    get image() { return this._image }

    toJSON(): Omit<StandardCharacterData, 'key' | 'universalKey'> {
        return {
            tag: 'Character',
            shortName: this?.shortName?.toJSON(),
            pronouns: this?.pronouns?.toJSON(),
            displayName: this.displayName?.toJSON(),
            image: this.image,
        }
    }

    schema(key: string, universalKey?: ComponentUUID, mappings?: StandardReference[]): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Character', key, uuid: universalKey },
            children: [
                ...[this.shortName].filter(excludeUndefined).map((shortName) => (shortName.nestedSchema())).flat(1),
                ...[this.pronouns].filter(excludeUndefined).map((pronouns) => (pronouns.nestedSchema())).flat(1),
                ...(this._displayName?.nestedSchema({ tag: 'DisplayName' }) ?? []),
                this.image
            ].filter(excludeUndefined).flat(1)
        }
    }

    merge(incoming: this): this {
        if (!(incoming instanceof StandardCharacterPayload)) {
            throw new Error('Type mistmatch on StandardCharacter merge')
        }
        const returnValue = new StandardCharacterPayload()
        returnValue._shortName = (this._shortName && incoming._shortName) ? this._shortName.merge(incoming._shortName) : this._shortName ?? incoming._shortName
        returnValue._pronouns = (this._pronouns && incoming._pronouns) ? this._pronouns.merge(incoming._pronouns) : this._pronouns ?? incoming._pronouns
        returnValue._displayName = (this._displayName && incoming._displayName) ? this._displayName.merge(incoming._displayName) : this._displayName ?? incoming._displayName
        returnValue._image = this._image ?? incoming._image
        return returnValue as this
    }

    subset(): this {
        return new StandardCharacterPayload() as this
    }

    referencedKeys(): StandardComponentReferenceKey[] {
        return []
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        return this
    }

    isEmpty(): boolean {
        // A character is empty if it has no displayName, shortName, pronouns, or image
        const hasDisplayName = Boolean(this._displayName)
        const hasShortName = Boolean(this._shortName)
        const hasPronouns = Boolean(this._pronouns)
        const hasImage = Boolean(this._image)
        return !(hasDisplayName || hasShortName || hasPronouns || hasImage)
    }

    invert(): this {
        const returnValue = new StandardCharacterPayload()
        // Invert shortName if it exists (StandardLiteral has invert() from standardEditableFactory)
        returnValue._shortName = this._shortName ? this._shortName.invert() as StandardLiteral : undefined
        // Invert pronouns if it exists (StandardLiteral has invert() from standardEditableFactory)
        returnValue._pronouns = this._pronouns ? this._pronouns.invert() as StandardLiteral : undefined
        // Invert displayName if it exists (StandardLiteral has invert())
        returnValue._displayName = this._displayName ? this._displayName.invert() as StandardLiteral : undefined
        // Leave _image unchanged (EditWrappedStandardNode doesn't have invert support)
        returnValue._image = this._image
        return returnValue as this
    }
}

export class StandardCharacter extends componentClassFactory(StandardCharacterPayload, 'StandardCharacter') {
    get shortName() { return this._payload.shortName }
    get pronouns() { return this._payload.pronouns }
    get displayName() { return this._payload.displayName }
    get image() { return this._payload.image }

    constructor(
        props: string | StandardCharacterData | GenericTreeNode<SchemaTag> | StandardCharacter,
        options?: StandardFormConstructionOptions,
    ) {
        super(props, options)
    }

    override _wrap(instance: StandardComponent): this {
        return new StandardCharacter(instance as StandardCharacter) as this
    }

    override clone(): StandardCharacter {
        const returnValue = new StandardCharacter(this)
        returnValue._payload = new StandardCharacterPayload(this._payload)
        return returnValue
    }

}

export default StandardCharacter
