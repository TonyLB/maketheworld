import { excludeUndefined } from "../../lib/lists"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeFiltered, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { EditWrappedStandardNode } from "../baseClasses"
import { componentClassFactory, ComponentConstructorMethods, StandardComponent } from "./component"
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData"
import { StandardThemeData } from "./dataTypes/theme"
import { StandardExportItem, StandardImportItem } from "./metaData"
import { standardFieldToOutputNode } from "./utils"
import { outputNodeToStandardItem } from "./utils/constructor"
import { combineTaggedChildren } from "./utils/merge"
import { directReferenceKeys } from "./utils/references"
import { isSchemaName, SchemaNameTag } from "@tonylb/mtw-base/ts/schema/example"
import { isSchemaOutputTag, isSchemaPrompt, isSchemaTheme, SchemaOutputTag, SchemaPromptTag, SchemaTag } from "@tonylb/mtw-base/ts/schema"

export class StandardThemePayload implements ComponentConstructorMethods<StandardThemeData> {
    _name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    _prompts: GenericTreeFiltered<SchemaPromptTag, SchemaTag> = [];
    _rooms: GenericTree<SchemaTag> = [];
    _maps: GenericTree<SchemaTag> = [];
    tag = 'Theme' as const

    constructor(previous?: StandardThemePayload) {
        if (previous) {
            this._name = previous.name
            this._prompts = [...previous.prompts]
            this._rooms = [...previous.rooms]
            this._maps = [...previous.maps]
        }
    }

    fromJSON(props: StandardThemeData) {
        this._name = props.name
        this._prompts = props.prompts
        this._rooms = props.rooms
        this._maps = props.maps
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaTheme)(node)) {
            const tagTree = new SchemaTagTree(node.children)
            const nameItem = node.children.find(treeNodeTypeguard(isSchemaName))
            const promptTagTree = tagTree.filter({ match: 'Prompt' }).prune({ not: { match: 'Prompt' } })
            const roomTagTree = tagTree.filter({ match: 'Room' }).prune({ not: { match: 'Room' } })
            const mapsTagTree = tagTree.filter({ match: 'Map' }).prune({ not: { match: 'Map' }})
            this._name = outputNodeToStandardItem<SchemaNameTag, SchemaOutputTag>(nameItem, isSchemaName, isSchemaOutputTag, { tag: 'Name' })
            this._prompts = promptTagTree.tree.filter(treeNodeTypeguard(isSchemaPrompt))
            this._rooms = roomTagTree.tree
            this._maps = mapsTagTree.tree
            return
        }
        throw new Error('Schema mismatch in StandardMoment constructor')
    }

    get name() { return this._name }
    get prompts() { return this._prompts }
    get rooms() { return this._rooms }
    get maps() { return this._maps }

    toJSON(): Omit<StandardThemeData, 'key' | 'universalKey'> {
        return {
            tag: 'Theme',
            name: this.name,
            prompts: this.prompts,
            rooms: this.rooms,
            maps: this.maps
        }
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Theme', key },
            children: [
                ...[this.name].filter(excludeUndefined).filter(({ children }) => (children.length)).map(standardFieldToOutputNode).flat(1),
                ...this.prompts,
                ...this.rooms,
                ...this.maps
            ]
        }
    }

    merge(incoming: this): this {
        if (!(incoming instanceof StandardThemePayload)) {
            throw new Error('Source mismatch in StandardTheme merge')
        }
        const returnValue = new StandardThemePayload()
        returnValue._name = combineTaggedChildren(this.name, incoming.name) as EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>
        returnValue._prompts = applyEdits([...this.prompts, ...incoming.prompts]).filter(treeNodeTypeguard(isSchemaPrompt))
        returnValue._rooms = applyEdits([...this.rooms, ...incoming.rooms])
        returnValue._maps = applyEdits([...this.maps, ...incoming.maps])
        return returnValue as this
    }

    referencedKeys(): { key: string; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency" }[] {
        return directReferenceKeys([...this.rooms, ...this.maps])
            .map((key) => ({ referenceType: 'Direct', key }))
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        return this
    }
}

export class StandardTheme extends componentClassFactory(StandardThemePayload, 'StandardMoment') {
    get name() { return this._payload.name }
    get prompts() { return this._payload.prompts }
    get rooms() { return this._payload.rooms }
    get maps() { return this._payload.maps }

    override clone(): StandardTheme {
        const returnValue = new StandardTheme(this)
        returnValue._payload = new StandardThemePayload(this._payload)
        return returnValue
    }

    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardTheme(super.merge(incoming) as StandardTheme)
    }

    override withKey(key: string): StandardComponent {
        return new StandardTheme(super.withKey(key) as StandardTheme)
    }
    
    override withUniversalKey(key: string): StandardComponent {
        return new StandardTheme(super.withUniversalKey(key) as StandardTheme)
    }

    override withFileName(key: string): StandardComponent {
        return new StandardTheme(super.withFileName(key) as StandardTheme)
    }

    override withImport(importData: StandardImportItem | StandardComponentImport | undefined): StandardComponent {
        return new StandardTheme(super.withImport(importData) as StandardTheme)
    }

    override withExport(exportData: StandardExportItem | StandardComponentExport | string | undefined): StandardComponent {
        return new StandardTheme(super.withExport(exportData) as StandardTheme)
    }

}

export default StandardTheme
