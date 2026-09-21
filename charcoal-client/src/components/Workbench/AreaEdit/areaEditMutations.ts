import { v4 as uuidv4 } from 'uuid'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardArea from '@tonylb/mtw-wml/ts/standardize/components/area'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import StandardLudicGraph from '@tonylb/mtw-wml/ts/standardize/components/ludicGraph'
import {
    LUDIC_GRAPH_NODE_TAGS,
    LudicGraphNodeTag
} from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/ludicGraph'
import {
    assertEdgeSatisfiesParticipantRule,
    edgeSatisfiesParticipantRule,
    findEdgesViolatingParticipantRule,
} from '@tonylb/mtw-wml/ts/standardize/components/areaTopologyValidation'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'
import { LudicEdgeList, StandardLudicNavigationEdge } from '@tonylb/mtw-wml/ts/standardize/keys/edges/ludicEdge'
import { referenceFromExitEndpoint } from '@tonylb/mtw-wml/ts/standardize/keys/edges/endpointReference'
import { StandardReferenceData } from '@tonylb/mtw-wml/ts/standardize/keys/dataTypes/reference'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import { componentDisplayLabel } from '../../../lib/componentDisplayLabel'

export { LUDIC_GRAPH_NODE_TAGS }
export type { LudicGraphNodeTag }

export function generateEdgeUuid(): string {
    return `edge-${uuidv4().slice(0, 8)}`
}

export function filterNodesByTag(nodes: ReferenceList, tag: LudicGraphNodeTag): ReferenceList {
    return new ReferenceList(nodes.payload.filter((ref) => ref.tag === tag))
}

export function mergeNodesTagSlice(
    fullNodes: ReferenceList,
    tag: LudicGraphNodeTag,
    tagSlice: ReferenceList
): ReferenceList {
    const other = fullNodes.payload.filter((ref) => ref.tag !== tag)
    return new ReferenceList([...other, ...tagSlice.payload])
}

// LG-8: `ludicGraph.nodes` is heterogeneous under alignment. These helpers operate on the
// component-node arm only (Area authoring never touches presence nodes), so reads go through
// `.componentRefs` and writes go through `.withComponentRefs` to avoid silently dropping any
// presence node already on the graph.
export function setAreaLudicGraphNodes(area: StandardArea, nodes: ReferenceList): void {
    const graphJSON = area.ludicGraph.toJSON() ?? {}
    area._payload._ludicGraph = new StandardLudicGraph({
        ...graphJSON,
        nodes: area.ludicGraph.nodes.withComponentRefs(nodes).toJSON()
    })
}

export function setAreaLudicGraphEdges(area: StandardArea, edges: LudicEdgeList): void {
    const graphJSON = area.ludicGraph.toJSON() ?? {}
    area._payload._ludicGraph = new StandardLudicGraph({
        ...graphJSON,
        edges: edges.toJSON()
    })
}

export function addNodeToArea(area: StandardArea, ref: StandardReference): StandardArea {
    return area.withChild(ref) as StandardArea
}

export function removeNodeFromArea(area: StandardArea, ref: StandardReference): StandardArea {
    return area.removeReferences([ref]) as StandardArea
}

export { assertEdgeSatisfiesParticipantRule, edgeSatisfiesParticipantRule }

export function findEdgesMissingParticipantEndpoint(area: StandardArea): StandardLudicNavigationEdge[] {
    return findEdgesViolatingParticipantRule(area)
}

export function addEmptyExitEdge(area: StandardArea, edgeUuid?: string): StandardLudicNavigationEdge {
    const uuid = edgeUuid ?? generateEdgeUuid()
    const newEdge = new StandardLudicNavigationEdge({
        kind: 'Navigation',
        uuid,
        payload: {}
    })
    const merged = area.ludicGraph.edges.merge(new LudicEdgeList([newEdge])) ?? new LudicEdgeList([newEdge])
    setAreaLudicGraphEdges(area, merged)
    return newEdge
}

export function addEdgeToArea(
    area: StandardArea,
    fromUniversalKey: ComponentUUID,
    toUniversalKey: ComponentUUID,
    edgeUuid?: string
): StandardLudicNavigationEdge {
    const uuid = edgeUuid ?? generateEdgeUuid()
    const newEdge = new StandardLudicNavigationEdge({
        kind: 'Navigation',
        uuid,
        from: { tag: 'Room', universalKey: fromUniversalKey },
        to: { tag: 'Room', universalKey: toUniversalKey },
        payload: {}
    })
    const merged = area.ludicGraph.edges.merge(new LudicEdgeList([newEdge])) ?? new LudicEdgeList([newEdge])
    setAreaLudicGraphEdges(area, merged)
    return newEdge
}

export function removeEdgeFromArea(area: StandardArea, edgeUuid: string): void {
    const remaining = area.ludicGraph.edges.items.filter((edge) => (
        !(edge instanceof StandardLudicNavigationEdge) || edge.uuid !== edgeUuid
    ))
    setAreaLudicGraphEdges(area, new LudicEdgeList(remaining))
}

export function updateEdgeInArea(
    area: StandardArea,
    edgeUuid: string,
    update: (edge: StandardLudicNavigationEdge) => StandardLudicNavigationEdge
): void {
    const items = area.ludicGraph.edges.items
    const index = items.findIndex((edge) => edge instanceof StandardLudicNavigationEdge && edge.uuid === edgeUuid)
    if (index === -1) {
        return
    }
    const updated = update(items[index] as StandardLudicNavigationEdge)
    const newItems = [...items]
    newItems[index] = updated
    setAreaLudicGraphEdges(area, new LudicEdgeList(newItems))
}

export function retargetEdgeEndpoint(
    edge: StandardLudicNavigationEdge,
    endpoint: 'from' | 'to',
    universalKey: ComponentUUID
): StandardLudicNavigationEdge {
    const edgeJSON = edge.toJSON()
    if (typeof edgeJSON === 'string' || ('tag' in edgeJSON && edgeJSON.tag === 'Remove')) {
        throw new Error('Cannot retarget removed edge')
    }
    const base = 'tag' in edgeJSON && edgeJSON.tag === 'Replace' ? edgeJSON.match : edgeJSON
    return new StandardLudicNavigationEdge({
        kind: 'Navigation',
        uuid: base.uuid,
        from: endpoint === 'from' ? { tag: 'Room', universalKey } : base.from,
        to: endpoint === 'to' ? { tag: 'Room', universalKey } : base.to,
        payload: base.payload ?? {}
    })
}

export function updateEdgePayloadLiteral(
    edge: StandardLudicNavigationEdge,
    field: 'forward' | 'back',
    value: string
): StandardLudicNavigationEdge {
    const edgeJSON = edge.toJSON()
    if (typeof edgeJSON === 'string' || ('tag' in edgeJSON && edgeJSON.tag === 'Remove')) {
        throw new Error('Cannot update removed edge')
    }
    const base = 'tag' in edgeJSON && edgeJSON.tag === 'Replace' ? edgeJSON.match : edgeJSON
    const payload = { ...(base.payload ?? {}) }
    if (value.trim()) {
        payload[field] = value
    } else {
        delete payload[field]
    }
    return new StandardLudicNavigationEdge({
        kind: 'Navigation',
        uuid: base.uuid,
        from: base.from,
        to: base.to,
        payload
    })
}

export function resolveEndpointReferenceData(
    edge: StandardLudicNavigationEdge,
    endpoint: 'from' | 'to'
): StandardReferenceData | undefined {
    const endpointValue = endpoint === 'from' ? edge.from : edge.to
    const ref = referenceFromExitEndpoint(endpointValue)
    return ref?.toJSON()
}

function participantRoomKeys(area: StandardArea): Set<ComponentUUID> {
    const keys = new Set<ComponentUUID>()
    for (const node of area.ludicGraph.nodes.componentRefs.payload) {
        if (node.tag === 'Room' && node.universalKey) {
            keys.add(node.universalKey as ComponentUUID)
        }
    }
    return keys
}

/**
 * When the other endpoint is resolved and not a participant, restrict this selector
 * to participant rooms only (portal nudge). Otherwise return undefined (full Room list).
 */
export function exitEndpointSelectorIsExcluded(
    area: StandardArea,
    edge: StandardLudicNavigationEdge,
    endpoint: 'from' | 'to'
): ((universalKey: ComponentUUID) => boolean) | undefined {
    const otherEndpoint = endpoint === 'from' ? edge.to : edge.from
    const otherRef = referenceFromExitEndpoint(otherEndpoint)
    if (!otherRef) {
        return undefined
    }
    const otherInGraph = area.ludicGraph.nodes.componentRefs.payload.some((node) => node.sameKey(otherRef))
    if (otherInGraph) {
        return undefined
    }
    const participantKeys = participantRoomKeys(area)
    return (universalKey: ComponentUUID) => !participantKeys.has(universalKey)
}

export function resolveEndpointLabel(
    edge: StandardLudicNavigationEdge,
    endpoint: 'from' | 'to',
    standardForm: StandardForm
): string {
    const refData = resolveEndpointReferenceData(edge, endpoint)
    if (!refData) {
        return '(unset)'
    }
    const ref = new StandardReference(refData)
    const universalKey = ref.universalKey
    if (universalKey) {
        const component = standardForm.byUniversalId[universalKey]
        if (component) {
            return componentDisplayLabel(component, { standardForm, fallbackLabel: 'Untitled' }) ?? 'Untitled'
        }
    }
    if (ref.key) {
        const byKey = standardForm.components.find(
            (component) => component.key === ref.key && component.tag === ref.tag
        )
        if (byKey) {
            return componentDisplayLabel(byKey, { standardForm, fallbackLabel: 'Untitled' }) ?? 'Untitled'
        }
        return ref.key
    }
    return 'Unknown'
}

export function literalPayloadValue(edge: StandardLudicNavigationEdge, field: 'forward' | 'back'): string {
    const payload = edge.payload
    if (!payload) {
        return ''
    }
    const literal = field === 'forward' ? payload.forward : payload.back
    if (!literal) {
        return ''
    }
    const json = literal.toJSON()
    return typeof json === 'string' ? json : ''
}
