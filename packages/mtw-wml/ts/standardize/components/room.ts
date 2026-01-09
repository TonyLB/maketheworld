import { excludeUndefined } from "../../lib/lists"
import { filterEditableTree, stripTagFromTree, wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { HasShortName } from "./abstract"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { NestedSchemaOptions, StandardComponent, StandardComponentReferenceKey, StandardDiffOptions } from "./baseClasses"
import { StandardRoomData } from "./dataTypes/room"
import { childReferenceFactory, exitReferenceKeys, ReferenceFormat } from "./utils/references"
import { StandardToJSONOptions } from "./baseClasses"
import { ReferenceList } from "./reference"
import StandardReference from "../keys/reference"
import { StandardKey } from "../keys/key"
import { StandardReferenceData } from "./dataTypes/reference"
import { AssetUUID, ComponentUUID, isSchemaComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaExit, isSchemaFeature, isSchemaRoom, isSchemaShortName } from "@tonylb/mtw-base/ts/schema/components"
import { isSchemaExample } from "@tonylb/mtw-base/ts/schema/example"
import { isSchemaCharacter } from "@tonylb/mtw-base/ts/schema"
import { isSchemaLens } from "@tonylb/mtw-base/ts/schema/worldState"
import { deepEqual } from "../../lib/objects"
import { StandardLiteral } from "../literal"

import { renderReference } from "./utils/schema"
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"
import { diffStandardExitList, mergeStandardExitList, StandardExit } from "./exit"
import { StandardExplicitParent } from "../explicit"

export class StandardRoomPayload implements HasShortName, ComponentConstructorMethods<StandardRoomData> {
    _shortName?: StandardLiteral;
    _exits: StandardExit[] = [];
    _lenses: ReferenceList;
    _features: ReferenceList;
    _examples: ReferenceList;
    _characters: ReferenceList;
    tag = 'Room' as const

    constructor(previous?: StandardRoomPayload) {
        if (previous) {
            this._shortName = previous._shortName
            this._exits = [...previous.exits]
            this._lenses = previous._lenses.clone()
            this._features = previous._features.clone()
            this._examples = previous._examples.clone()
            this._characters = previous._characters.clone()
        }
        else {
            this._lenses = new ReferenceList([])
            this._examples = new ReferenceList([])
            this._features = new ReferenceList([])
            this._characters = new ReferenceList([])
        }
    }

    fromJSON(props: StandardRoomData) {
        const { shortName } = props
        this._shortName = shortName ? new StandardLiteral(shortName) : undefined
        this._exits = props.exits?.map((exitData) => (StandardExit.create(exitData))) ?? []
        this._lenses = new ReferenceList(props.lenses?.map((reference) => (new StandardReference(reference))) ?? [])
        this._features = new ReferenceList(props.features?.map((reference) => (new StandardReference(reference))) ?? [])
        this._examples = new ReferenceList(props.examples?.map((reference) => (new StandardReference(reference))) ?? [])
        this._characters = new ReferenceList(props.characters?.map((reference) => (new StandardReference(reference))) ?? [])
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaRoom)(node)) {
            const shortNameNode = stripTagFromTree(filterEditableTree({ tree: node.children, typeguard: treeNodeTypeguard(isSchemaShortName) }), 'ShortName')
            this._shortName = shortNameNode.length ? new StandardLiteral(shortNameNode) : undefined
            this._exits = filterEditableTree({ tree: node.children, typeguard: treeNodeTypeguard(isSchemaExit) }).map((exitData) => (StandardExit.create([exitData])))
            this._lenses = new ReferenceList(filterEditableTree({ tree: node.children, typeguard: treeNodeTypeguard(isSchemaLens) }).map(childReferenceFactory))
            this._features = new ReferenceList(filterEditableTree({ tree: node.children, typeguard: treeNodeTypeguard(isSchemaFeature) }).map(childReferenceFactory))
            this._examples = new ReferenceList(filterEditableTree({ tree: node.children, typeguard: treeNodeTypeguard(isSchemaExample) }).map(childReferenceFactory))
            this._characters = new ReferenceList(filterEditableTree({ tree: node.children, typeguard: treeNodeTypeguard(isSchemaCharacter) }).map(childReferenceFactory))
            return
        }
        throw new Error('Schema mismatch in StandardRoom constructor')
    }

    get shortName() {
        return this._shortName
    }
    get exits() { return this._exits }
    get lenses() { return this._lenses }
    get features() { return this._features }
    get examples() { return this._examples }
    get characters() { return this._characters }

    toJSON(options?: StandardToJSONOptions): Omit<StandardRoomData, 'key' | 'universalKey'> {
        const { stripUIFields: stripUI } = options ?? {}
        return {
            tag: 'Room',
            shortName: this?.shortName?.toJSON(),
            ...(this.exits.length ? { exits: this.exits.map((exit) => exit.toJSON()) } : {}),
            ...(this.lenses.payload.length ? { lenses: this.lenses.toJSON() } : {}),
            ...(this.features.payload.length ? { features: this.features.toJSON() } : {}),
            ...(this.examples.payload.length ? { examples: this.examples.toJSON() } : {}),
            ...(this.characters.payload.length ? { characters: this.characters.toJSON() } : {})
        }
    }

    schema(key: string, universalKey?: ComponentUUID, mappings?: StandardReference[]): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Room', key, uuid: universalKey },
            children: [
                ...[this.shortName].filter(excludeUndefined).map((shortName) => (shortName.nestedSchema({ tag: 'ShortName' }))).flat(1),
                ...this.lenses.schema,
                ...this.features.schema,
                ...this.examples.schema,
                ...this.characters.schema,
                ...this.exits.map((exit) => (exit.schema)).flat(1)
            ]
        }
    }

    nestedSchema(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { key } = options
        
        // If organization is available, use assured references from organization
        // Otherwise, fall back to stored reference lists
        let lensesToRender = this.lenses
        let featuresToRender = this.features
        let examplesToRender = this.examples
        let charactersToRender = this.characters
        
        if (options.organization) {
            // Get children from organization and assure references
            const children = options.organization.getChildrenOfParent(key) ?? []
            const assured = this.assureReferences(children)
            lensesToRender = assured.lenses
            featuresToRender = assured.features
            examplesToRender = assured.examples
            charactersToRender = assured.characters
        }
        
        // Pass this Room's key as parent context to children for correct rendering
        return {
            data: { tag: 'Room', key: key.key ?? '', uuid: key.universalKey },
            children: [
                ...[this.shortName].filter(excludeUndefined).map((shortName) => (shortName.nestedSchema({ tag: 'ShortName' }))).flat(1),
                ...lensesToRender.payload.map(renderReference({ lookup, options: { ...options, parent: key } })).filter(excludeUndefined),
                ...featuresToRender.payload.map(renderReference({ lookup, options: { ...options, parent: key } })).filter(excludeUndefined),
                ...examplesToRender.payload.map(renderReference({ lookup, options: { ...options, parent: key } })).filter(excludeUndefined),
                ...charactersToRender.payload.map(renderReference({ lookup, options: { ...options, parent: key } })).filter(excludeUndefined),
                ...this.exits.map((exit) => (exit.schema)).flat(1)
            ]
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardRoomPayload()
        returnValue._shortName = (this._shortName && incoming._shortName) ? this._shortName.merge(incoming._shortName) : this._shortName ?? incoming._shortName
        returnValue._exits = mergeStandardExitList([...this.exits, ...incoming.exits])
        returnValue._lenses = this._lenses.merge(incoming._lenses) ?? new ReferenceList([])
        returnValue._features = this._features.merge(incoming._features) ?? new ReferenceList([])
        returnValue._examples = this._examples.merge(incoming._examples) ?? new ReferenceList([])
        returnValue._characters = this._characters.merge(incoming._characters) ?? new ReferenceList([])
        return returnValue as this
    }

    invert(): this {
        const returnValue = new StandardRoomPayload()
        // Invert shortName if it exists (StandardLiteral has invert() from v2StandardEditableFactory)
        returnValue._shortName = this._shortName ? this._shortName.invert() as StandardLiteral : undefined
        // Invert each exit (StandardExit has invert() from v2StandardEditableFactory)
        returnValue._exits = this._exits.map((exit) => exit.invert() as StandardExit)
        // Invert each ReferenceList
        returnValue._lenses = this._lenses.invert()
        returnValue._features = this._features.invert()
        returnValue._examples = this._examples.invert()
        returnValue._characters = this._characters.invert()
        return returnValue as this
    }

    assureReferences(children: StandardReference[]): this {
        const returnValue = new StandardRoomPayload(this)
        
        // Filter and map children by type, creating references with ref={0}
        const lensReferences = new ReferenceList(
            children
                .filter(child => child.tag === 'Lens')
                .map(child => child.withRef(0))
        )
        const featureReferences = new ReferenceList(
            children
                .filter(child => child.tag === 'Feature')
                .map(child => child.withRef(0))
        )
        const exampleReferences = new ReferenceList(
            children
                .filter(child => child.tag === 'Example')
                .map(child => child.withRef(0))
        )
        const characterReferences = new ReferenceList(
            children
                .filter(child => child.tag === 'Character')
                .map(child => child.withRef(0))
        )
        
        // Merge with existing buckets, preserving ref={0} references
        // cleanEmptyReferences: false ensures ref={0} entries are preserved when merging
        returnValue._lenses = this._lenses.merge(lensReferences, { cleanEmptyReferences: false }) ?? this._lenses
        returnValue._features = this._features.merge(featureReferences, { cleanEmptyReferences: false }) ?? this._features
        returnValue._examples = this._examples.merge(exampleReferences, { cleanEmptyReferences: false }) ?? this._examples
        returnValue._characters = this._characters.merge(characterReferences, { cleanEmptyReferences: false }) ?? this._characters
        
        return returnValue as this
    }

    removeReferences(references: StandardReference[]): this {
        const returnValue = new StandardRoomPayload(this)
        
        // Filter reference lists by removing items that match any reference in the input
        returnValue._lenses = this._lenses.filter(
            item => !references.some(ref => item.sameKey(ref))
        )
        returnValue._features = this._features.filter(
            item => !references.some(ref => item.sameKey(ref))
        )
        returnValue._examples = this._examples.filter(
            item => !references.some(ref => item.sameKey(ref))
        )
        returnValue._characters = this._characters.filter(
            item => !references.some(ref => item.sameKey(ref))
        )
        
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

    referencedKeys(): StandardComponentReferenceKey[] {
        return [
            ...exitReferenceKeys(this.exits)
                .map((key) => {
                    // Create StandardReference for exit - exits always reference rooms
                    const exitKey = isSchemaComponentUUID(key) ? new StandardKey(key) : new StandardKey({ key })
                    const exitReference = new StandardReference(exitKey, 'Room')
                    return { referenceType: 'Exit' as const, reference: exitReference }
                }),
            ...this.lenses.payload.map((reference) => ({ referenceType: 'Direct' as const, reference })),
            ...this.features.payload.map((reference) => ({ referenceType: 'Direct' as const, reference })),
            ...this.examples.payload.map((reference) => ({ referenceType: 'Direct' as const, reference })),
            ...this.characters.payload.map((reference) => ({ referenceType: 'Direct' as const, reference }))
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

    remapReferences(props: { mappings: StandardReference[]; mapTo: ReferenceFormat }): this {
        const returnValue = new StandardRoomPayload(this)
        returnValue._lenses = returnValue._lenses.toFormat(props.mapTo, props.mappings)
        returnValue._examples = returnValue._examples.toFormat(props.mapTo, props.mappings)
        returnValue._features = returnValue._features.toFormat(props.mapTo, props.mappings)
        returnValue._exits = returnValue._exits.map((exit) => exit.remapReferences(props))
        return returnValue as this
    }

    withChild(child: StandardReference): this {
        const returnValue = new StandardRoomPayload(this)
        if (child.tag === 'Lens') {
            returnValue._lenses = returnValue._lenses.assureItem(child)
        }
        else if (child.tag === 'Feature') {
            returnValue._features = returnValue._features.assureItem(child)
        }
        else if (child.tag === 'Example') {
            returnValue._examples = returnValue._examples.assureItem(child)
        }
        else if (child.tag === 'Character') {
            returnValue._characters = returnValue._characters.assureItem(child)
        }
        else {
            throw new Error(`Invalid child type ${child.tag} for StandardRoom`)
        }
        return returnValue as this
    }

    isEmpty(): boolean {
        // A room is empty if it has no shortName, no exits, and no references (lenses, features, examples, characters)
        const hasShortName = Boolean(this._shortName)
        const hasExits = this._exits.length > 0
        const hasLenses = this._lenses.payload.length > 0
        const hasFeatures = this._features.payload.length > 0
        const hasExamples = this._examples.payload.length > 0
        const hasCharacters = this._characters.payload.length > 0
        return !(hasShortName || hasExits || hasLenses || hasFeatures || hasExamples || hasCharacters)
    }
}

export class StandardRoom extends componentClassFactory(StandardRoomPayload, 'StandardRoom') {
    get shortName() { return this._payload.shortName }
    get exits() { return this._payload.exits }
    get lenses() { return this._payload.lenses }
    get features() { return this._payload.features }
    get examples() { return this._payload.examples }
    get characters() { return this._payload.characters }

    constructor(props: string | StandardRoomData | GenericTreeNode<SchemaTag> | StandardRoom) {
        super(props)
    }

    override _wrap(instance: StandardComponent): this {
        return new StandardRoom(instance as StandardRoom) as this
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
        return !(this.lenses.diff(incoming.lenses)?.payload.length) &&
            !(this.features.diff(incoming.features)?.payload.length) &&
            !(this.examples.diff(incoming.examples)?.payload.length) &&
            !(this.characters.diff(incoming.characters)?.payload.length) &&
            !(diffStandardExitList(this.exits, incoming.exits).length) &&
            deepEqual(this.shortName?.toJSON(), incoming.shortName?.toJSON())
    }

}

export default StandardRoom
