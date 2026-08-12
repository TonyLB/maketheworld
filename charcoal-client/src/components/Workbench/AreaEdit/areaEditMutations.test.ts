import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import StandardArea from '@tonylb/mtw-wml/ts/standardize/components/area'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'
import { StandardExitEdge } from '@tonylb/mtw-wml/ts/standardize/keys/edges/exitEdge'
import { referenceFromExitEndpoint } from '@tonylb/mtw-wml/ts/standardize/keys/edges/endpointReference'
import {
    addEdgeToArea,
    addEmptyExitEdge,
    addNodeToArea,
    assertEdgeSatisfiesParticipantRule,
    edgeSatisfiesParticipantRule,
    exitEndpointSelectorIsExcluded,
    filterNodesByTag,
    findEdgesMissingParticipantEndpoint,
    mergeNodesTagSlice,
    removeEdgeFromArea,
    removeNodeFromArea,
    resolveEndpointLabel,
    retargetEdgeEndpoint,
    updateEdgeInArea,
    updateEdgePayloadLiteral
} from './areaEditMutations'

const baseWML = deIndentWML(`
    <Asset uuid=(test)>
        <Area uuid=(AREA#district) key=(district)>
            <ShortName>District</ShortName>
            <Room uuid=(ROOM#highway) />
            <Room uuid=(ROOM#town) />
        </Area>
        <Room uuid=(ROOM#highway) key=(highway)><ShortName>Highway</ShortName></Room>
        <Room uuid=(ROOM#town) key=(town)><ShortName>Town</ShortName></Room>
    </Asset>
`)

describe('areaEditMutations', () => {
    const getArea = (): StandardArea => {
        const form = new StandardForm(baseWML)
        const area = form.byUniversalId['AREA#district']
        if (!(area instanceof StandardArea)) {
            throw new Error('Expected StandardArea')
        }
        return area
    }

    it('filters and merges nodes by tag', () => {
        const area = getArea()
        const roomNodes = filterNodesByTag(area.ludicGraph.nodes, 'Room')
        expect(roomNodes.payload).toHaveLength(2)
        const featureRef = new StandardReference({ tag: 'Feature', key: 'feat1', universalKey: 'FEATURE#feat1' })
        const merged = mergeNodesTagSlice(area.ludicGraph.nodes, 'Feature', new ReferenceList([featureRef]))
        expect(merged.payload.some((ref) => ref.tag === 'Feature')).toBe(true)
        expect(merged.payload.filter((ref) => ref.tag === 'Room')).toHaveLength(2)
    })

    it('adds and removes nodes via withChild/removeReferences', () => {
        const area = getArea()
        const featureRef = new StandardReference({ tag: 'Feature', universalKey: 'FEATURE#new' })
        const withFeature = addNodeToArea(area, featureRef)
        expect(withFeature.ludicGraph.nodes.payload.some((ref) => ref.universalKey === 'FEATURE#new')).toBe(true)

        const withoutFeature = removeNodeFromArea(withFeature, featureRef)
        expect(withoutFeature.ludicGraph.nodes.payload.some((ref) => ref.universalKey === 'FEATURE#new')).toBe(false)
    })

    it('adds edge when participant endpoint rule satisfied', () => {
        const area = getArea()
        addEdgeToArea(area, 'ROOM#highway', 'ROOM#town', 'highwayToTown')
        expect(area.ludicGraph.edges.items).toHaveLength(1)
        expect(area.ludicGraph.edges.items[0].uuid).toEqual('highwayToTown')
        expect(edgeSatisfiesParticipantRule(area, area.ludicGraph.edges.items[0])).toBe(true)
    })

    it('stores edge when participant endpoint rule violated', () => {
        const form = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Area uuid=(AREA#empty) key=(empty) />
                <Room uuid=(ROOM#a) />
                <Room uuid=(ROOM#b) />
            </Asset>
        `))
        const area = form.byUniversalId['AREA#empty']
        if (!(area instanceof StandardArea)) {
            throw new Error('Expected StandardArea')
        }
        addEdgeToArea(area, 'ROOM#a', 'ROOM#b', 'orphan')
        expect(area.ludicGraph.edges.items).toHaveLength(1)
        expect(area.ludicGraph.edges.items[0].uuid).toEqual('orphan')
        expect(edgeSatisfiesParticipantRule(area, area.ludicGraph.edges.items[0])).toBe(false)
    })

    it('addEmptyExitEdge creates uuid-only stub in graph', () => {
        const area = getArea()
        const edge = addEmptyExitEdge(area)
        expect(area.ludicGraph.edges.items).toHaveLength(1)
        expect(edge.uuid).toBeTruthy()
        expect(edge.toJSON()).toEqual({
            tag: 'Exit',
            uuid: edge.uuid,
            payload: {},
        })
    })

    it('addEmptyExitEdge accepts optional edgeUuid', () => {
        const area = getArea()
        const edge = addEmptyExitEdge(area, 'customStub')
        expect(edge.uuid).toEqual('customStub')
        expect(area.ludicGraph.edges.items[0].uuid).toEqual('customStub')
    })

    it('retargets From on stub via updateEdgeInArea', () => {
        const area = getArea()
        addEmptyExitEdge(area, 'stubEdge')
        updateEdgeInArea(area, 'stubEdge', (edge) => retargetEdgeEndpoint(edge, 'from', 'ROOM#highway'))
        const edge = area.ludicGraph.edges.items[0]
        expect(referenceFromExitEndpoint(edge.from)?.universalKey).toEqual('ROOM#highway')
        expect(referenceFromExitEndpoint(edge.to)).toBeUndefined()
    })

    it('retargets To on stub via updateEdgeInArea', () => {
        const area = getArea()
        addEmptyExitEdge(area, 'stubEdge')
        updateEdgeInArea(area, 'stubEdge', (edge) => retargetEdgeEndpoint(edge, 'to', 'ROOM#town'))
        const edge = area.ludicGraph.edges.items[0]
        expect(referenceFromExitEndpoint(edge.to)?.universalKey).toEqual('ROOM#town')
        expect(referenceFromExitEndpoint(edge.from)).toBeUndefined()
    })

    it('excludes uuid-only stub from findEdgesMissingParticipantEndpoint', () => {
        const area = getArea()
        addEmptyExitEdge(area, 'stubEdge')
        expect(findEdgesMissingParticipantEndpoint(area)).toHaveLength(0)
    })

    it('retargets To on same uuid and updates payload literals', () => {
        const area = getArea()
        addEdgeToArea(area, 'ROOM#highway', 'ROOM#town', 'highwayToTown')
        updateEdgeInArea(area, 'highwayToTown', (edge) => retargetEdgeEndpoint(edge, 'to', 'ROOM#highway'))
        const edge = area.ludicGraph.edges.items[0]
        const toRef = edge.to
        expect(edge.uuid).toEqual('highwayToTown')

        updateEdgeInArea(area, 'highwayToTown', (current) =>
            updateEdgePayloadLiteral(current, 'forward', 'east')
        )
        expect(updateEdgePayloadLiteral(area.ludicGraph.edges.items[0], 'forward', 'east')).toBeTruthy()
        const updated = area.ludicGraph.edges.items[0]
        expect(updated.payload?.forward?.toJSON()).toEqual('east')
    })

    it('removes edge by uuid', () => {
        const area = getArea()
        addEdgeToArea(area, 'ROOM#highway', 'ROOM#town', 'highwayToTown')
        removeEdgeFromArea(area, 'highwayToTown')
        expect(area.ludicGraph.edges.items).toHaveLength(0)
    })

    it('finds edges missing participant endpoint after node removal', () => {
        const area = getArea()
        addEdgeToArea(area, 'ROOM#highway', 'ROOM#town', 'highwayToTown')
        const highwayRef = new StandardReference({ tag: 'Room', universalKey: 'ROOM#highway' })
        const townRef = new StandardReference({ tag: 'Room', universalKey: 'ROOM#town' })
        const withoutHighway = removeNodeFromArea(area, highwayRef)
        const withoutBoth = removeNodeFromArea(withoutHighway, townRef)
        const violations = findEdgesMissingParticipantEndpoint(withoutBoth)
        expect(violations).toHaveLength(1)
        expect(violations[0].uuid).toEqual('highwayToTown')
        expect(() => assertEdgeSatisfiesParticipantRule(withoutBoth, violations[0])).toThrow(/requires at least one endpoint in ludicGraph.nodes/)
    })

    it('resolveEndpointLabel returns (unset) for absent endpoint', () => {
        const form = new StandardForm(baseWML)
        const area = getArea()
        addEmptyExitEdge(area, 'stubEdge')
        const edge = area.ludicGraph.edges.items[0]
        expect(resolveEndpointLabel(edge, 'from', form)).toEqual('(unset)')
        expect(resolveEndpointLabel(edge, 'to', form)).toEqual('(unset)')
    })

    describe('exitEndpointSelectorIsExcluded', () => {
        it('returns undefined for stub edge with both endpoints unset', () => {
            const area = getArea()
            addEmptyExitEdge(area, 'stubEdge')
            const edge = area.ludicGraph.edges.items[0]
            expect(exitEndpointSelectorIsExcluded(area, edge, 'from')).toBeUndefined()
            expect(exitEndpointSelectorIsExcluded(area, edge, 'to')).toBeUndefined()
        })

        it('returns undefined for To selector when From is participant', () => {
            const area = getArea()
            addEmptyExitEdge(area, 'stubEdge')
            updateEdgeInArea(area, 'stubEdge', (e) => retargetEdgeEndpoint(e, 'from', 'ROOM#highway'))
            const edge = area.ludicGraph.edges.items[0]
            expect(exitEndpointSelectorIsExcluded(area, edge, 'to')).toBeUndefined()
        })

        it('restricts From selector when To is non-participant', () => {
            const form = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Area uuid=(AREA#district) key=(district)>
                        <Room uuid=(ROOM#highway) />
                    </Area>
                    <Room uuid=(ROOM#highway) key=(highway)><ShortName>Highway</ShortName></Room>
                    <Room uuid=(ROOM#outside) key=(outside)><ShortName>Outside</ShortName></Room>
                </Asset>
            `))
            const area = form.byUniversalId['AREA#district']
            if (!(area instanceof StandardArea)) {
                throw new Error('Expected StandardArea')
            }
            addEmptyExitEdge(area, 'portalEdge')
            updateEdgeInArea(area, 'portalEdge', (e) => retargetEdgeEndpoint(e, 'to', 'ROOM#outside'))
            const edge = area.ludicGraph.edges.items[0]
            const isExcluded = exitEndpointSelectorIsExcluded(area, edge, 'from')
            expect(isExcluded).toBeDefined()
            expect(isExcluded!('ROOM#highway' as ComponentUUID)).toBe(false)
            expect(isExcluded!('ROOM#outside' as ComponentUUID)).toBe(true)
        })

        it('restricts To selector when From is non-participant', () => {
            const form = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Area uuid=(AREA#district) key=(district)>
                        <Room uuid=(ROOM#highway) />
                    </Area>
                    <Room uuid=(ROOM#highway) key=(highway)><ShortName>Highway</ShortName></Room>
                    <Room uuid=(ROOM#outside) key=(outside)><ShortName>Outside</ShortName></Room>
                </Asset>
            `))
            const area = form.byUniversalId['AREA#district']
            if (!(area instanceof StandardArea)) {
                throw new Error('Expected StandardArea')
            }
            addEmptyExitEdge(area, 'portalEdge')
            updateEdgeInArea(area, 'portalEdge', (e) => retargetEdgeEndpoint(e, 'from', 'ROOM#outside'))
            const edge = area.ludicGraph.edges.items[0]
            const isExcluded = exitEndpointSelectorIsExcluded(area, edge, 'to')
            expect(isExcluded).toBeDefined()
            expect(isExcluded!('ROOM#highway' as ComponentUUID)).toBe(false)
            expect(isExcluded!('ROOM#outside' as ComponentUUID)).toBe(true)
        })
    })
})
