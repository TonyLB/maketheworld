import { excludeUndefined } from "../../lib/lists"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { HasShortName } from "./abstract"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { NestedSchemaOptions, StandardComponent, StandardDiffOptions } from "./baseClasses"
import { StandardRoomData } from "./dataTypes/room"
import { childReferenceFactory, exitReferenceKeys, ReferenceFormat } from "./utils/references"
import { StandardToJSONOptions } from "./baseClasses"
import StandardReference, { ReferenceList, StandardKey } from "./reference"
import { StandardReferenceData } from "./dataTypes/reference"
import { AssetUUID, ComponentUUID, isSchemaComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaFeature, isSchemaRoom } from "@tonylb/mtw-base/ts/schema/components"
import { isSchemaExample } from "@tonylb/mtw-base/ts/schema/example"
import { isSchemaCharacter } from "@tonylb/mtw-base/ts/schema"
import { deepEqual } from "../../lib/objects"
import { StandardLiteral } from "../literal"

import { renderReference } from "./utils/schema"
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"
import { diffStandardExitList, mergeStandardExitList, StandardExit } from "./exit"
import { StandardReplace } from "./edits"

export class StandardRoomPayload implements HasShortName, ComponentConstructorMethods<StandardRoomData> {
    _shortName?: StandardLiteral;
    _exits: StandardExit[] = [];
    _features: ReferenceList;
    _examples: ReferenceList;
    _characters: ReferenceList;
    tag = 'Room' as const

    constructor(previous?: StandardRoomPayload) {
        if (previous) {
            this._shortName = previous._shortName
            this._exits = [...previous.exits]
            this._features = previous._features.clone()
            this._examples = previous._examples.clone()
            this._characters = previous._characters.clone()
        }
        else {
            this._examples = new ReferenceList([])
            this._features = new ReferenceList([])
            this._characters = new ReferenceList([])
        }
    }

    fromJSON(props: StandardRoomData) {
        const { shortName } = props
        this._shortName = shortName ? new StandardLiteral(shortName) : undefined
        this._exits = props.exits?.map((exitData) => (new StandardExit(exitData))) ?? []
        this._features = new ReferenceList(props.features?.map((reference) => (new StandardReference(reference))) ?? [])
        this._examples = new ReferenceList(props.examples?.map((reference) => (new StandardReference(reference))) ?? [])
        this._characters = new ReferenceList(props.characters?.map((reference) => (new StandardReference(reference))) ?? [])
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaRoom)(node)) {
            const tagTree = new SchemaTagTree(node.children)
            const shortNameItem = tagTree
                .filter({ and: [{ match: 'ShortName' }, { not: { or: [{ match: 'Character'}, { match: 'Feature' }] } }] })
                .prune({ not: { or: [{ match: 'String' }, { match: 'Remove' }, { match: 'Replace' }, { match: 'ReplaceMatch' }, { match: 'ReplacePayload' }] } })
                .tree
            const exitTagTree = tagTree
                .filter({ match: 'Exit' })
                .prune({ match: 'Room' })
                .reorderedSiblings([['Exit'], ['If']])
            this._shortName = shortNameItem.length ? new StandardLiteral(shortNameItem) : undefined
            this._exits = exitTagTree.tree.map((exitData) => (new StandardExit([exitData])))
            this._features = new ReferenceList(node.children.filter(wrappedNodeTypeGuard(isSchemaFeature)).map((node => (childReferenceFactory([node])))))
            this._examples = new ReferenceList(node.children.filter(wrappedNodeTypeGuard(isSchemaExample)).map((node => (childReferenceFactory([node])))))
            this._characters = new ReferenceList(node.children.filter(wrappedNodeTypeGuard(isSchemaCharacter)).map((node => (childReferenceFactory([node])))))
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
    get characters() { return this._characters }

    toJSON(options?: StandardToJSONOptions): Omit<StandardRoomData, 'key' | 'universalKey'> {
        const { stripUIFields: stripUI } = options ?? {}
        return {
            tag: 'Room',
            shortName: this?.shortName?.toJSON(),
            exits: this.exits.map((exit) => exit.toJSON()),
            ...(this.features.payload.length ? { features: this.features.toJSON() } : {}),
            ...(this.examples.payload.length ? { examples: this.examples.toJSON() } : {}),
            ...(this.characters.payload.length ? { characters: this.characters.toJSON() } : {})
        }
    }

    schema(key: string, universalKey?: ComponentUUID): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Room', key, uuid: universalKey },
            children: [
                ...[this.shortName].filter(excludeUndefined).map((shortName) => (shortName.nestedSchema({ tag: 'ShortName' }))).flat(1),
                ...this.features.schema,
                ...this.examples.schema,
                ...this.characters.schema,
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
                ...this.features.payload.map(renderReference({ lookup, options })).filter(excludeUndefined),
                ...this.examples.payload.map(renderReference({ lookup, options })).filter(excludeUndefined),
                ...this.characters.payload.map(renderReference({ lookup, options })).filter(excludeUndefined),
                ...this.exits.map((exit) => (exit.schema)).flat(1)
            ]
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardRoomPayload()
        returnValue._shortName = (this._shortName && incoming._shortName) ? this._shortName.merge(incoming._shortName) : this._shortName ?? incoming._shortName
        returnValue._exits = mergeStandardExitList([...this.exits, ...incoming.exits])
        returnValue._features = this._features.merge(incoming._features) ?? new ReferenceList([])
        returnValue._examples = this._examples.merge(incoming._examples) ?? new ReferenceList([])
        returnValue._characters = this._characters.merge(incoming._characters) ?? new ReferenceList([])
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
            ...this.features.payload.map((reference) => ({ referenceType: 'Direct' as const, key: reference._payload.plain })),
            ...this.examples.payload.map((reference) => ({ referenceType: 'Direct' as const, key: reference._payload.plain })),
            ...this.characters.payload.map((reference) => ({ referenceType: 'Direct' as const, key: reference._payload.plain }))
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
        returnValue._examples = returnValue._examples.lookup(props.mappings).toFormat(props.mapTo)
        returnValue._features = returnValue._features.lookup(props.mappings).toFormat(props.mapTo)
        returnValue._exits = returnValue._exits.map((exit) => exit.remapReferences(props))
        return returnValue as this
    }

    withChild(child: StandardReference): this {
        const returnValue = new StandardRoomPayload(this)
        if (child._payload.plain.tag === 'Feature') {
            returnValue._features = returnValue._features.assureItem(child)
        }
        else if (child._payload.plain.tag === 'Example') {
            returnValue._examples = returnValue._examples.assureItem(child)
        }
        else if (child._payload.plain.tag === 'Character') {
            returnValue._characters = returnValue._characters.assureItem(child)
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
    get characters() { return this._payload.characters }

    constructor(props: string | StandardRoomData | GenericTreeNode<SchemaTag> | StandardRoom) {
        super(props)
    }

    override clone(): StandardRoom {
        const returnValue = new StandardRoom(this)
        returnValue._payload = new StandardRoomPayload(this._payload)
        return returnValue
    }

    override equals(incoming: StandardComponent): boolean {
        if (!(incoming instanceof StandardRoom)) {
            return false
        }
        return !(this.features.diff(incoming.features)?.payload.length) &&
            !(this.examples.diff(incoming.examples)?.payload.length) &&
            !(this.characters.diff(incoming.characters)?.payload.length) &&
            !(diffStandardExitList(this.exits, incoming.exits).length) &&
            deepEqual(this.shortName?.toJSON(), incoming.shortName?.toJSON())
    }

    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardRoom(super.merge(incoming) as StandardRoom)
    }

    override diff(incoming: StandardComponent, options?: StandardDiffOptions): StandardComponent | undefined {
        if (!(incoming instanceof StandardRoom)) {
            throw new Error('Mismatched component types in diff')
        }
        if (this.universalKey && incoming.universalKey && this.universalKey !== incoming.universalKey) {
            throw new Error('Mismatched universal keys in diff')
        }
        if (incoming.key !== this.key) {
            return new StandardReplace(this, incoming)
        }
        const featuresDiff = this.features.diff(incoming.features) ?? new ReferenceList([])
        const examplesDiff = this.examples.diff(incoming.examples) ?? new ReferenceList([])
        const charactersDiff = this.characters.diff(incoming.characters) ?? new ReferenceList([])
        if (deepEqual(this._payload.shortName?.toJSON(), incoming._payload.shortName?.toJSON()) &&
            !featuresDiff.payload.length &&
            !examplesDiff.payload.length &&
            !charactersDiff.payload.length &&
            !diffStandardExitList(this.exits, incoming.exits).length
        ) {
            return undefined
        }
        const base = this.clone()
        base._payload = new StandardRoomPayload()
        base._payload._shortName = this._payload._shortName
            ? this._payload._shortName.diff(incoming._payload._shortName)
            : incoming._payload._shortName
        base._payload._features = featuresDiff
        base._payload._examples = examplesDiff
        base._payload._characters = charactersDiff
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

    override withMapping(mapping: StandardKey[]): StandardComponent {
        return new StandardRoom(super.withMapping(mapping) as StandardRoom)
    }

    override withImport(fromAsset: AssetUUID): StandardComponent {
        return new StandardRoom(super.withImport(fromAsset) as StandardRoom)
    }

    override withOrigin(origin: AssetUUID[]): StandardComponent {
        return new StandardRoom(super.withOrigin(origin) as StandardRoom)
    }

    override withLeastCommonContext(context: StandardKey[]): StandardComponent {
        return new StandardRoom(super.withLeastCommonContext(context) as StandardRoom)
    }

    override withChild(child: StandardReference): StandardComponent {
        return new StandardRoom(super.withChild(child) as StandardRoom)
    }

}

export default StandardRoom
