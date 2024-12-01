import { excludeUndefined } from "../../lib/lists"
import { isSchemaCharacter, isSchemaFirstImpression, isSchemaImage, isSchemaName, isSchemaOneCoolThing, isSchemaOutfit, isSchemaOutputTag, isSchemaPronouns, isSchemaVariable, SchemaFirstImpressionTag, SchemaImageTag, SchemaNameTag, SchemaOneCoolThingTag, SchemaOutfitTag, SchemaOutputTag, SchemaPronounsTag, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode, GenericTreeNodeFiltered, treeNodeTypeguard } from "../../tree/baseClasses"
import { treeTypeGuard } from "../../tree/filter"
import { EditWrappedStandardNode, SerializeNDJSONMixin } from "../baseClasses"
import StandardComponentAbstract, { ComponentInterface } from "./abstract"
import { StandardComponentData } from "./dataTypes"
import { StandardCharacterData } from "./dataTypes/character"
import { isSchemaTreeNode } from "./utils"

export class StandardCharacter extends StandardComponentAbstract implements ComponentInterface {
    _name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    _firstImpression?: EditWrappedStandardNode<SchemaFirstImpressionTag, SchemaTag>;
    _oneCoolThing?: EditWrappedStandardNode<SchemaOneCoolThingTag, SchemaTag>;
    _outfit?: EditWrappedStandardNode<SchemaOutfitTag, SchemaTag>;
    _pronouns?: EditWrappedStandardNode<SchemaPronounsTag, SchemaTag>;
    _image?: EditWrappedStandardNode<SchemaImageTag, SchemaTag>;
    tag = 'Character' as const
    constructor(args: StandardCharacterData | GenericTreeNode<SchemaTag>) {
        super(args)
        if (typeof args === 'string' || !args) {
            this._pronouns = { children: [], data: { tag: 'Pronouns', subject: 'they', object: 'them', possessive: 'theirs', adjective: 'their', reflexive: 'themself' } }
        }
        else if (isSchemaTreeNode(args)) {
            const { data } = args
            if (!isSchemaCharacter(data)) {
                throw new Error('Type mismatch in StandardCharacter constructor')
            }
            this._pronouns = (args.children.find(treeNodeTypeguard(isSchemaPronouns)) ?? { children: [], data: { tag: 'Pronouns', subject: 'they', object: 'them', possessive: 'theirs', adjective: 'their', reflexive: 'themself' } })
            const confirmOutputChildren = <InputNode extends SchemaTag>(node: GenericTreeNodeFiltered<InputNode, SchemaTag> |  undefined): GenericTreeNodeFiltered<InputNode, SchemaOutputTag> | undefined => (node ? { data: node.data, children: treeTypeGuard({ tree: node.children, typeGuard: isSchemaOutputTag })} : undefined)
            this._name = confirmOutputChildren(args.children.find(treeNodeTypeguard(isSchemaName)))
            this._firstImpression = args.children.find(treeNodeTypeguard(isSchemaFirstImpression))
            this._oneCoolThing = args.children.find(treeNodeTypeguard(isSchemaOneCoolThing))
            this._outfit = args.children.find(treeNodeTypeguard(isSchemaOutfit))
            this._image = args.children.find(treeNodeTypeguard(isSchemaImage))
        }
        else {
            this._pronouns = args.pronouns
            this._name = args.name
            this._firstImpression = args.firstImpression
            this._oneCoolThing = args.oneCoolThing
            this._outfit = args.outfit
            this._image = args.image
        }
    }

    get pronouns() { return this._pronouns }
    get name() { return this._name }
    get firstImpression() { return this._firstImpression }
    get oneCoolThing() { return this._oneCoolThing }
    get outfit() { return this._outfit }
    get image() { return this._image }

    override toJSON(): StandardCharacterData {
        return {
            key: this.key,
            tag: 'Character',
            pronouns: this.pronouns,
            name: this.name,
            firstImpression: this.firstImpression,
            oneCoolThing: this.oneCoolThing,
            outfit: this.outfit,
            image: this.image
        }
    }

    toNDJSON(): StandardComponentData & SerializeNDJSONMixin { return this.toJSON() }

    override get schema(): GenericTreeNode<SchemaTag> {
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
            data: { tag: 'Character', key: this.key, Pronouns: pronounsFinalItem ?? { subject: 'they', object: 'them', possessive: 'theirs', adjective: 'their', reflexive: 'themself' } },
            children: [
                this.name,
                pronounsFinalItem ? { data: { ...pronounsFinalItem, tag: 'Pronouns' as const }, children: [] } : undefined,
                this.firstImpression,
                this.oneCoolThing,
                this.outfit,
                this.image
            ].filter(excludeUndefined).flat(1)
        }
    }

    override merge(incoming: this): this {
        if (!(incoming instanceof StandardCharacter)) {
            throw new Error('Type mistmatch on StandardComponent merge')
        }
        // const args: StandardCharacterData = {
        //     key: this.key,
        //     tag: 'Character',
        // }
        // return new StandardCharacter(args)
        return incoming
    }
}

export default StandardCharacter
