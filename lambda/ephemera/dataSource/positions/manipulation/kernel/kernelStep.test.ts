import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { ExecutorParsePlanStep } from '../../../actions/enrich/objectManipulation/synthesize/executorTypes'
import { fromExecutorStep } from './kernelStep'

const trayId = 'OBJECT#Tray' as EphemeraObjectId
const glassId = 'OBJECT#Glass' as EphemeraObjectId
const roomId = 'ROOM#Cafe' as EphemeraRoomId
const characterId = 'CHARACTER#Alpha' as EphemeraCharacterId

describe('fromExecutorStep', () => {
    it('converts a TransferMembershipStep to a KernelTransferMembershipStep with the same object ids as entityIds', () => {
        const step: ExecutorParsePlanStep = {
            kind: 'transferMembership',
            objectIds: new Set([trayId, glassId]),
            fromHostId: roomId,
            toHostId: characterId,
        }
        expect(fromExecutorStep(step)).toEqual({
            kind: 'transferMembership',
            entityIds: new Set([trayId, glassId]),
            fromHostIds: new Set([roomId]),
            toHostId: characterId,
        })
    })

    it('passes an establishRelation step through unchanged', () => {
        const step: ExecutorParsePlanStep = {
            kind: 'establishRelation',
            subjectId: trayId,
            targetId: glassId,
            relationKind: 'On',
        }
        expect(fromExecutorStep(step)).toEqual(step)
    })

    it('passes a dissolveRelation step through unchanged', () => {
        const step: ExecutorParsePlanStep = {
            kind: 'dissolveRelation',
            subjectId: trayId,
            targetId: glassId,
            relationKind: 'On',
        }
        expect(fromExecutorStep(step)).toEqual(step)
    })
})
