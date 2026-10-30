import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EdgeRelationsChange, GroundedReferent, ObjectSpanReferent } from '../../../actions/enrich/objectManipulation/plan/planStep'
import type { ParseSkeleton } from '../../../actions/enrich/objectManipulation/parse/parseToken'
import { mapEdgeRelationReferents, withGroundedId } from '../../../actions/enrich/objectManipulation/plan/planStep'
import { matchTemplate } from '../../../actions/enrich/objectManipulation/plan/attemptTemplateFixture'
import { tieTemplate, untieTemplate } from '../../../actions/enrich/objectManipulation/plan/matchSecuredToTemplates'
import type { EphemeraLudicGraph } from '../../ludicGraph'
import { presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import { applyStepSequenceCore } from '../kernel/applyStepSequenceCore'
import { edgeRelationSteps, edgeRelationsHost } from './edgeRelationSteps'

const rope = 'OBJECT#Rope' as EphemeraObjectId
const pole = 'OBJECT#Pole' as EphemeraObjectId
const coin = 'OBJECT#Coin' as EphemeraObjectId
const jar = 'OBJECT#Jar' as EphemeraObjectId
const lab = 'ROOM#Lab' as EphemeraRoomId

const IDS: Record<string, EphemeraObjectId> = { rope, pole, coin, jar }

/** The change a template builds for `verb subject link target`, each span grounded to its object. */
const changeOf = (template: typeof tieTemplate, [verb, subject, link, target]: [string, string, string, string]): EdgeRelationsChange<GroundedReferent> => {
    const skeleton: ParseSkeleton = [
        { type: 'text', text: verb },
        { type: 'objectSpan', span: subject, stableRefKey: `${subject}Ref` },
        { type: 'text', text: link },
        { type: 'objectSpan', span: target, stableRefKey: `${target}Ref` },
    ]
    const result = matchTemplate(template)(skeleton, `${verb} ${subject} ${link} ${target}`)
    if (result.type !== 'matched') {
        throw new Error('expected a match')
    }
    const change = result.attempt.actions()[0]!.desiredResult as EdgeRelationsChange
    return mapEdgeRelationReferents(change, (referent) => withGroundedId(referent, IDS[(referent as ObjectSpanReferent).span]!))
}

const tie = (subject = 'rope', target = 'pole') => changeOf(tieTemplate, ['tie', subject, 'to', target])
const untie = (subject = 'rope', target = 'pole') => changeOf(untieTemplate, ['untie', subject, 'from', target])

const manner = { from: rope, to: pole, kind: 'Custom' as const, relationLabel: 'tied to' }
const secured = { from: rope, to: pole, kind: 'SecuredTo' as const }
const justifies = (from: string, to: string) => ({ from: { edgeId: from }, to: { edgeId: to }, kind: 'Justifies' as const })

const labWith = (edges: Record<string, unknown>[] = []) => testLudicGraph(lab, {
    nodes: [
        { tag: 'Object', universalKey: rope, hostingKind: 'In' },
        { tag: 'Object', universalKey: pole, hostingKind: 'In' },
        { tag: 'Object', universalKey: jar, hostingKind: 'In' },
        presenceBindingNode('Base'),
    ],
    edges: edges.map((edge) => ({ tag: 'Relational', ...edge })) as any,
})
/** The jar's own graph: its root and the coin in it. */
const jarHolding = () => testLudicGraph(jar, { nodes: [{ tag: 'Object', universalKey: jar }, { tag: 'Object', universalKey: coin, hostingKind: 'In' }] })
const tiedLab = () => labWith([{ ...manner, edgeId: 'm1' }, { ...secured, edgeId: 's1' }, justifies('m1', 's1')])

const apply = (steps: ReturnType<typeof edgeRelationSteps>, graph: EphemeraLudicGraph) => {
    if (!steps.ok) {
        throw new Error(`expected steps, got ${steps.refusal}`)
    }
    const outcome = applyStepSequenceCore(steps.steps, new Map([[lab as EphemeraMembershipHostId, graph]]))
    if (outcome.verdict !== 'legal') {
        throw new Error(`expected legal, got ${outcome.verdict}`)
    }
    return outcome.graphs.get(lab)!.relationalEdges
}

describe('edgeRelationsHost', () => {
    it('is the one candidate graph holding every thing the change names', () => {
        const graph = labWith()
        expect(edgeRelationsHost(tie(), [[lab, graph], [rope, testLudicGraph(rope)]])).toEqual({ ok: true, hostId: lab, graph })
    })

    it('is the host graph for a member and its own host root (the coin to its jar)', () => {
        expect(edgeRelationsHost(tie('coin', 'jar'), [[jar, jarHolding()], [lab, labWith()]])).toMatchObject({ ok: true, hostId: jar })
    })

    it('refuses a crossing (no graph holds both) and an ambiguous pair (two graphs do)', () => {
        expect(edgeRelationsHost(tie('rope', 'coin'), [[lab, labWith()], [jar, jarHolding()]])).toEqual({ ok: false, refusal: 'notInOneGraph' })
        expect(edgeRelationsHost(tie(), [[lab, labWith()], [jar, testLudicGraph(jar, { nodes: [{ tag: 'Object', universalKey: rope }, { tag: 'Object', universalKey: pole }] })]]))
            .toEqual({ ok: false, refusal: 'ambiguousGraph' })
    })
})

describe('edgeRelationSteps', () => {
    it('lowers tie to five steps: both establishes, both ids, then the Justifies naming them', () => {
        const change = tie()
        if (change.primitive !== 'assignEdgeRelations') throw new Error('expected an assign')
        const { tyingEdge, secureEdge } = change.mintedEdgeIds
        const result = edgeRelationSteps(change, lab, labWith())
        expect(result).toEqual({
            ok: true,
            steps: [
                { kind: 'establishRelation', hostId: lab, subjectId: rope, targetId: pole, relationKind: 'Custom', relationLabel: 'tied to' },
                { kind: 'establishRelation', hostId: lab, subjectId: rope, targetId: pole, relationKind: 'SecuredTo' },
                { kind: 'assignEdgeId', hostId: lab, edge: manner, edgeId: tyingEdge },
                { kind: 'assignEdgeId', hostId: lab, edge: secured, edgeId: secureEdge },
                { kind: 'establishRelation', hostId: lab, subjectId: { edgeId: tyingEdge }, targetId: { edgeId: secureEdge }, relationKind: 'Justifies' },
            ],
        })
        expect(apply(result, labWith())).toEqual([
            { ...manner, edgeId: tyingEdge },
            { ...secured, edgeId: secureEdge },
            justifies(tyingEdge!, secureEdge!),
        ])
    })

    it('refuses a tie whose edge already holds', () => {
        expect(edgeRelationSteps(tie(), lab, labWith([manner]))).toEqual({ ok: false, refusal: 'alreadyPresent' })
    })

    it('lowers untie of the whole triple to three dissolves, the Justifies first, leaving no edge', () => {
        const result = edgeRelationSteps(untie(), lab, tiedLab())
        expect(result).toMatchObject({ ok: true, steps: [{ relationKind: 'Justifies' }, { relationKind: 'SecuredTo' }, { relationKind: 'Custom' }] })
        expect(apply(result, tiedLab())).toEqual([])
    })

    it.each([
        ['the manner edge alone', [manner]],
        ['the SecuredTo alone', [secured]],
        ['both edges, no Justifies', [{ ...manner, edgeId: 'm1' }, { ...secured, edgeId: 's1' }]],
    ])('unties %s', (_label, edges) => {
        expect(apply(edgeRelationSteps(untie(), lab, labWith(edges)), labWith(edges))).toEqual([])
    })

    it('refuses an untie when none of the triple holds, including the reverse direction', () => {
        expect(edgeRelationSteps(untie(), lab, labWith())).toEqual({ ok: false, refusal: 'nonePresent' })
        expect(edgeRelationSteps(untie('pole', 'rope'), lab, tiedLab())).toEqual({ ok: false, refusal: 'nonePresent' })
    })

    it('refuses a dissolve whose mustBePresent entry is absent', () => {
        const change = untie()
        if (change.primitive !== 'dissolveEdgeRelations') throw new Error('expected a dissolve')
        const strict = { ...change, entries: change.entries.map((entry) => ({ ...entry, mustBePresent: entry.relationKind === 'SecuredTo' })) }
        expect(edgeRelationSteps(strict, lab, labWith([manner]))).toEqual({ ok: false, refusal: 'requiredAbsent' })
    })
})
