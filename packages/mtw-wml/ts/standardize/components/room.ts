import { defaultSelected } from ".."
import { excludeUndefined } from "../../lib/lists"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { HasShortName } from "./abstract"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { NestedSchemaOptions, StandardComponent, StandardDiffOptions } from "./baseClasses"
import { StandardRoomData } from "./dataTypes/room"
import { assureItemInReferenceList, childReferenceFactory, dependencyReferenceKeys, exitReferenceKeys, mapReferenceToFormat, mergeUniqueReferences, ReferenceFormat } from "./utils/references"
import { stripUIFields } from "../render/utils"
import { StandardToJSONOptions } from "./baseClasses"
import StandardReference, { diffStandardReferenceList, StandardKey } from "./reference"
import { StandardReferenceData } from "./dataTypes/reference"
import { ComponentUUID, isSchemaComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaFeature, isSchemaRoom } from "@tonylb/mtw-base/ts/schema/components"
import { isSchemaExample } from "@tonylb/mtw-base/ts/schema/example"
import { deepEqual } from "../../lib/objects"
import { listDiff } from "../../schema/treeManipulation/listDiff"
import { StandardLiteral } from "../literal"

import { renderReference } from "./utils/schema"
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"
import { diffStandardExitList, mergeStandardExitList, StandardExit } from "./exit"

export class StandardRoomPayload implements HasShortName, ComponentConstructorMethods<StandardRoomData> {
    _shortName?: StandardLiteral;
    _exits: StandardExit[] = [];
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
        this._exits = props.exits.map((exitData) => (new StandardExit(exitData)))
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
                .prune({ match: 'Room' })
                .reorderedSiblings([['Exit'], ['If']])
            this._shortName = shortNameItem.length ? new StandardLiteral(shortNameItem) : undefined
            this._exits = exitTagTree.tree.map((exitData) => (new StandardExit([exitData])))
            this._features = node.children.filter(wrappedNodeTypeGuard(isSchemaFeature)).map((node => (childReferenceFactory([node]))))
            this._examples = node.children.filter(wrappedNodeTypeGuard(isSchemaExample)).map((node => (childReferenceFactory([node]))))
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
            exits: this.exits.map((exit) => exit.toJSON()),
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
                ...this.exits.map((exit) => (exit.schema)).flat(1)
            ]
        }
    }

    nestedSchema(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { key } = options
        return {
            data: key.schema[0].data,
            children: [
                ...[this.shortName].filter(excludeUndefined).map((shortName) => (shortName.nestedSchema({ tag: 'ShortName' }))).flat(1),
                ...this.features.map(renderReference({ lookup, options })).filter(excludeUndefined),
                ...this.examples.map(renderReference({ lookup, options })).filter(excludeUndefined),
                ...this.exits.map((exit) => (exit.schema)).flat(1)
            ]
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardRoomPayload()
        returnValue._shortName = (this._shortName && incoming._shortName) ? this._shortName.merge(incoming._shortName) : this._shortName ?? incoming._shortName
        returnValue._exits = mergeStandardExitList([...this.exits, ...incoming.exits])
        returnValue._features = mergeUniqueReferences(this.features, incoming.features)
        returnValue._examples = mergeUniqueReferences(this.examples, incoming.examples)
        return returnValue as this
    }

    subset({ requestType }): this {
        if (requestType === 'Full') {
            return new StandardRoomPayload(this) as this
        }
        const returnValue = new StandardRoomPayload()
        if (requestType === 'Short') {
            returnValue._shortName = this._shortName ? new StandardLiteral(this._shortName) : undefined
        }
        return returnValue as this
    }

    referencedKeys(): { key: StandardKey; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency" }[] {
        return [
            ...exitReferenceKeys(this.exits)
                .map((key) => ({ referenceType: 'Exit' as const, key: isSchemaComponentUUID(key) ? new StandardKey(key) : new StandardKey({ key, tag: 'Room' }) })),
            ...this.features.map((reference) => ({ referenceType: 'Direct' as const, key: reference._payload.plain })),
            ...this.examples.map((reference) => ({ referenceType: 'Direct' as const, key: reference._payload.plain }))
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
        // returnValue._exits = callback(returnValue._exits)
        return returnValue as this
    }

    remapReferences(props: { mappings: StandardKey[]; mapTo: ReferenceFormat }): this {
        const returnValue = new StandardRoomPayload(this)
        const mapReference = mapReferenceToFormat(props.mappings, props.mapTo)
        returnValue._examples = returnValue._examples.map(mapReference)
        returnValue._features = returnValue._features.map(mapReference)
        return returnValue as this
    }

    withChild(child: StandardReference): this {
        const returnValue = new StandardRoomPayload(this)
        if (child._payload.plain.tag === 'Feature') {
            returnValue._features = assureItemInReferenceList(returnValue._features, child)
        }
        else if (child._payload.plain.tag === 'Example') {
            returnValue._examples = assureItemInReferenceList(returnValue._examples, child)
        }
        else {
            throw new Error(`Invalid child type ${child._payload.tag} for StandardRoom`)
        }
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
        const featuresDiff = diffStandardReferenceList({ base: this.features, incoming: incoming.features })
        const examplesDiff = diffStandardReferenceList({ base: this.examples, incoming: incoming.examples })
        if (deepEqual(this.toJSON(), incoming.toJSON()) && !featuresDiff.length && !examplesDiff.length) {
            return undefined
        }
        const base = this.clone()
        base._payload = new StandardRoomPayload()
        base._payload._shortName = this._payload._shortName
            ? this._payload._shortName.diff(incoming._payload._shortName)
            : incoming._payload._shortName
        base._payload._features = featuresDiff
        base._payload._examples = examplesDiff
        base._payload._exits = diffStandardExitList(this.exits, incoming.exits)
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

}

export default StandardRoom
