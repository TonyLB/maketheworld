import { defaultSelected } from ".."
import { excludeUndefined } from "../../lib/lists"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeFiltered, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { EditWrappedStandardNode } from "../baseClasses"
import { HasShortName } from "./abstract"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { NestedSchemaOptions, StandardComponent, StandardDiffOptions } from "./baseClasses"
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData"
import { StandardRoomData } from "./dataTypes/room"
import { StandardExportItem, StandardImportItem } from "./metaData"
import { dependencyReferenceKeys, exitReferenceKeys, mergeUniqueReferences } from "./utils/references"
import { StandardRender } from "../render"
import { extractStandardRender, rebuildSchemaFromStandardRender } from "./utils/extractStandardRender"
import { stripUIFields } from "../render/utils"
import { StandardToJSONOptions } from "./baseClasses"
import StandardReference, { diffStandardReferenceList, editableReferenceFactory } from "./reference"
import { StandardReferenceData } from "./dataTypes/reference"
import { SchemaOutputTag, SchemaTag, SchemaThemeTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaFeature, isSchemaRoom, isSchemaShortName, SchemaShortNameTag } from "@tonylb/mtw-base/ts/schema/components"
import { isSchemaExample } from "@tonylb/mtw-base/ts/schema/example"
import { StandardRemove, StandardReplace } from "./edits"
import { deepEqual } from "../../lib/objects"

export class StandardRoomPayload implements HasShortName, ComponentConstructorMethods<StandardRoomData> {
    _shortName?: StandardRender;
    _exits: GenericTree<SchemaTag> = [];
    _themes: GenericTreeFiltered<SchemaThemeTag, SchemaTag> = [];
    _features: (StandardReference | StandardRemove | StandardReplace)[] = [];
    _examples: (StandardReference | StandardRemove | StandardReplace)[] = [];
    tag = 'Room' as const

    constructor(previous?: StandardRoomPayload) {
        if (previous) {
            this._shortName = previous._shortName
            this._exits = [...previous.exits]
            this._themes = [...previous.themes]
            this._features = previous._features.map((reference) => (reference.clone()))
            this._examples = previous._examples.map((reference) => (reference.clone()))
        }
    }

    fromJSON(props: StandardRoomData) {
        const { shortName } = props
        this._shortName = extractStandardRender(shortName, isSchemaShortName, 'Schema mismatch in StandardRoom constructor')
        this._exits = props.exits
        this._themes = props.themes
        this._features = props.features?.map((reference) => (new StandardReference(reference))) ?? []
        this._examples = props.examples?.map((reference) => (new StandardReference(reference))) ?? []
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaRoom)(node)) {
            const tagTree = new SchemaTagTree(node.children)
            const shortNameItem = tagTree.filter({ match: 'ShortName' }).tree.find(wrappedNodeTypeGuard(isSchemaShortName))
            const exitTagTree = tagTree
                .filter({ match: 'Exit' })
                .reorderedSiblings([['Room', 'Exit'], ['If']])
            this._shortName = extractStandardRender<SchemaShortNameTag>(shortNameItem as EditWrappedStandardNode<SchemaShortNameTag, SchemaOutputTag>, isSchemaShortName, 'Schema mismatch in StandardRoom constructor')
            this._exits = defaultSelected(exitTagTree.tree)
            this._themes = []
            this._features = node.children.filter(wrappedNodeTypeGuard(isSchemaFeature)).map(editableReferenceFactory)
            this._examples = node.children.filter(wrappedNodeTypeGuard(isSchemaExample)).map(editableReferenceFactory)
            return
        }
        throw new Error('Schema mismatch in StandardRoom constructor')
    }

    get shortName() { return rebuildSchemaFromStandardRender(this._shortName, { tag: 'ShortName' as const }) }
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
                ...this.exits
            ]
        }
    }

    nestedSchema(byId: Record<string, StandardComponent>, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { localKey, globalKey: key } = options
        return {
            data: { tag: 'Room', key: localKey },
            children: [
                ...[this.shortName].filter(excludeUndefined).filter(({ children }) => (children.length)),
                ...this.features.map((reference) => (
                    reference.global
                        ? reference.schema
                        : byId[`${key}.${reference.key}`]?.nestedSchema(byId, { ...options, localKey: reference.key, globalKey: `${key}.${reference.key}` })
                )).filter(excludeUndefined),
                ...this.examples.map((reference) => (
                    reference.global
                        ? reference.schema
                        : byId[`${key}.${reference.key}`]?.nestedSchema(byId, { ...options, localKey: reference.key, globalKey: `${key}.${reference.key}` })
                )).filter(excludeUndefined),
                ...this.exits
            ]
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardRoomPayload()
        returnValue._shortName = (this._shortName && incoming._shortName) ? this._shortName.merge(incoming._shortName) : this._shortName ?? incoming._shortName
        returnValue._exits = applyEdits([...this.exits, ...incoming.exits])
        returnValue._themes = [...this.themes, ...incoming.themes]
        returnValue._features = mergeUniqueReferences(this.features, incoming.features)
        returnValue._examples = mergeUniqueReferences(this.examples, incoming.examples)
        return returnValue as this
    }

    referencedKeys(): { key: string; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency", global?: boolean }[] {
        return [
            ...dependencyReferenceKeys(this.exits.filter(excludeUndefined))
                .map((key) => ({ referenceType: 'Dependency' as const, key })),
            ...exitReferenceKeys(this.exits)
                .map((key) => ({ referenceType: 'Exit' as const, key })),
            ...this.features.map(({ key, global }) => ({ referenceType: 'Direct' as const, key, global })),
            ...this.examples.map(({ key, global }) => ({ referenceType: 'Direct' as const, key, global }))
        ]
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardRoomPayload(this)
        if (returnValue._shortName) {
            returnValue._shortName = returnValue._shortName.mapContents(callback)
        }
        returnValue._exits = callback(returnValue._exits)
        return returnValue as this
    }
}

export class StandardRoom extends componentClassFactory(StandardRoomPayload, 'StandardRoom') {
    get shortName() { return this._payload.shortName }
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

    override diff(incoming: StandardComponent, options?: StandardDiffOptions): StandardComponent | undefined {
        if (!(incoming instanceof StandardRoom)) {
            throw new Error('Mismatched component types in diff')
        }
        const { hasDiff } = options ?? {}
        const featuresDiff = diffStandardReferenceList({ base: this.features, incoming: incoming.features, hasDiff, parentKey: this.key })
        const examplesDiff = diffStandardReferenceList({ base: this.examples, incoming: incoming.examples, hasDiff, parentKey: this.key })
        if (deepEqual(this.toNDJSON(), incoming.toNDJSON()) && !featuresDiff.length && !examplesDiff.length) {
            return undefined
        }
        const base = new StandardRoom(this.key).withImport(this.import).withExport(this.export) as StandardRoom
        base._payload._shortName = this._payload._shortName
            ? this._payload._shortName.diff(incoming._payload._shortName)
            : incoming._payload._shortName
        base._payload._features = featuresDiff
        base._payload._examples = examplesDiff
        return base
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
