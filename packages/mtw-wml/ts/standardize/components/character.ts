import { excludeUndefined } from "../../lib/lists"
import { GenericTree, GenericTreeNode, GenericTreeNodeFiltered, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { treeTypeGuard } from "../../tree/filter"
import { EditWrappedStandardNode } from "../baseClasses"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardCharacterData } from "./dataTypes/character"
import { isSchemaName, SchemaNameTag } from "@tonylb/mtw-base/ts/schema/example"
import { isSchemaCharacter, isSchemaOutputTag, SchemaOutputTag, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaPronouns, SchemaPronounsTag } from "@tonylb/mtw-base/ts/schema/character"
import { isSchemaImage, SchemaImageTag } from "@tonylb/mtw-base/ts/schema/image"
import { StandardLiteral } from "../literal"
import SchemaTagTree from "../../tagTree/schema"

export class StandardCharacterPayload implements ComponentConstructorMethods<StandardCharacterData> {
    _name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    _shortName?: StandardLiteral;
    _pronouns?: EditWrappedStandardNode<SchemaPronounsTag, SchemaTag>;
    _image?: EditWrappedStandardNode<SchemaImageTag, SchemaTag>;
    tag = 'Character' as const

    fromJSON(props: StandardCharacterData) {
        const { shortName } = props
        this._shortName = shortName ? new StandardLiteral(shortName) : undefined
        this._name = props.name
        this._pronouns = props.pronouns
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
            this._pronouns = (node.children.find(treeNodeTypeguard(isSchemaPronouns)) ?? { children: [], data: { tag: 'Pronouns', subject: 'they', object: 'them', possessive: 'theirs', adjective: 'their', reflexive: 'themself' } })
            const confirmOutputChildren = <InputNode extends SchemaTag>(node: GenericTreeNodeFiltered<InputNode, SchemaTag> |  undefined): GenericTreeNodeFiltered<InputNode, SchemaOutputTag> | undefined => (node ? { data: node.data, children: treeTypeGuard({ tree: node.children, typeGuard: isSchemaOutputTag })} : undefined)
            this._name = confirmOutputChildren(node.children.find(treeNodeTypeguard(isSchemaName)))
            this._image = node.children.find(treeNodeTypeguard(isSchemaImage))
            return
        }
        throw new Error('Schema mismatch in StandardCharacter constructor')
    }

    get shortName() { return this._shortName }
    get name() { return this._name }
    get image() { return this._image }
    get pronouns() { return this._pronouns}

    toJSON(): Omit<StandardCharacterData, 'key' | 'universalKey'> {
        return {
            tag: 'Character',
            shortName: this?.shortName?.toJSON(),
            name: this.name,
            image: this.image,
            pronouns: this.pronouns
        }
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        const pronounsFinalItem: Omit<SchemaPronounsTag, 'tag'> | undefined = this.pronouns
            ? treeNodeTypeguard(isSchemaPronouns)(this.pronouns)
                ? (
                    (this.pronouns.data.subject === 'they') &&
                    (this.pronouns.data.object === 'them') &&
                    (this.pronouns.data.possessive === 'theirs') &&
                    (this.pronouns.data.adjective === 'their') &&
                    (this.pronouns.data.reflexive === 'themself')
                )
                    ? undefined
                    : this.pronouns.data
                : undefined
            : undefined
        return {
            data: { tag: 'Character', key, Pronouns: pronounsFinalItem ?? { subject: 'they', object: 'them', possessive: 'theirs', adjective: 'their', reflexive: 'themself' } },
            children: [
                ...[this.shortName].filter(excludeUndefined).map((shortName) => (shortName.nestedSchema({ tag: 'ShortName' }))).flat(1),
                this.name,
                pronounsFinalItem ? { data: { ...pronounsFinalItem, tag: 'Pronouns' as const }, children: [] } : undefined,
                this.image
            ].filter(excludeUndefined).flat(1)
        }
    }

    merge(incoming: this): this {
        if (!(incoming instanceof StandardCharacterPayload)) {
            throw new Error('Type mistmatch on StandardCharacter merge')
        }
        // const args: StandardCharacterData = {
        //     key: this.key,
        //     tag: 'Character',
        // }
        // return new StandardCharacter(args)
        return incoming
    }

    referencedKeys(): { key: string; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency"; }[] {
        return []
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        return this
    }
}

export class StandardCharacter extends componentClassFactory(StandardCharacterPayload, 'StandardCharacter') {
    get pronouns() { return this._payload.pronouns }
    get shortName() { return this._payload.shortName }
    get name() { return this._payload.name }
    get image() { return this._payload.image }
}

export default StandardCharacter
