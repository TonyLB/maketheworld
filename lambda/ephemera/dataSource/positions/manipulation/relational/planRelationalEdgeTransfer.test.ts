import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

jest.mock('../../../../internalCache', () => ({
    __esModule: true,
    default: {
        Positions: {
            getMembershipContainers: jest.fn(),
            getLudicGraph: jest.fn(),
        },
    },
}))

import internalCache from '../../../../internalCache'
import { planRelationalEdgeTransfer } from './planRelationalEdgeTransfer'
import { testLudicGraph } from '../../ludicGraph/testFixtures'
import type { EstablishRelationChange, GroundedReferent } from '../../../actions/enrich/objectManipulation/plan/planStep'

const getMembershipContainersMock = internalCache.Positions.getMembershipContainers as jest.MockedFunction<
    typeof internalCache.Positions.getMembershipContainers
>
const getLudicGraphMock = internalCache.Positions.getLudicGraph as jest.MockedFunction<
    typeof internalCache.Positions.getLudicGraph
>

const ROOM = 'ROOM#Cafe' as EphemeraRoomId
const BROOM = 'OBJECT#Broom' as EphemeraObjectId
const TABLE = 'OBJECT#Table' as EphemeraObjectId
const CHARACTER = 'CHARACTER#Alice' as EphemeraCharacterId

const establish = (subjectId: string, targetId: string): EstablishRelationChange<GroundedReferent> => ({
    kind: 'change',
    primitive: 'establishRelation',
    subject: { referentType: 'objectSpan', span: 'subject', groundedId: subjectId as never },
    target: { referentType: 'objectSpan', span: 'target', groundedId: targetId as never },
    relationKind: 'Custom', relationLabel: 'under',
})

describe('planRelationalEdgeTransfer', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('builds a one-leg establish chain when subject and target already share a host (live state)', async () => {
        getMembershipContainersMock.mockImplementation(async (id) => {
            if (id === BROOM || id === TABLE) {
                return [ROOM]
            }
            return []
        })
        getLudicGraphMock.mockResolvedValue(testLudicGraph(ROOM, {
            nodes: [
                { tag: 'Object', universalKey: BROOM },
                { tag: 'Object', universalKey: TABLE },
            ],
        }))

        const result = await planRelationalEdgeTransfer(establish(BROOM, TABLE))

        expect(result).toEqual({
            ok: true,
            steps: [{
                kind: 'establishRelation',
                subjectId: BROOM,
                targetId: TABLE,
                hostId: ROOM,
                relationKind: 'Custom', relationLabel: 'under',
            }],
        })
    })

    it('refuses a non-Object endpoint (a relational edge is Object-to-Object only)', async () => {
        const result = await planRelationalEdgeTransfer(establish(CHARACTER, TABLE))

        expect(result).toEqual({
            ok: false,
            errorCode: 'nonObjectEndpoint',
            errorMessage: expect.any(String),
        })
        expect(getMembershipContainersMock).not.toHaveBeenCalled()
    })

    it('refuses when no chain can be found (e.g. a dissolve with no existing edge)', async () => {
        getMembershipContainersMock.mockImplementation(async (id) => {
            if (id === BROOM || id === TABLE) {
                return [ROOM]
            }
            return []
        })
        getLudicGraphMock.mockResolvedValue(testLudicGraph(ROOM, {
            nodes: [
                { tag: 'Object', universalKey: BROOM },
                { tag: 'Object', universalKey: TABLE },
            ],
        }))

        const result = await planRelationalEdgeTransfer({
            ...establish(BROOM, TABLE),
            primitive: 'dissolveRelation',
        })

        expect(result.ok).toBe(false)
    })
})
