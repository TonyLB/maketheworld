import { GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { excludeUndefined } from "@tonylb/mtw-base/ts/utils/lists"
import { ReferenceFormat } from "../../components/utils/references"
import { StandardReference, LookupMappings } from "../reference"
import { StandardReferenceData } from "../dataTypes/reference"
import { StandardExitEdge } from "./exitEdge"
import { StandardExitEdgeData } from "./dataTypes/exitEdge"
import {
    LudicEdgeKind,
    LudicEdgeListData,
    StandardLudicEdgeData,
    StandardLudicNavigationEdgeData,
    StandardLudicRelationalEdgeData,
} from "./dataTypes/ludicEdge"

//
// LG-9/LG-10: the heterogeneous edge list. A NEW type, not a widening of ExitEdgeList
// (AGENT.edges.md is explicit: "do not overload ExitEdgeList with mixed tags"). Navigation wraps
// the existing StandardExitEdge unchanged -- the WML surface tag stays <Exit>, and its
// Replace/Remove editable endpoints are exactly what authoring already needs. The other kinds
// have no WML surface tag and no author path this slice; they are typed and unit-exercised
// per the lift rule (type now, behavior on demand).
//

export interface LudicEdgeListItem {
    readonly kind: LudicEdgeKind
    sameKey(other: LudicEdgeListItem): boolean
    clone(): LudicEdgeListItem
    merge(incoming: LudicEdgeListItem): LudicEdgeListItem | undefined
    diff(incoming: LudicEdgeListItem | undefined): LudicEdgeListItem | undefined
    invert(): LudicEdgeListItem
    equals(other: LudicEdgeListItem): boolean
    toJSON(): StandardEditableData<StandardLudicEdgeData>
    toFormat(format: ReferenceFormat): LudicEdgeListItem
    lookup(mappings: LookupMappings): LudicEdgeListItem
    schemaNode(): GenericTreeNode<SchemaTag> | undefined
}

const mapEditableEnvelope = <A, B>(data: StandardEditableData<A>, fn: (a: A) => B): StandardEditableData<B> => {
    if (typeof data === 'object' && data !== null && 'tag' in data && (data.tag === 'Remove' || data.tag === 'Replace')) {
        if (data.tag === 'Remove') {
            return { tag: 'Remove', match: fn((data as { match: A }).match) }
        }
        return {
            tag: 'Replace',
            match: fn((data as { match: A; payload: A }).match),
            payload: fn((data as { match: A; payload: A }).payload),
        }
    }
    return fn(data as A)
}

const exitDataToNavigation = (data: StandardExitEdgeData): StandardLudicNavigationEdgeData => ({
    kind: 'Navigation',
    uuid: data.uuid,
    ...(data.from !== undefined ? { from: data.from } : {}),
    ...(data.to !== undefined ? { to: data.to } : {}),
    payload: data.payload,
})

const navigationDataToExit = (data: StandardLudicNavigationEdgeData): StandardExitEdgeData => ({
    tag: 'Exit',
    uuid: data.uuid,
    ...(data.from !== undefined ? { from: data.from } : {}),
    ...(data.to !== undefined ? { to: data.to } : {}),
    payload: data.payload,
})

/**
 * The Topology/Navigation arm: a thin wrapper around the existing, unchanged StandardExitEdge.
 * Only the outer discriminant (`tag: 'Exit'` -> `kind: 'Navigation'`) is translated; everything
 * else -- endpoint editing, uuid identity, merge/diff, schema -- is StandardExitEdge's own,
 * untouched behavior.
 */
export class StandardLudicNavigationEdge implements LudicEdgeListItem {
    readonly kind = 'Navigation' as const
    _edge: StandardExitEdge

    constructor(arg: StandardLudicNavigationEdge | StandardExitEdge | StandardEditableData<StandardLudicNavigationEdgeData> | unknown) {
        if (arg instanceof StandardLudicNavigationEdge) {
            this._edge = arg._edge.clone()
            return
        }
        if (arg instanceof StandardExitEdge) {
            this._edge = arg
            return
        }
        if (typeof arg === 'object' && arg !== null && (
            'kind' in (arg as Record<string, unknown>) ||
            ('match' in (arg as Record<string, unknown>) && typeof (arg as any).match === 'object' && (arg as any).match !== null && 'kind' in (arg as any).match)
        )) {
            const exitData = mapEditableEnvelope(arg as StandardEditableData<StandardLudicNavigationEdgeData>, navigationDataToExit)
            this._edge = new StandardExitEdge(exitData)
            return
        }
        // GenericTree<SchemaTag>, WML string, or a legacy StandardExitEdgeData-shaped object:
        // pass straight through to StandardExitEdge, which already parses all of these.
        this._edge = new StandardExitEdge(arg)
    }

    get uuid(): string {
        return this._edge.uuid
    }

    get from() { return this._edge.from }
    get to() { return this._edge.to }
    get payload() { return this._edge.payload }

    sameKey(other: LudicEdgeListItem): boolean {
        return other instanceof StandardLudicNavigationEdge && this._edge.sameKey(other._edge)
    }

    clone(): StandardLudicNavigationEdge {
        return new StandardLudicNavigationEdge(this)
    }

    merge(incoming: LudicEdgeListItem): StandardLudicNavigationEdge | undefined {
        if (!(incoming instanceof StandardLudicNavigationEdge)) {
            throw new Error('Cannot merge a Navigation edge with a different kind')
        }
        const merged = this._edge.merge(incoming._edge)
        return merged ? new StandardLudicNavigationEdge(merged) : undefined
    }

    diff(incoming: LudicEdgeListItem | undefined): StandardLudicNavigationEdge | undefined {
        if (incoming !== undefined && !(incoming instanceof StandardLudicNavigationEdge)) {
            throw new Error('Cannot diff a Navigation edge with a different kind')
        }
        const diffed = this._edge.diff(incoming?._edge)
        return diffed ? new StandardLudicNavigationEdge(diffed) : undefined
    }

    invert(): StandardLudicNavigationEdge {
        return new StandardLudicNavigationEdge(this._edge.invert())
    }

    equals(other: LudicEdgeListItem): boolean {
        return other instanceof StandardLudicNavigationEdge && this._edge.equals(other._edge)
    }

    toJSON(): StandardEditableData<StandardLudicNavigationEdgeData> {
        return mapEditableEnvelope(this._edge.toJSON(), exitDataToNavigation)
    }

    toFormat(format: ReferenceFormat): StandardLudicNavigationEdge {
        return new StandardLudicNavigationEdge(this._edge.toFormat(format))
    }

    lookup(mappings: LookupMappings): StandardLudicNavigationEdge {
        return new StandardLudicNavigationEdge(this._edge.lookup(mappings))
    }

    schemaNode(): GenericTreeNode<SchemaTag> {
        return this._edge.schema()
    }
}

/**
 * Membership (`In`/`On`/`PartOf`), Peer (`Under`/`Against`/`Custom`), and Bearing (Topology,
 * non-traversable). No WML surface tag, no author path this slice. Identity and list membership
 * follow the same add/remove-by-`ref`-sign convention every other list in this layer uses --
 * there is no author-provided uuid for these kinds yet, so structural sameKey (kind + endpoints
 * + label) is what "the same edge" means until one exists.
 */
export class StandardLudicRelationalEdge implements LudicEdgeListItem {
    readonly kind: Exclude<LudicEdgeKind, 'Navigation'>
    _from: StandardReference
    _to: StandardReference
    _edgeId?: string
    _chainId?: string
    _relationLabel?: string
    _ref: number

    constructor(arg: StandardLudicRelationalEdge | (StandardLudicRelationalEdgeData & { ref?: number })) {
        if (arg instanceof StandardLudicRelationalEdge) {
            this.kind = arg.kind
            this._from = arg._from.clone()
            this._to = arg._to.clone()
            this._edgeId = arg._edgeId
            this._chainId = arg._chainId
            this._relationLabel = arg._relationLabel
            this._ref = arg._ref
            return
        }
        this.kind = arg.kind
        this._from = new StandardReference(arg.from)
        this._to = new StandardReference(arg.to)
        this._edgeId = arg.edgeId
        this._chainId = arg.chainId
        this._relationLabel = arg.kind === 'Custom' ? arg.relationLabel : undefined
        this._ref = arg.ref ?? 1
    }

    get from(): StandardReference { return this._from }
    get to(): StandardReference { return this._to }
    get edgeId(): string | undefined { return this._edgeId }
    get chainId(): string | undefined { return this._chainId }
    get relationLabel(): string | undefined { return this._relationLabel }
    get ref(): number { return this._ref }

    sameKey(other: LudicEdgeListItem): boolean {
        if (!(other instanceof StandardLudicRelationalEdge)) {
            return false
        }
        return this.kind === other.kind &&
            this._from.sameKey(other._from) &&
            this._to.sameKey(other._to) &&
            this._relationLabel === other._relationLabel
    }

    clone(): StandardLudicRelationalEdge {
        return new StandardLudicRelationalEdge(this)
    }

    private withRef(ref: number): StandardLudicRelationalEdge {
        const data = this.toJSON() as StandardLudicRelationalEdgeData & { ref?: number }
        return new StandardLudicRelationalEdge({ ...data, ref })
    }

    merge(incoming: LudicEdgeListItem): StandardLudicRelationalEdge | undefined {
        if (!this.sameKey(incoming)) {
            throw new Error('Cannot merge relational edges with different kind/endpoints/label')
        }
        const mergedRef = this._ref + (incoming as StandardLudicRelationalEdge)._ref
        if (mergedRef === 0) {
            return undefined
        }
        return this.withRef(mergedRef)
    }

    diff(incoming: LudicEdgeListItem | undefined): StandardLudicRelationalEdge | undefined {
        if (!incoming) {
            return this.invert()
        }
        if (!this.sameKey(incoming)) {
            throw new Error('Cannot diff relational edges with different kind/endpoints/label')
        }
        const diffRef = (incoming as StandardLudicRelationalEdge)._ref - this._ref
        if (diffRef === 0) {
            return undefined
        }
        return this.withRef(diffRef)
    }

    invert(): StandardLudicRelationalEdge {
        return this.withRef(-this._ref)
    }

    equals(other: LudicEdgeListItem): boolean {
        return this.sameKey(other) &&
            this._edgeId === (other as StandardLudicRelationalEdge)._edgeId &&
            this._chainId === (other as StandardLudicRelationalEdge)._chainId &&
            this._ref === (other as StandardLudicRelationalEdge)._ref
    }

    toJSON(): StandardEditableData<StandardLudicRelationalEdgeData> {
        const base = {
            kind: this.kind,
            from: this._from.toJSON(),
            to: this._to.toJSON(),
            ...(this._edgeId !== undefined ? { edgeId: this._edgeId } : {}),
            ...(this._chainId !== undefined ? { chainId: this._chainId } : {}),
        }
        const data = (this.kind === 'Custom'
            ? { ...base, kind: 'Custom' as const, relationLabel: this._relationLabel! }
            : base) as StandardLudicRelationalEdgeData
        return (this._ref !== 1 ? { ...data, ref: this._ref } : data) as StandardEditableData<StandardLudicRelationalEdgeData>
    }

    toFormat(format: ReferenceFormat): StandardLudicRelationalEdge {
        const result = new StandardLudicRelationalEdge(this)
        result._from = this._from.toFormat(format)
        result._to = this._to.toFormat(format)
        return result
    }

    lookup(mappings: LookupMappings): StandardLudicRelationalEdge {
        const result = new StandardLudicRelationalEdge(this)
        result._from = this._from.lookup(mappings)
        result._to = this._to.lookup(mappings)
        return result
    }

    schemaNode(): undefined {
        return undefined
    }
}

const isLudicEdgeListItem = (arg: unknown): arg is LudicEdgeListItem =>
    arg instanceof StandardLudicNavigationEdge || arg instanceof StandardLudicRelationalEdge

const peekKind = (entry: StandardEditableData<StandardLudicEdgeData>): LudicEdgeKind => {
    if (typeof entry === 'object' && entry !== null && 'tag' in entry && (entry.tag === 'Remove' || entry.tag === 'Replace')) {
        return (entry as { match: StandardLudicEdgeData }).match.kind
    }
    return (entry as StandardLudicEdgeData).kind
}

const edgeItemFromJSON = (entry: StandardEditableData<StandardLudicEdgeData>): LudicEdgeListItem => {
    if (peekKind(entry) === 'Navigation') {
        return new StandardLudicNavigationEdge(entry)
    }
    return new StandardLudicRelationalEdge(entry as StandardLudicRelationalEdgeData)
}

export class LudicEdgeList {
    _items: LudicEdgeListItem[] = []

    constructor(arg: LudicEdgeList | LudicEdgeListItem[] | LudicEdgeListData) {
        if (arg instanceof LudicEdgeList) {
            this._items = arg._items.map((item) => item.clone())
            return
        }
        if (Array.isArray(arg)) {
            const items = arg.map((entry) => (isLudicEdgeListItem(entry) ? entry : edgeItemFromJSON(entry)))
            this._items = items.reduce<LudicEdgeListItem[]>((previous, item) => {
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
        throw new Error('Invalid argument for LudicEdgeList constructor')
    }

    _wrap(items: LudicEdgeListItem[]): LudicEdgeList {
        return new LudicEdgeList(items)
    }

    get items(): LudicEdgeListItem[] {
        return this._items
    }

    get payload(): LudicEdgeListItem[] {
        return this._items
    }

    get length(): number {
        return this._items.length
    }

    isEmpty(): boolean {
        return this._items.length === 0
    }

    toJSON(): LudicEdgeListData {
        return this._items.map((item) => item.toJSON())
    }

    get schema(): GenericTreeNode<SchemaTag>[] {
        return this._items.map((item) => item.schemaNode()).filter(excludeUndefined)
    }

    clone(): LudicEdgeList {
        return new LudicEdgeList(this)
    }

    equals(other: LudicEdgeList): boolean {
        if (!(other instanceof LudicEdgeList)) {
            return false
        }
        if (this._items.length !== other._items.length) {
            return false
        }
        const otherItems = [...other._items]
        for (const item of this._items) {
            const matchIndex = otherItems.findIndex((otherItem) => item.equals(otherItem))
            if (matchIndex === -1) {
                return false
            }
            otherItems.splice(matchIndex, 1)
        }
        return true
    }

    merge(incoming: LudicEdgeList): LudicEdgeList | undefined {
        const unmatchedBaseItems = this._items.filter((item) => !incoming._items.some((other) => item.sameKey(other)))
        const matchedOtherItems = incoming._items
            .map((incomingItem) => ({ incoming: incomingItem, base: this._items.find((item) => item.sameKey(incomingItem)) }))
            .filter((value): value is { incoming: LudicEdgeListItem; base: LudicEdgeListItem } => value.base !== undefined)
        const unmatchedOtherItems = incoming._items.filter((item) => !this._items.some((base) => base.sameKey(item)))

        const mergedItems = [
            ...unmatchedBaseItems,
            ...matchedOtherItems.map(({ base, incoming }) => base.merge(incoming)),
            ...unmatchedOtherItems,
        ].filter(excludeUndefined)

        if (mergedItems.length === 0) {
            return undefined
        }
        return this._wrap(mergedItems)
    }

    diff(incoming: LudicEdgeList): LudicEdgeList | undefined {
        const unmatchedBaseItems = this._items.filter((item) => !incoming._items.some((other) => item.sameKey(other)))
        const matchedOtherItems = incoming._items
            .map((incomingItem) => ({ incoming: incomingItem, base: this._items.find((item) => item.sameKey(incomingItem)) }))
            .filter((value): value is { incoming: LudicEdgeListItem; base: LudicEdgeListItem } => value.base !== undefined)
        const unmatchedOtherItems = incoming._items.filter((item) => !this._items.some((base) => base.sameKey(item)))

        const diffedItems = [
            ...unmatchedBaseItems.map((item) => item.invert()),
            ...matchedOtherItems.map(({ base, incoming }) => base.diff(incoming)),
            ...unmatchedOtherItems,
        ].filter(excludeUndefined)

        if (diffedItems.length === 0) {
            return undefined
        }
        return this._wrap(diffedItems)
    }

    invert(): LudicEdgeList {
        return this._wrap(this._items.map((item) => item.invert()))
    }

    toFormat(format: ReferenceFormat): LudicEdgeList {
        return this._wrap(this._items.map((item) => item.toFormat(format)))
    }

    lookup(mappings: LookupMappings): LudicEdgeList {
        return this._wrap(this._items.map((item) => item.lookup(mappings)))
    }

    filter(predicate: (item: LudicEdgeListItem) => boolean): LudicEdgeList {
        return this._wrap(this._items.filter(predicate))
    }

    byKind(kind: LudicEdgeKind): LudicEdgeListItem[] {
        return this._items.filter((item) => item.kind === kind)
    }
}
