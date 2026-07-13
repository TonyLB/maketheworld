import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import {
    RUNTIME_PRIMITIVE_NAMES,
    isDissolveRelationStep,
    isEstablishRelationStep,
    isRuntimePrimitiveName,
    isTransferMembershipStep,
    type DissolveRelationStep,
    type EstablishRelationStep,
    type ParsePlanStep,
    type TransferMembershipStep,
} from './parsePlanStep'

const roomId = 'ROOM#Bridge' as EphemeraRoomId
const characterId = 'CHARACTER#Player' as EphemeraCharacterId
const trayId = 'OBJECT#Tray' as EphemeraObjectId
const glassId = 'OBJECT#Glass' as EphemeraObjectId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const cordId = 'OBJECT#Cord' as EphemeraObjectId
const crateId = 'OBJECT#Crate' as EphemeraObjectId

describe('RUNTIME_PRIMITIVE_NAMES / isRuntimePrimitiveName', () => {
    it('has exactly the three expected runtime primitives', () => {
        expect(RUNTIME_PRIMITIVE_NAMES).toEqual(['transferMembership', 'establishRelation', 'dissolveRelation'])
    })

    it.each(RUNTIME_PRIMITIVE_NAMES)('accepts %s as a runtime primitive name', (name) => {
        expect(isRuntimePrimitiveName(name)).toBe(true)
    })

    it('rejects an arbitrary string', () => {
        expect(isRuntimePrimitiveName('teleport')).toBe(false)
    })

    it('rejects resolveComponent --- grounding is not an executable step', () => {
        expect(isRuntimePrimitiveName('resolveComponent')).toBe(false)
    })

    it('rejects non-string values', () => {
        expect(isRuntimePrimitiveName(undefined)).toBe(false)
        expect(isRuntimePrimitiveName(42)).toBe(false)
    })
})

describe('ParsePlanStep variants + type guards', () => {
    it('constructs a multi-member transferMembership step and narrows via its guard', () => {
        const step: ParsePlanStep = {
            kind: 'transferMembership',
            objectIds: new Set([trayId, glassId]),
            fromHostId: roomId,
            toHostId: characterId,
        }
        expect(isTransferMembershipStep(step)).toBe(true)
        if (isTransferMembershipStep(step)) {
            const narrowed: TransferMembershipStep = step
            expect(narrowed.objectIds.has(glassId)).toBe(true)
        }
        expect(isEstablishRelationStep(step)).toBe(false)
        expect(isDissolveRelationStep(step)).toBe(false)
    })

    it('constructs an establishRelation step and narrows via its guard', () => {
        const step: ParsePlanStep = {
            kind: 'establishRelation',
            subjectId: glassId,
            targetId: tableId,
            relationKind: 'On',
            hostRoomId: roomId,
        }
        expect(isEstablishRelationStep(step)).toBe(true)
        if (isEstablishRelationStep(step)) {
            const narrowed: EstablishRelationStep = step
            expect(narrowed.relationKind).toBe('On')
        }
    })

    it('constructs a dissolveRelation step with a custom relation label and narrows via its guard', () => {
        const step: ParsePlanStep = {
            kind: 'dissolveRelation',
            subjectId: cordId,
            targetId: crateId,
            relationKind: 'Custom',
            relationLabel: 'tied around',
            hostRoomId: roomId,
        }
        expect(isDissolveRelationStep(step)).toBe(true)
        if (isDissolveRelationStep(step)) {
            const narrowed: DissolveRelationStep = step
            expect(narrowed.relationLabel).toBe('tied around')
        }
    })
})
