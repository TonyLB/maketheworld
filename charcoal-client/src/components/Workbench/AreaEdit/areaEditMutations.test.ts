import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import StandardArea from '@tonylb/mtw-wml/ts/standardize/components/area'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'
import { StandardExitEdge } from '@tonylb/mtw-wml/ts/standardize/keys/edges/exitEdge'
import {
    addEdgeToArea,
    addNodeToArea,
    assertEdgeSatisfiesParticipantRule,
    edgeSatisfiesParticipantRule,
    filterNodesByTag,
    findEdgesMissingParticipantEndpoint,
    mergeNodesTagSlice,
    removeEdgeFromArea,
    removeNodeFromArea,
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
        const roomNodes = filterNodesByTag(area.positionGraph.nodes, 'Room')
        expect(roomNodes.payload).toHaveLength(2)
        const featureRef = new StandardReference({ tag: 'Feature', key: 'feat1', universalKey: 'FEATURE#feat1' })
        const merged = mergeNodesTagSlice(area.positionGraph.nodes, 'Feature', new ReferenceList([featureRef]))
        expect(merged.payload.some((ref) => ref.tag === 'Feature')).toBe(true)
        expect(merged.payload.filter((ref) => ref.tag === 'Room')).toHaveLength(2)
    })

    it('adds and removes nodes via withChild/removeReferences', () => {
        const area = getArea()
        const featureRef = new StandardReference({ tag: 'Feature', universalKey: 'FEATURE#new' })
        const withFeature = addNodeToArea(area, featureRef)
        expect(withFeature.positionGraph.nodes.payload.some((ref) => ref.universalKey === 'FEATURE#new')).toBe(true)

        const withoutFeature = removeNodeFromArea(withFeature, featureRef)
        expect(withoutFeature.positionGraph.nodes.payload.some((ref) => ref.universalKey === 'FEATURE#new')).toBe(false)
    })

    it('adds edge when participant endpoint rule satisfied', () => {
        const area = getArea()
        addEdgeToArea(area, 'ROOM#highway', 'ROOM#town', 'highwayToTown')
        expect(area.positionGraph.edges.items).toHaveLength(1)
        expect(area.positionGraph.edges.items[0].uuid).toEqual('highwayToTown')
        expect(edgeSatisfiesParticipantRule(area, area.positionGraph.edges.items[0])).toBe(true)
    })

    it('rejects edge when participant endpoint rule violated', () => {
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
        expect(() => addEdgeToArea(area, 'ROOM#a', 'ROOM#b', 'orphan')).toThrow(/requires at least one endpoint in positionGraph.nodes/)
    })

    it('retargets To on same uuid and updates payload literals', () => {
        const area = getArea()
        addEdgeToArea(area, 'ROOM#highway', 'ROOM#town', 'highwayToTown')
        updateEdgeInArea(area, 'highwayToTown', (edge) => retargetEdgeEndpoint(edge, 'to', 'ROOM#highway'))
        const edge = area.positionGraph.edges.items[0]
        const toRef = edge.to
        expect(edge.uuid).toEqual('highwayToTown')

        updateEdgeInArea(area, 'highwayToTown', (current) =>
            updateEdgePayloadLiteral(current, 'forward', 'east')
        )
        expect(updateEdgePayloadLiteral(area.positionGraph.edges.items[0], 'forward', 'east')).toBeTruthy()
        const updated = area.positionGraph.edges.items[0]
        expect(updated.payload?.forward?.toJSON()).toEqual('east')
    })

    it('removes edge by uuid', () => {
        const area = getArea()
        addEdgeToArea(area, 'ROOM#highway', 'ROOM#town', 'highwayToTown')
        removeEdgeFromArea(area, 'highwayToTown')
        expect(area.positionGraph.edges.items).toHaveLength(0)
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
        expect(() => assertEdgeSatisfiesParticipantRule(withoutBoth, violations[0])).toThrow(/requires at least one endpoint in positionGraph.nodes/)
    })
})
