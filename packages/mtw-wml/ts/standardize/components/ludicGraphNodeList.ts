import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { excludeUndefined } from "@tonylb/mtw-base/ts/utils/lists"
import { ReferenceFormat } from "./utils/references"
import { ReferenceList } from "./reference"
import StandardReference, { LookupMappings } from "../keys/reference"
import {
    LudicGraphNodeListData,
    StandardLudicGraphNodeData,
    StandardLudicGraphPresenceNodeData,
    isStandardLudicGraphPresenceNodeData,
} from "./dataTypes/ludicGraph"

//
// LG-8: the heterogeneous node list -- component references (the pre-existing ReferenceList
// mechanism, unchanged in every one of its own behaviors) plus presence structure nodes (new).
// One JSON field, mirroring EphemeraLudicGraph's single `_nodes` array, so that the
// stored-to-wire projection (Slice 4) reshapes nothing. Presence nodes have no WML surface tag
// and no author path this slice; they round-trip through JSON, typed and unit-exercised, per the
// lift rule.
//

export interface LudicGraphNodeListItem {
    readonly isPresence: boolean
    readonly tag: string
    sameKey(other: LudicGraphNodeListItem): boolean
    clone(): LudicGraphNodeListItem
    merge(incoming: LudicGraphNodeListItem): LudicGraphNodeListItem | undefined
    diff(incoming: LudicGraphNodeListItem | undefined): LudicGraphNodeListItem | undefined
    invert(): LudicGraphNodeListItem
    equals(other: LudicGraphNodeListItem): boolean
    toJSON(): StandardLudicGraphNodeData
    readonly schema: GenericTree<SchemaTag>
    toFormat(format: ReferenceFormat, mappings?: LookupMappings): LudicGraphNodeListItem
    lookup(mappings: LookupMappings): LudicGraphNodeListItem
}

export class LudicGraphComponentNode implements LudicGraphNodeListItem {
    readonly isPresence = false as const
    _reference: StandardReference

    constructor(arg: LudicGraphComponentNode | StandardReference) {
        this._reference = arg instanceof LudicGraphComponentNode ? arg._reference.clone() : arg.clone()
    }

    get reference(): StandardReference { return this._reference }
    get tag(): string { return this._reference.tag }
    get ref(): number { return this._reference.ref }
    /** Passthrough of `StandardReference`'s own public fields, so duck-typed consumers that read
     * `.key`/`.universalKey` directly off a `ludicGraph.nodes.payload` entry (the shape
     * `StandardReference` itself always had) keep working without knowing about the wrapper. */
    get key(): string | undefined { return this._reference.key }
    get universalKey(): string | undefined { return this._reference.universalKey }

    sameKey(other: LudicGraphNodeListItem): boolean {
        return !other.isPresence && this._reference.sameKey((other as LudicGraphComponentNode)._reference)
    }

    clone(): LudicGraphComponentNode {
        return new LudicGraphComponentNode(this._reference)
    }

    merge(incoming: LudicGraphNodeListItem): LudicGraphComponentNode | undefined {
        const merged = this._reference.merge((incoming as LudicGraphComponentNode)._reference)
        return merged ? new LudicGraphComponentNode(merged) : undefined
    }

    diff(incoming: LudicGraphNodeListItem | undefined): LudicGraphComponentNode | undefined {
        const diffed = this._reference.diff(incoming ? (incoming as LudicGraphComponentNode)._reference : undefined)
        return diffed ? new LudicGraphComponentNode(diffed) : undefined
    }

    invert(): LudicGraphComponentNode {
        return new LudicGraphComponentNode(this._reference.invert())
    }

    equals(other: LudicGraphNodeListItem): boolean {
        return this.sameKey(other) && this._reference.ref === (other as LudicGraphComponentNode)._reference.ref
    }

    toJSON(): StandardLudicGraphNodeData {
        return this._reference.toJSON()
    }

    get schema(): GenericTree<SchemaTag> {
        return this._reference.schema
    }

    toFormat(format: ReferenceFormat, mappings?: LookupMappings): LudicGraphComponentNode {
        return new LudicGraphComponentNode(this._reference.toFormat(format, mappings))
    }

    lookup(mappings: LookupMappings): LudicGraphComponentNode {
        return new LudicGraphComponentNode(this._reference.lookup(mappings))
    }
}

export class LudicGraphPresenceNode implements LudicGraphNodeListItem {
    readonly isPresence = true as const
    _universalKey: string
    _fromHostId: StandardLudicGraphPresenceNodeData['fromHostId']
    _cover: StandardLudicGraphPresenceNodeData['cover']
    _ref: number

    constructor(arg: LudicGraphPresenceNode | StandardLudicGraphPresenceNodeData) {
        if (arg instanceof LudicGraphPresenceNode) {
            this._universalKey = arg._universalKey
            this._fromHostId = arg._fromHostId
            this._cover = arg._cover
            this._ref = arg._ref
            return
        }
        this._universalKey = arg.universalKey
        this._fromHostId = arg.fromHostId
        this._cover = arg.cover
        this._ref = arg.ref ?? 1
    }

    get tag(): 'Presence' { return 'Presence' }
    get universalKey(): string { return this._universalKey }
    get fromHostId(): StandardLudicGraphPresenceNodeData['fromHostId'] { return this._fromHostId }
    get cover(): StandardLudicGraphPresenceNodeData['cover'] { return this._cover }
    get ref(): number { return this._ref }

    sameKey(other: LudicGraphNodeListItem): boolean {
        return other.isPresence && this._universalKey === (other as LudicGraphPresenceNode)._universalKey
    }

    clone(): LudicGraphPresenceNode {
        return new LudicGraphPresenceNode(this)
    }

    private withRef(ref: number): LudicGraphPresenceNode {
        return new LudicGraphPresenceNode({
            tag: 'Presence',
            universalKey: this._universalKey,
            fromHostId: this._fromHostId,
            cover: this._cover,
            ref,
        })
    }

    merge(incoming: LudicGraphNodeListItem): LudicGraphPresenceNode | undefined {
        const mergedRef = this._ref + (incoming as LudicGraphPresenceNode)._ref
        return mergedRef === 0 ? undefined : this.withRef(mergedRef)
    }

    diff(incoming: LudicGraphNodeListItem | undefined): LudicGraphPresenceNode | undefined {
        if (!incoming) {
            return this.invert()
        }
        const diffRef = (incoming as LudicGraphPresenceNode)._ref - this._ref
        return diffRef === 0 ? undefined : this.withRef(diffRef)
    }

    invert(): LudicGraphPresenceNode {
        return this.withRef(-this._ref)
    }

    equals(other: LudicGraphNodeListItem): boolean {
        return this.sameKey(other) && this._ref === (other as LudicGraphPresenceNode)._ref
    }

    toJSON(): StandardLudicGraphPresenceNodeData {
        return {
            tag: 'Presence',
            universalKey: this._universalKey,
            fromHostId: this._fromHostId,
            cover: this._cover,
            ...(this._ref !== 1 ? { ref: this._ref } : {}),
        }
    }

    get schema(): GenericTree<SchemaTag> {
        // No WML surface tag this slice -- presence nodes are unauthorable (Slice 2's lint) and
        // unauthored (nothing constructs one via fromSchema), so there is nothing to render.
        return []
    }

    toFormat(): LudicGraphPresenceNode {
        return this.clone()
    }

    lookup(): LudicGraphPresenceNode {
        return this.clone()
    }
}

const isLudicGraphNodeListItem = (arg: unknown): arg is LudicGraphNodeListItem =>
    arg instanceof LudicGraphComponentNode || arg instanceof LudicGraphPresenceNode

const nodeItemFromJSON = (entry: StandardLudicGraphNodeData): LudicGraphNodeListItem => {
    if (isStandardLudicGraphPresenceNodeData(entry)) {
        return new LudicGraphPresenceNode(entry)
    }
    return new LudicGraphComponentNode(new StandardReference(entry as any))
}

export class LudicGraphNodeList {
    _items: LudicGraphNodeListItem[] = []

    constructor(arg: LudicGraphNodeList | ReferenceList | LudicGraphNodeListItem[] | LudicGraphNodeListData) {
        if (arg instanceof LudicGraphNodeList) {
            this._items = arg._items.map((item) => item.clone())
            return
        }
        if (arg instanceof ReferenceList) {
            this._items = arg.payload.map((reference) => new LudicGraphComponentNode(reference))
            return
        }
        if (Array.isArray(arg)) {
            const items = arg.map((entry) => (isLudicGraphNodeListItem(entry) ? entry : nodeItemFromJSON(entry as StandardLudicGraphNodeData)))
            this._items = items.reduce<LudicGraphNodeListItem[]>((previous, item) => {
                const unmatchedPrevious = previous.filter((prev) => !item.sameKey(prev))
                const previousMatch = previous.find((prev) => item.sameKey(prev))
                if (previousMatch) {
                    const merged = previousMatch.merge(item)
                    return merged ? [...unmatchedPrevious, merged] : unmatchedPrevious
                }
                return [...previous, item]
            }, [])
            return
        }
        throw new Error('Invalid argument for LudicGraphNodeList constructor')
    }

    _wrap(items: LudicGraphNodeListItem[]): LudicGraphNodeList {
        return new LudicGraphNodeList(items)
    }

    get payload(): LudicGraphNodeListItem[] {
        return this._items
    }

    /** The component-node arm only, as a plain ReferenceList -- every existing consumer of
     * `ludicGraph.nodes` (Area/Room authoring, the Workbench accessors) operates on this arm. */
    get componentRefs(): ReferenceList {
        return new ReferenceList(
            this._items.filter((item): item is LudicGraphComponentNode => !item.isPresence).map((item) => item.reference)
        )
    }

    get presenceNodes(): LudicGraphPresenceNode[] {
        return this._items.filter((item): item is LudicGraphPresenceNode => item.isPresence)
    }

    /** Replace the component arm, keeping the presence arm untouched -- the write-side
     * counterpart of `componentRefs`, so a caller that only ever manipulates component
     * references cannot silently drop presence nodes already on the graph. */
    withComponentRefs(refs: ReferenceList): LudicGraphNodeList {
        return this._wrap([
            ...refs.payload.map((reference) => new LudicGraphComponentNode(reference)),
            ...this.presenceNodes,
        ])
    }

    toJSON(): LudicGraphNodeListData {
        return this._items.map((item) => item.toJSON())
    }

    get schema(): GenericTree<SchemaTag> {
        return this._items.map((item) => item.schema).flat(1)
    }

    clone(): LudicGraphNodeList {
        return new LudicGraphNodeList(this)
    }

    isEmpty(): boolean {
        return this._items.length === 0 || this._items.every((item) => (item.isPresence ? (item as LudicGraphPresenceNode).ref === 0 : (item as LudicGraphComponentNode).ref === 0))
    }

    equals(other: LudicGraphNodeList): boolean {
        if (!(other instanceof LudicGraphNodeList)) {
            return false
        }
        const unmatchedBaseItems = this._items.filter((item) => !other._items.some((otherItem) => item.sameKey(otherItem)))
        if (unmatchedBaseItems.length > 0) {
            return false
        }
        const unmatchedOtherItems = other._items.filter((item) => !this._items.some((baseItem) => baseItem.sameKey(item)))
        if (unmatchedOtherItems.length > 0) {
            return false
        }
        return this._items.every((item) => {
            const matchingItem = other._items.find((otherItem) => item.sameKey(otherItem))
            return matchingItem ? item.equals(matchingItem) : false
        })
    }

    merge(other: LudicGraphNodeList, options?: { cleanEmptyReferences?: boolean }): LudicGraphNodeList | undefined {
        const { cleanEmptyReferences = true } = options ?? {}
        const unmatchedBaseItems = this._items.filter((item) => !other._items.some((otherItem) => item.sameKey(otherItem)))
        const matchedOtherItems = other._items
            .map((incoming) => ({ incoming, base: this._items.find((item) => item.sameKey(incoming)) }))
            .filter((value): value is { incoming: LudicGraphNodeListItem; base: LudicGraphNodeListItem } => value.base !== undefined)
        const unmatchedOtherItems = other._items.filter((item) => !this._items.some((baseItem) => baseItem.sameKey(item)))
        const filteredUnmatchedOtherItems = cleanEmptyReferences
            ? unmatchedOtherItems.filter((item) => (item.isPresence ? (item as LudicGraphPresenceNode).ref !== 0 : (item as LudicGraphComponentNode).ref !== 0))
            : unmatchedOtherItems

        const mergedItems = [
            ...unmatchedBaseItems,
            ...matchedOtherItems.map(({ base, incoming }) => base.merge(incoming)),
            ...filteredUnmatchedOtherItems,
        ].filter(excludeUndefined)

        return this._wrap(mergedItems)
    }

    diff(other: LudicGraphNodeList): LudicGraphNodeList | undefined {
        const unmatchedBaseItems = this._items.filter((item) => !other._items.some((otherItem) => item.sameKey(otherItem)))
        const matchedOtherItems = other._items
            .map((incoming) => ({ incoming, base: this._items.find((item) => item.sameKey(incoming)) }))
            .filter((value): value is { incoming: LudicGraphNodeListItem; base: LudicGraphNodeListItem } => value.base !== undefined)
        const unmatchedOtherItems = other._items.filter((item) => !this._items.some((baseItem) => baseItem.sameKey(item)))

        const diffedItems = [
            ...unmatchedBaseItems.map((item) => item.invert()),
            ...matchedOtherItems.map(({ base, incoming }) => base.diff(incoming)),
            ...unmatchedOtherItems,
        ].filter(excludeUndefined)

        return this._wrap(diffedItems)
    }

    invert(): LudicGraphNodeList {
        return this._wrap(this._items.map((item) => item.invert()))
    }

    filter(predicate: (item: LudicGraphNodeListItem) => boolean): LudicGraphNodeList {
        return this._wrap(this._items.filter(predicate))
    }

    toFormat(format: ReferenceFormat, mappings?: LookupMappings): LudicGraphNodeList {
        return this._wrap(this._items.map((item) => item.toFormat(format, mappings)))
    }

    lookup(mappings: LookupMappings): LudicGraphNodeList {
        return this._wrap(this._items.map((item) => item.lookup(mappings)))
    }
}
