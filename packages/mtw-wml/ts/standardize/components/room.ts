import { defaultSelected } from ".."
import { excludeUndefined } from "../../lib/lists"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { HasShortName } from "./abstract"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { NestedSchemaOptions, StandardComponent, StandardDiffOptions } from "./baseClasses"
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData"
import { StandardRoomData } from "./dataTypes/room"
import { StandardExportItem, StandardImportItem } from "./metaData"
import { dependencyReferenceKeys, exitReferenceKeys, mapReferenceToFormat, mergeUniqueReferences, ReferenceFormat } from "./utils/references"
import { stripUIFields } from "../render/utils"
import { StandardToJSONOptions } from "./baseClasses"
import StandardReference, { diffStandardReferenceList, StandardReferenceSimple } from "./reference"
import { StandardReferenceData } from "./dataTypes/reference"
import { ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaFeature, isSchemaRoom } from "@tonylb/mtw-base/ts/schema/components"
import { isSchemaExample } from "@tonylb/mtw-base/ts/schema/example"
import { deepEqual } from "../../lib/objects"
import { listDiff } from "../../schema/treeManipulation/listDiff"
import { StandardLiteral } from "../literal"
import { isSchemaString } from "../../schema/baseClasses"
import { isStandardRoom } from "../baseClasses"

export class StandardRoomPayload implements HasShortName, ComponentConstructorMethods<StandardRoomData> {
    _shortName?: StandardLiteral;
    _exits: GenericTree<SchemaTag> = [];
    _features: StandardReference[] = [];
    _examples: StandardReference[] = [];
    tag = 'Room' as const

    constructor(previous?: StandardRoomPayload) {
        if (previous) {
            this._shortName = previous._shortName
            this._exits = [...previous.exits]
            this._features = previous._features.map((reference) => (reference.clone()))
            this._examples = previous._examples.map((reference) => (reference.clone()))
        }
    }

    fromJSON(props: StandardRoomData) {
        const { shortName } = props
        this._shortName = shortName ? new StandardLiteral(shortName) : undefined
        this._exits = props.exits
        this._features = props.features?.map((reference) => (new StandardReference(reference))) ?? []
        this._examples = props.examples?.map((reference) => (new StandardReference(reference))) ?? []
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaRoom)(node)) {
            const tagTree = new SchemaTagTree(node.children)
            const shortNameItem = tagTree
                .filter({ match: 'ShortName' })
                .prune({ not: { or: [{ match: 'String' }, { match: 'Remove' }, { match: 'Replace' }, { match: 'ReplaceMatch' }, { match: 'ReplacePayload' }] } })
                .tree
            const exitTagTree = tagTree
                .filter({ match: 'Exit' })
                .reorderedSiblings([['Room', 'Exit'], ['If']])
            this._shortName = shortNameItem.length ? new StandardLiteral(shortNameItem) : undefined
            this._exits = defaultSelected(exitTagTree.tree)
            this._features = node.children.filter(wrappedNodeTypeGuard(isSchemaFeature)).map((node => (new StandardReference([node]))))
            this._examples = node.children.filter(wrappedNodeTypeGuard(isSchemaExample)).map((node => (new StandardReference([node]))))
            return
        }
        throw new Error('Schema mismatch in StandardRoom constructor')
    }

    get shortName() {
        return this._shortName
    }
    get exits() { return this._exits }
    get features() { return this._features }
    get examples() { return this._examples }

    toJSON(options?: StandardToJSONOptions): Omit<StandardRoomData, 'key' | 'universalKey'> {
        const { stripUIFields: stripUI } = options ?? {}
        return {
            tag: 'Room',
            shortName: this?.shortName?.toJSON(),
            exits: stripUI ? stripUIFields(this.exits) : this.exits,
            ...(this.features.length ? { features: this.features.map((reference) => (reference.toJSON() as StandardReferenceData)) } : {}),
            ...(this.examples.length ? { examples: this.examples.map((reference) => (reference.toJSON() as StandardReferenceData)) } : {})
        }
    }

    schema(key: string, universalKey?: ComponentUUID): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Room', key, uuid: universalKey },
            children: [
                ...[this.shortName].filter(excludeUndefined).map((shortName) => (shortName.nestedSchema({ tag: 'ShortName' }))).flat(1),
                ...this.features.map((reference) => (reference.schema)).flat(1),
                ...this.examples.map((reference) => (reference.schema)).flat(1),
                ...this.exits
            ]
        }
    }

    nestedSchema(byId: Record<string, StandardComponent>, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { key, context } = options
        const contextKey = new StandardReferenceSimple(key?.plain ?? { tag: 'Room', key: key.key ?? '', uuid: key.universalKey })
        const newContext = [...(context ?? []), contextKey]
        return {
            data: { tag: 'Room', key: key.key ?? '', uuid: key.universalKey },
            children: [
                ...[this.shortName].filter(excludeUndefined).map((shortName) => (shortName.nestedSchema({ tag: 'ShortName' }))).flat(1),
                ...this.features.map((reference) => (
                    reference.global
                        ? reference.schema[0]
                        : byId[`${key.key}.${reference.key}`]?.nestedSchema(byId, { ...options, key: new StandardReferenceSimple(reference._payload.plain), context: [...context ?? [], contextKey] })
                )).filter(excludeUndefined),
                ...this.examples.map((reference) => (
                    reference.global
                        ? reference.schema[0]
                        : byId[`${(newContext ?? []).map(ref => ref.key).join('.')}.${reference.key}`]?.nestedSchema(byId, { ...options, key: new StandardReferenceSimple(reference._payload.plain), context: newContext })
                )).filter(excludeUndefined),
                ...this.exits
            ]
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardRoomPayload()
        returnValue._shortName = (this._shortName && incoming._shortName) ? this._shortName.merge(incoming._shortName) : this._shortName ?? incoming._shortName
        returnValue._exits = applyEdits([...this.exits, ...incoming.exits])
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
            ...this.features.map(({ key, global }) => ({ referenceType: 'Direct' as const, key: key ?? '', global })),
            ...this.examples.map(({ key, global }) => ({ referenceType: 'Direct' as const, key: key ?? '', global }))
        ]
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardRoomPayload(this)
        if (returnValue._shortName) {
            returnValue._shortName = returnValue._shortName
                .mapContents((value: string): string => {
                    const returnValue = callback([{ data: { tag: 'String', value }, children: [] }])
                    if (!returnValue.length || !isSchemaString(returnValue[0].data)) {
                        return ''
                    }
                    return returnValue[0].data.value
                })
        }
        returnValue._exits = callback(returnValue._exits)
        return returnValue as this
    }

    remapReferences(props: { mappings: { key: string; universalKey: ComponentUUID }[]; mapTo: ReferenceFormat }): this {
        const returnValue = new StandardRoomPayload(this)
        const mapReference = mapReferenceToFormat(props.mappings, props.mapTo)
        returnValue._examples = returnValue._examples.map(mapReference)
        returnValue._features = returnValue._features.map(mapReference)
        return returnValue as this
    }
}

export class StandardRoom extends componentClassFactory(StandardRoomPayload, 'StandardRoom') {
    get shortName() { return this._payload.shortName }
    get exits() { return this._payload.exits }
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
        if (deepEqual(this.toJSON(), incoming.toJSON()) && !featuresDiff.length && !examplesDiff.length) {
            return undefined
        }
        const base = new StandardRoom(this.key ?? '').withImport(this.import).withExport(this.export) as StandardRoom
        base._payload._shortName = this._payload._shortName
            ? this._payload._shortName.diff(incoming._payload._shortName)
            : incoming._payload._shortName
        base._payload._features = featuresDiff
        base._payload._examples = examplesDiff
        base._payload._exits = listDiff(this.exits, incoming.exits)
        return base
    }

    override withKey(key: string): StandardComponent {
        return new StandardRoom(super.withKey(key) as StandardRoom)
    }

    override withUniversalKey(key: ComponentUUID): StandardComponent {
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
