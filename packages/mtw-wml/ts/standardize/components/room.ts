import { defaultSelected } from ".."
import { excludeUndefined } from "../../lib/lists"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeFiltered, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { EditWrappedStandardNode } from "../baseClasses"
import { HasShortName } from "./abstract"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardComponent } from "./baseClasses"
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData"
import { StandardRoomData } from "./dataTypes/room"
import { StandardExportItem, StandardImportItem } from "./metaData"
import linkReferenceKeys, { dependencyReferenceKeys, exitReferenceKeys, mergeUniqueReferences } from "./utils/references"
import { StandardRender } from "../render"
import { extractStandardRender, rebuildSchemaFromStandardRender } from "./utils/extractStandardRender"
import { stripUIFields } from "../render/utils"
import { StandardToJSONOptions } from "./baseClasses"
import StandardReference from "./reference"
import { StandardReferenceData } from "./dataTypes/reference"
import { SchemaOutputTag, SchemaTag, SchemaThemeTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaFeature, isSchemaRoom, isSchemaShortName, SchemaShortNameTag } from "@tonylb/mtw-base/ts/schema/components"
import { isSchemaDescription, isSchemaExample, isSchemaName, isSchemaSummary, SchemaDescriptionTag, SchemaNameTag, SchemaSummaryTag } from "@tonylb/mtw-base/ts/schema/example"
import { StandardRemove } from "./edits"

export class StandardRoomPayload implements HasShortName, ComponentConstructorMethods<StandardRoomData> {
    _shortName?: StandardRender;
    _name?: StandardRender;
    _summary?: StandardRender;
    _description?: StandardRender;
    _exits: GenericTree<SchemaTag> = [];
    _themes: GenericTreeFiltered<SchemaThemeTag, SchemaTag> = [];
    _features: (StandardReference | StandardRemove)[] = [];
    _examples: (StandardReference | StandardRemove)[] = [];
    tag = 'Room' as const

    constructor(previous?: StandardRoomPayload) {
        if (previous) {
            this._shortName = previous._shortName
            this._name = previous._name
            this._summary = previous._summary
            this._description = previous._description
            this._exits = [...previous.exits]
            this._themes = [...previous.themes]
            this._features = previous._features.map((reference) => (reference.clone()))
            this._examples = previous._examples.map((reference) => (reference.clone()))
        }
    }

    fromJSON(props: StandardRoomData) {
        const { shortName, name, summary, description } = props
        this._shortName = extractStandardRender(shortName, isSchemaShortName, 'Schema mismatch in StandardRoom constructor')
        this._name = extractStandardRender(name, isSchemaName, 'Schema mismatch in StandardRoom constructor')
        this._summary = extractStandardRender(summary, isSchemaSummary, 'Schema mismatch in StandardRoom constructor')
        this._description = extractStandardRender(description, isSchemaDescription, 'Schema mismatch in StandardRoom constructor')
        this._exits = props.exits
        this._themes = props.themes
        this._features = props.features?.map((reference) => (new StandardReference(reference))) ?? []
        this._examples = props.examples?.map((reference) => (new StandardReference(reference))) ?? []
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaRoom)(node)) {
            const tagTree = new SchemaTagTree(node.children)
            const shortNameItem = tagTree.filter({ match: 'ShortName' }).tree.find(wrappedNodeTypeGuard(isSchemaShortName))
            const nameItem = tagTree.filter({ match: 'Name' }).tree.find(wrappedNodeTypeGuard(isSchemaName))
            const summaryItem = tagTree.filter({ match: 'Summary' }).tree.find(wrappedNodeTypeGuard(isSchemaSummary))
            const descriptionItem = tagTree.filter({ match: 'Description' }).tree.find(wrappedNodeTypeGuard(isSchemaDescription))
            const exitTagTree = tagTree
                .filter({ match: 'Exit' })
                .reorderedSiblings([['Room', 'Exit'], ['If']])
            this._shortName = extractStandardRender<SchemaShortNameTag>(shortNameItem as EditWrappedStandardNode<SchemaShortNameTag, SchemaOutputTag>, isSchemaShortName, 'Schema mismatch in StandardRoom constructor')
            this._name = extractStandardRender<SchemaNameTag>(nameItem as EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>, isSchemaName, 'Schema mismatch in StandardRoom constructor')
            this._summary = extractStandardRender<SchemaSummaryTag>(summaryItem as EditWrappedStandardNode<SchemaSummaryTag, SchemaOutputTag>, isSchemaSummary, 'Schema mismatch in StandardRoom constructor')
            this._description = extractStandardRender<SchemaDescriptionTag>(descriptionItem as EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>, isSchemaDescription, 'Schema mismatch in StandardRoom constructor')
            this._exits = defaultSelected(exitTagTree.tree)
            this._themes = []
            this._features = node.children.filter(treeNodeTypeguard(isSchemaFeature)).map((reference) => (new StandardReference(reference)))
            this._examples = node.children.filter(treeNodeTypeguard(isSchemaExample)).map((reference) => (new StandardReference(reference)))
            return
        }
        throw new Error('Schema mismatch in StandardRoom constructor')
    }

    get shortName() { return rebuildSchemaFromStandardRender(this._shortName, { tag: 'ShortName' as const }) }
    get name() { return rebuildSchemaFromStandardRender(this._name, { tag: 'Name' as const }) }
    get summary() { return rebuildSchemaFromStandardRender(this._summary, { tag: 'Summary' as const }) }
    get description() { return rebuildSchemaFromStandardRender(this._description, { tag: 'Description' as const }) }
    get exits() { return this._exits }
    get themes() { return this._themes }
    get features() { return this._features }
    get examples() { return this._examples }

    toJSON(options?: StandardToJSONOptions): Omit<StandardRoomData, 'key' | 'universalKey'> {
        const { stripUIFields: stripUI } = options ?? {}
        return {
            tag: 'Room',
            shortName: stripUI
                ? rebuildSchemaFromStandardRender(this._shortName?.mapContents(stripUIFields), { tag: 'ShortName' as const })
                : this.shortName,
            name: stripUI
                ? rebuildSchemaFromStandardRender(this._name?.mapContents(stripUIFields), { tag: 'Name' as const })
                : this.name,
            summary: stripUI
                ? rebuildSchemaFromStandardRender(this._summary?.mapContents(stripUIFields), { tag: 'Summary' as const })
                : this.summary,
            description: stripUI
                ? rebuildSchemaFromStandardRender(this._description?.mapContents(stripUIFields), { tag: 'Description' as const })
                : this.description,
            exits: stripUI ? stripUIFields(this.exits) : this.exits,
            themes: this.themes,
            ...(this.features.length ? { features: this.features.map((reference) => (reference.toJSON() as StandardReferenceData)) } : {}),
            ...(this.examples.length ? { examples: this.examples.map((reference) => (reference.toJSON() as StandardReferenceData)) } : {})
        }
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Room', key },
            children: [
                ...[this.shortName].filter(excludeUndefined).filter(({ children }) => (children.length)),
                ...this.features.map((reference) => (reference.schema)),
                ...this.examples.map((reference) => (reference.schema)),
                ...[this.name, this.summary, this.description].filter(excludeUndefined).filter(({ children }) => (children.length)),
                ...this.exits
            ]
        }
    }

    nestedSchema(byId: Record<string, StandardComponent>, key: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Room', key },
            children: [
                ...[this.shortName].filter(excludeUndefined).filter(({ children }) => (children.length)),
                ...this.features.map((reference) => (
                    reference.global
                        ? reference.schema
                        : byId[`${key}.${reference.key}`]?.nestedSchema(byId, reference.key, `${key}.${reference.key}`)
                )).filter(excludeUndefined),
                ...this.examples.map((reference) => (
                    reference.global
                        ? reference.schema
                        : byId[`${key}.${reference.key}`]?.nestedSchema(byId, reference.key, `${key}.${reference.key}`)
                )).filter(excludeUndefined),
                ...[this.name, this.summary, this.description].filter(excludeUndefined).filter(({ children }) => (children.length)),
                ...this.exits
            ]
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardRoomPayload()
        returnValue._shortName = (this._shortName && incoming._shortName) ? this._shortName.merge(incoming._shortName) : this._shortName ?? incoming._shortName
        returnValue._name = (this._name && incoming._name) ? this._name.merge(incoming._name) : this._name ?? incoming._name
        returnValue._summary = (this._summary && incoming._summary) ? this._summary.merge(incoming._summary) : this._summary ?? incoming._summary
        returnValue._description = (this._description && incoming._description) ? this._description.merge(incoming._description) : this._description ?? incoming._description
        returnValue._exits = applyEdits([...this.exits, ...incoming.exits])
        returnValue._themes = [...this.themes, ...incoming.themes]
        returnValue._features = mergeUniqueReferences(this.features, incoming.features)
        returnValue._examples = mergeUniqueReferences(this.examples, incoming.examples)
        return returnValue as this
    }

    referencedKeys(): { key: string; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency" }[] {
        return [
            ...linkReferenceKeys([this.name, this.summary, this.description].filter(excludeUndefined))
                .map((key) => ({ referenceType: 'Link' as const, key })),
            ...dependencyReferenceKeys([this.name, this.summary, this.description, ...this.exits].filter(excludeUndefined))
                .map((key) => ({ referenceType: 'Dependency' as const, key })),
            ...exitReferenceKeys(this.exits)
                .map((key) => ({ referenceType: 'Exit' as const, key })),
            ...this.features.map(({ key }) => ({ referenceType: 'Direct' as const, key })),
            ...this.examples.map(({ key }) => ({ referenceType: 'Direct' as const, key })),
            ...this.examples.map((example) => (example.referencedKeys())).flat(1)
        ]
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardRoomPayload(this)
        if (returnValue._shortName) {
            returnValue._shortName = returnValue._shortName.mapContents(callback)
        }
        if (returnValue._name) {
            returnValue._name = returnValue._name.mapContents(callback)
        }
        if (returnValue._summary) {
            returnValue._summary = returnValue._summary.mapContents(callback)
        }
        if (returnValue._description) {
            returnValue._description = returnValue._description.mapContents(callback)
        }
        returnValue._exits = callback(returnValue._exits)
        return returnValue as this
    }
}

export class StandardRoom extends componentClassFactory(StandardRoomPayload, 'StandardRoom') {
    get name() { return this._payload.name }
    get shortName() { return this._payload.shortName }
    get summary() { return this._payload.summary }
    get description() { return this._payload.description }
    get exits() { return this._payload.exits }
    get themes() { return this._payload.themes }
    get features() { return this._payload.features }
    get examples() { return this._payload.examples }

    constructor(props: string | StandardRoomData | GenericTreeNode<SchemaTag> | StandardRoom) {
        super(props)
    }

    override clone(): StandardRoom {
        const returnValue = new StandardRoom(this)
        returnValue._payload = new StandardRoomPayload(this._payload)
        return returnValue
    }

    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardRoom(super.merge(incoming) as StandardRoom)
    }

    override withKey(key: string): StandardComponent {
        return new StandardRoom(super.withKey(key) as StandardRoom)
    }

    override withUniversalKey(key: string): StandardComponent {
        return new StandardRoom(super.withUniversalKey(key) as StandardRoom)
    }

    override withFileName(key: string): StandardComponent {
        return new StandardRoom(super.withFileName(key) as StandardRoom)
    }

    override withImport(importData: StandardImportItem | StandardComponentImport | undefined): StandardComponent {
        return new StandardRoom(super.withImport(importData) as StandardRoom)
    }

    override withExport(exportData: StandardExportItem | StandardComponentExport | string | undefined): StandardComponent {
        return new StandardRoom(super.withExport(exportData) as StandardRoom)
    }

}

export default StandardRoom
