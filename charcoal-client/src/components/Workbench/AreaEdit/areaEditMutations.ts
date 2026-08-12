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
import { ExitEdgeList, StandardExitEdge } from '@tonylb/mtw-wml/ts/standardize/keys/edges/exitEdge'
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

export function setAreaLudicGraphNodes(area: StandardArea, nodes: ReferenceList): void {
    const graphJSON = area.ludicGraph.toJSON() ?? {}
    area._payload._ludicGraph = new StandardLudicGraph({
        ...graphJSON,
        nodes: nodes.toJSON()
    })
}

export function setAreaLudicGraphEdges(area: StandardArea, edges: ExitEdgeList): void {
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

export function findEdgesMissingParticipantEndpoint(area: StandardArea): StandardExitEdge[] {
    return findEdgesViolatingParticipantRule(area)
}

export function addEmptyExitEdge(area: StandardArea, edgeUuid?: string): StandardExitEdge {
    const uuid = edgeUuid ?? generateEdgeUuid()
    const newEdge = new StandardExitEdge({
        tag: 'Exit',
        uuid,
        payload: {}
    })
    const merged = area.ludicGraph.edges.merge(new ExitEdgeList([newEdge])) ?? new ExitEdgeList([newEdge])
    setAreaLudicGraphEdges(area, merged)
    return newEdge
}

export function addEdgeToArea(
    area: StandardArea,
    fromUniversalKey: ComponentUUID,
    toUniversalKey: ComponentUUID,
    edgeUuid?: string
): StandardExitEdge {
    const uuid = edgeUuid ?? generateEdgeUuid()
    const newEdge = new StandardExitEdge({
        tag: 'Exit',
        uuid,
        from: { tag: 'Room', universalKey: fromUniversalKey },
        to: { tag: 'Room', universalKey: toUniversalKey },
        payload: {}
    })
    const merged = area.ludicGraph.edges.merge(new ExitEdgeList([newEdge])) ?? new ExitEdgeList([newEdge])
    setAreaLudicGraphEdges(area, merged)
    return newEdge
}

export function removeEdgeFromArea(area: StandardArea, edgeUuid: string): void {
    const remaining = area.ludicGraph.edges.items.filter((edge) => edge.uuid !== edgeUuid)
    setAreaLudicGraphEdges(area, new ExitEdgeList(remaining))
}

export function updateEdgeInArea(
    area: StandardArea,
    edgeUuid: string,
    update: (edge: StandardExitEdge) => StandardExitEdge
): void {
    const items = area.ludicGraph.edges.items
    const index = items.findIndex((edge) => edge.uuid === edgeUuid)
    if (index === -1) {
        return
    }
    const updated = update(items[index])
    const newItems = [...items]
    newItems[index] = updated
    setAreaLudicGraphEdges(area, new ExitEdgeList(newItems))
}

export function retargetEdgeEndpoint(
    edge: StandardExitEdge,
    endpoint: 'from' | 'to',
    universalKey: ComponentUUID
): StandardExitEdge {
    const edgeJSON = edge.toJSON()
    if (typeof edgeJSON === 'string' || edgeJSON.tag === 'Remove') {
        throw new Error('Cannot retarget removed edge')
    }
    const base = edgeJSON.tag === 'Replace' ? edgeJSON.match : edgeJSON
    return new StandardExitEdge({
        tag: 'Exit',
        uuid: base.uuid,
        from: endpoint === 'from' ? { tag: 'Room', universalKey } : base.from,
        to: endpoint === 'to' ? { tag: 'Room', universalKey } : base.to,
        payload: base.payload ?? {}
    })
}

export function updateEdgePayloadLiteral(
    edge: StandardExitEdge,
    field: 'forward' | 'back',
    value: string
): StandardExitEdge {
    const edgeJSON = edge.toJSON()
    if (typeof edgeJSON === 'string' || edgeJSON.tag === 'Remove') {
        throw new Error('Cannot update removed edge')
    }
    const base = edgeJSON.tag === 'Replace' ? edgeJSON.match : edgeJSON
    const payload = { ...(base.payload ?? {}) }
    if (value.trim()) {
        payload[field] = value
    } else {
        delete payload[field]
    }
    return new StandardExitEdge({
        tag: 'Exit',
        uuid: base.uuid,
        from: base.from,
        to: base.to,
        payload
    })
}

export function resolveEndpointReferenceData(
    edge: StandardExitEdge,
    endpoint: 'from' | 'to'
): StandardReferenceData | undefined {
    const endpointValue = endpoint === 'from' ? edge.from : edge.to
    const ref = referenceFromExitEndpoint(endpointValue)
    return ref?.toJSON()
}

function participantRoomKeys(area: StandardArea): Set<ComponentUUID> {
    const keys = new Set<ComponentUUID>()
    for (const node of area.ludicGraph.nodes.payload) {
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
    edge: StandardExitEdge,
    endpoint: 'from' | 'to'
): ((universalKey: ComponentUUID) => boolean) | undefined {
    const otherEndpoint = endpoint === 'from' ? edge.to : edge.from
    const otherRef = referenceFromExitEndpoint(otherEndpoint)
    if (!otherRef) {
        return undefined
    }
    const otherInGraph = area.ludicGraph.nodes.payload.some((node) => node.sameKey(otherRef))
    if (otherInGraph) {
        return undefined
    }
    const participantKeys = participantRoomKeys(area)
    return (universalKey: ComponentUUID) => !participantKeys.has(universalKey)
}

export function resolveEndpointLabel(
    edge: StandardExitEdge,
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

export function literalPayloadValue(edge: StandardExitEdge, field: 'forward' | 'back'): string {
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
