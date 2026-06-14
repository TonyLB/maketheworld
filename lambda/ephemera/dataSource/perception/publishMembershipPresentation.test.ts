import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    buildMembershipArriveSuffix,
    buildMembershipLeaveSuffix,
    MEMBERSHIP_BEAT_EPSILON_MS,
    publishMembershipPresentation,
} from './publishMembershipPresentation'
import type { MembershipEmissionPlan } from './membershipPresentationFanIn'

const CHARACTER_ID = 'CHARACTER#Alice' as EphemeraCharacterId
const ROOM_A = 'ROOM#a' as EphemeraRoomId
const ROOM_B = 'ROOM#b' as EphemeraRoomId
const ANCHOR = 1_700_000_000_000

const basePlan = (overrides: Partial<MembershipEmissionPlan> = {}): MembershipEmissionPlan => ({
    shape: 'leaveAndArrive',
    copyKind: 'genericNavigate',
    beatAnchorTime: ANCHOR,
    characterId: CHARACTER_ID,
    from: ROOM_A,
    to: ROOM_B,
    characterName: 'Alice',
    ...overrides,
})

describe('publishMembershipPresentation', () => {
    describe('copy suffix helpers', () => {
        it('builds exit-aware leave suffix', () => {
            expect(buildMembershipLeaveSuffix('exitAware', 'north')).toBe(' left by north exit.')
        })

        it('builds home, disconnect, and generic leave suffixes', () => {
            expect(buildMembershipLeaveSuffix('home')).toBe(' left to return home.')
            expect(buildMembershipLeaveSuffix('disconnect')).toBe(' has disconnected.')
            expect(buildMembershipLeaveSuffix('genericNavigate')).toBe(' has left.')
        })

        it('builds connect and generic arrive suffixes', () => {
            expect(buildMembershipArriveSuffix('connect')).toBe(' has connected.')
            expect(buildMembershipArriveSuffix('genericNavigate')).toBe(' has arrived.')
        })
    })

    it('publishes leave and arrive with Model A anchor times for cross-room moves', () => {
        const messageBus = { publish: jest.fn() }

        publishMembershipPresentation(messageBus as any, basePlan())

        expect(messageBus.publish).toHaveBeenCalledTimes(2)
        expect(messageBus.publish).toHaveBeenNthCalledWith(1, {
            type: 'PublishMessage',
            targets: [ROOM_A, CHARACTER_ID],
            displayProtocol: 'WorldMessage',
            message: ['Alice has left.'],
            createdTime: ANCHOR - MEMBERSHIP_BEAT_EPSILON_MS,
            deliveryMode: 'deferred',
        })
        expect(messageBus.publish).toHaveBeenNthCalledWith(2, {
            type: 'PublishMessage',
            targets: [ROOM_B, CHARACTER_ID],
            displayProtocol: 'WorldMessage',
            message: ['Alice has arrived.'],
            createdTime: ANCHOR + MEMBERSHIP_BEAT_EPSILON_MS,
            deliveryMode: 'deferred',
        })
    })

    it('publishes exit-aware leave copy when plan carries exitName', () => {
        const messageBus = { publish: jest.fn() }

        publishMembershipPresentation(messageBus as any, basePlan({
            copyKind: 'exitAware',
            exitName: 'north',
        }))

        expect(messageBus.publish).toHaveBeenNthCalledWith(1, expect.objectContaining({
            message: ['Alice left by north exit.'],
        }))
    })

    it('publishes leave-only disconnect copy', () => {
        const messageBus = { publish: jest.fn() }

        publishMembershipPresentation(messageBus as any, basePlan({
            shape: 'leaveOnly',
            copyKind: 'disconnect',
            to: null,
        }))

        expect(messageBus.publish).toHaveBeenCalledTimes(1)
        expect(messageBus.publish).toHaveBeenCalledWith(expect.objectContaining({
            targets: [ROOM_A, CHARACTER_ID],
            message: ['Alice has disconnected.'],
            createdTime: ANCHOR - MEMBERSHIP_BEAT_EPSILON_MS,
        }))
    })

    it('publishes arrive-only connect copy', () => {
        const messageBus = { publish: jest.fn() }

        publishMembershipPresentation(messageBus as any, basePlan({
            shape: 'arriveOnly',
            copyKind: 'connect',
            from: null,
        }))

        expect(messageBus.publish).toHaveBeenCalledTimes(1)
        expect(messageBus.publish).toHaveBeenCalledWith(expect.objectContaining({
            targets: [ROOM_B, CHARACTER_ID],
            message: ['Alice has connected.'],
            createdTime: ANCHOR + MEMBERSHIP_BEAT_EPSILON_MS,
        }))
    })

    it('skips publish when shape is none', () => {
        const messageBus = { publish: jest.fn() }

        publishMembershipPresentation(messageBus as any, basePlan({
            shape: 'none',
            from: ROOM_A,
            to: ROOM_A,
        }))

        expect(messageBus.publish).not.toHaveBeenCalled()
    })
})
