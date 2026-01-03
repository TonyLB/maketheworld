import { excludeUndefined } from "../../lib/lists"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { EditWrappedStandardNode } from "../baseClasses"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardCharacterData } from "./dataTypes/character"
import { AssetUUID, ComponentUUID, isSchemaCharacter, isSchemaOutputTag, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaImage, SchemaImageTag } from "@tonylb/mtw-base/ts/schema/image"
import { StandardLiteral } from "../literal"
import SchemaTagTree from "../../tagTree/schema"
import { StandardComponent, StandardComponentReferenceKey, StandardDiffOptions } from "./baseClasses"
import { deepEqual } from "../../lib/objects"
import StandardReference from "./reference"
import { StandardKey } from "../keys/key"
import { StandardRender } from "../render"
import { rebuildSchemaFromStandardRender } from "./utils/extractStandardRender"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import { StandardExplicitParent } from "../explicit"

export class StandardCharacterPayload implements ComponentConstructorMethods<StandardCharacterData> {
    _name?: StandardRender;
    _shortName?: StandardLiteral;
    _pronouns?: StandardLiteral;
    _image?: EditWrappedStandardNode<SchemaImageTag, SchemaTag>;
    tag = 'Character' as const

    constructor(previous?: StandardCharacterPayload) {
        if (previous) {
            this._shortName = previous._shortName
            this._name = previous._name
            this._image = previous._image
            this._pronouns = previous._pronouns
        }
    }

    fromJSON(props: StandardCharacterData) {
        const { shortName, pronouns } = props
        this._shortName = shortName ? new StandardLiteral(shortName) : undefined
        this._pronouns = pronouns ? new StandardLiteral(pronouns) : undefined
        this._name = props.name ? new StandardRender(props.name) : undefined
        this._image = props.image
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaCharacter)(node)) {
            const tagTree = new SchemaTagTree(node.children)
            const shortNameItem = tagTree
                .filter({ match: 'ShortName' })
                .prune({ not: { or: [{ match: 'String' }, { match: 'Remove' }, { match: 'Replace' }, { match: 'ReplaceMatch' }, { match: 'ReplacePayload' }] } })
                .tree
            this._shortName = shortNameItem.length ? new StandardLiteral(shortNameItem) : undefined
            const pronounsItem = tagTree
                .filter({ match: 'Pronouns' })
                .prune({ not: { or: [{ match: 'String' }, { match: 'Remove' }, { match: 'Replace' }, { match: 'ReplaceMatch' }, { match: 'ReplacePayload' }] } })
                .tree
            this._pronouns = pronounsItem.length ? new StandardLiteral(pronounsItem) : undefined
            const nameItem = tagTree.filter({ match: 'Name' }).prune({ match: 'Name' }).tree.filter(wrappedNodeTypeGuard(isSchemaOutputTag))
            if (nameItem.length) {
                this._name = new StandardRender(nameItem)
            }
            this._image = node.children.find(treeNodeTypeguard(isSchemaImage))
            return
        }
        throw new Error('Schema mismatch in StandardCharacter constructor')
    }

    get shortName() { return this._shortName }
    get pronouns() { return this._pronouns}
    get name() { return this._name }
    get image() { return this._image }

    toJSON(): Omit<StandardCharacterData, 'key' | 'universalKey'> {
        return {
            tag: 'Character',
            shortName: this?.shortName?.toJSON(),
            pronouns: this?.pronouns?.toJSON(),
            name: this.name?.toJSON(),
            image: this.image,
        }
    }

    schema(key: string, universalKey?: ComponentUUID, mappings?: StandardReference[]): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Character', key, uuid: universalKey },
            children: [
                ...[this.shortName].filter(excludeUndefined).map((shortName) => (shortName.nestedSchema({ tag: 'ShortName' }))).flat(1),
                ...[this.pronouns].filter(excludeUndefined).map((pronouns) => (pronouns.nestedSchema({ tag: 'Pronouns' }))).flat(1),
                rebuildSchemaFromStandardRender(this._name, { tag: 'Name' }, mappings),
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
        returnValue._name = (this._name && incoming._name) ? this._name.merge(incoming._name) : this._name ?? incoming._name
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
        // A character is empty if it has no name, shortName, pronouns, or image
        const hasName = Boolean(this._name)
        const hasShortName = Boolean(this._shortName)
        const hasPronouns = Boolean(this._pronouns)
        const hasImage = Boolean(this._image)
        return !(hasName || hasShortName || hasPronouns || hasImage)
    }

    invert(): this {
        const returnValue = new StandardCharacterPayload()
        // Invert shortName if it exists (StandardLiteral has invert() from v2StandardEditableFactory)
        returnValue._shortName = this._shortName ? this._shortName.invert() as StandardLiteral : undefined
        // Invert pronouns if it exists (StandardLiteral has invert() from v2StandardEditableFactory)
        returnValue._pronouns = this._pronouns ? this._pronouns.invert() as StandardLiteral : undefined
        // Invert name if it exists (StandardRender has invert())
        returnValue._name = this._name ? this._name.invert() : undefined
        // Leave _image unchanged (EditWrappedStandardNode doesn't have invert support)
        returnValue._image = this._image
        return returnValue as this
    }
}

export class StandardCharacter extends componentClassFactory(StandardCharacterPayload, 'StandardCharacter') {
    get shortName() { return this._payload.shortName }
    get pronouns() { return this._payload.pronouns }
    get name() { return this._payload.name }
    get image() { return this._payload.image }

    constructor(props: string | StandardCharacterData | GenericTreeNode<SchemaTag> | StandardCharacter) {
        super(props)
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
