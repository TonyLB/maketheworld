import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { DissolveEdgeRelationsChange, EdgeRelationEntry, GroundedReferent } from '../../../actions/enrich/objectManipulation/plan/planStep'
import { graphNodeRef } from '../../../actions/enrich/objectManipulation/plan/planStep'
import { testLudicGraph } from '../../ludicGraph/testFixtures'
import { bindEdgeRefs, mintEdgeRefs } from './edgeRefs'

const rope = 'OBJECT#Rope' as EphemeraObjectId
const pole = 'OBJECT#Pole' as EphemeraObjectId
const lab = 'ROOM#Lab' as EphemeraRoomId

const manner: EdgeRelationEntry<GroundedReferent> = { edgeRef: 'tyingEdge', from: graphNodeRef(rope), to: graphNodeRef(pole), relationKind: 'Custom', relationLabel: 'tied to' }
const secured: EdgeRelationEntry<GroundedReferent> = { edgeRef: 'secureEdge', from: graphNodeRef(rope), to: graphNodeRef(pole), relationKind: 'SecuredTo' }
const edgeOf = (entry: EdgeRelationEntry<GroundedReferent>) => (
    entry.relationKind === 'Custom'
        ? { from: rope, to: pole, kind: 'Custom' as const, relationLabel: entry.relationLabel }
        : { from: rope, to: pole, kind: 'SecuredTo' as const }
)

describe('mintEdgeRefs', () => {
    it('mints one distinct id per declared ref, and none for an entry that declares none', () => {
        const minted = mintEdgeRefs([manner, secured, { from: { edgeRef: 'tyingEdge' }, to: { edgeRef: 'secureEdge' }, relationKind: 'Justifies' }])
        expect(Object.keys(minted).sort()).toEqual(['secureEdge', 'tyingEdge'])
        expect(minted.tyingEdge).not.toEqual(minted.secureEdge)
    })
})

describe('bindEdgeRefs', () => {
    it('binds an assign\'s refs to the ids it carries, whatever the graph holds', () => {
        const refs = bindEdgeRefs({ kind: 'change', primitive: 'assignEdgeRelations', entries: [manner], mintedEdgeIds: { tyingEdge: 'm1' } }, testLudicGraph(lab), edgeOf)
        expect([...refs]).toEqual([['tyingEdge', 'm1']])
    })

    it('binds a dissolve\'s ref to the stored id of the edge its entry matches, and leaves it unbound when the edge is absent or has no id', () => {
        const change: DissolveEdgeRelationsChange<GroundedReferent> = {
            kind: 'change',
            primitive: 'dissolveEdgeRelations',
            entries: [{ ...manner, mustBePresent: false }, { ...secured, mustBePresent: false }],
        }
        const graph = testLudicGraph(lab, {
            nodes: [{ tag: 'Object', universalKey: rope }, { tag: 'Object', universalKey: pole }],
            edges: [{ tag: 'Relational', from: rope, to: pole, kind: 'Custom', relationLabel: 'tied to', edgeId: 'm1' }],
        })
        expect([...bindEdgeRefs(change, graph, edgeOf)]).toEqual([['tyingEdge', 'm1']])
    })
})
