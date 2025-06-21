import { excludeUndefined } from "../../lib/lists"
import { GenericTree, GenericTreeNode, GenericTreeNodeFiltered, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { treeTypeGuard } from "../../tree/filter"
import { EditWrappedStandardNode } from "../baseClasses"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardCharacterData } from "./dataTypes/character"
import { isSchemaName, SchemaNameTag } from "@tonylb/mtw-base/ts/schema/example"
import { ComponentUUID, isSchemaCharacter, isSchemaOutputTag, SchemaOutputTag, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaImage, SchemaImageTag } from "@tonylb/mtw-base/ts/schema/image"
import { StandardLiteral } from "../literal"
import SchemaTagTree from "../../tagTree/schema"
import { StandardComponent, StandardDiffOptions } from "./baseClasses"
import { deepEqual } from "../../lib/objects"
import { StandardKey } from "./reference"

export class StandardCharacterPayload implements ComponentConstructorMethods<StandardCharacterData> {
    _name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
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
        this._name = props.name
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
            const confirmOutputChildren = <InputNode extends SchemaTag>(node: GenericTreeNodeFiltered<InputNode, SchemaTag> |  undefined): GenericTreeNodeFiltered<InputNode, SchemaOutputTag> | undefined => (node ? { data: node.data, children: treeTypeGuard({ tree: node.children, typeGuard: isSchemaOutputTag })} : undefined)
            this._name = confirmOutputChildren(node.children.find(treeNodeTypeguard(isSchemaName)))
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
            name: this.name,
            image: this.image,
        }
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Character', key },
            children: [
                ...[this.shortName].filter(excludeUndefined).map((shortName) => (shortName.nestedSchema({ tag: 'ShortName' }))).flat(1),
                ...[this.pronouns].filter(excludeUndefined).map((pronouns) => (pronouns.nestedSchema({ tag: 'Pronouns' }))).flat(1),
                this.name,
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
        return returnValue as this
    }

    subset(): this {
        return new StandardCharacterPayload() as this
    }

    referencedKeys(): { key: StandardKey; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency"; }[] {
        return []
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        return this
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

    override clone(): StandardCharacter {
        const returnValue = new StandardCharacter(this)
        returnValue._payload = new StandardCharacterPayload(this._payload)
        return returnValue
    }

    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardCharacter(super.merge(incoming) as StandardCharacter)
    }

    override diff(incoming: StandardComponent, options?: StandardDiffOptions): StandardComponent | undefined {
        if (!(incoming instanceof StandardCharacter)) {
            throw new Error('Mismatched component types in diff')
        }
        if (deepEqual(this.toJSON(), incoming.toJSON())) {
            return undefined
        }
        const base = new StandardCharacter(this.key ?? '')
        base._payload._shortName = this._payload._shortName
            ? this._payload._shortName.diff(incoming._payload._shortName)
            : incoming._payload._shortName
        base._payload._pronouns = this._payload._pronouns
            ? this._payload._pronouns.diff(incoming._payload._pronouns)
            : incoming._payload._pronouns
        return base
    }

    override withKey(key: string): StandardComponent {
        return new StandardCharacter(super.withKey(key) as StandardCharacter)
    }

    override withUniversalKey(key: ComponentUUID): StandardComponent {
        return new StandardCharacter(super.withUniversalKey(key) as StandardCharacter)
    }

    override withFileName(key: string): StandardComponent {
        return new StandardCharacter(super.withFileName(key) as StandardCharacter)
    }

}

export default StandardCharacter
