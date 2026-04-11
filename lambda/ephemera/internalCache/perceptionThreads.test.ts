import PerceptionThreadsData, {
    isPerceptionThread,
    isRoomDescriptionPerceptionThread,
    isStubPerceptionThread,
    type RoomDescriptionPerceptionThread,
} from './perceptionThreads'
import type { PerceptionThreadRegisteredCommand } from '../dataSource/perception/localApiEvents'

const makeRegistration = (overrides: Partial<PerceptionThreadRegisteredCommand> = {}): PerceptionThreadRegisteredCommand => ({
    componentId: 'ROOM#test',
    perspectiveKey: 'pk-one',
    characterId: 'CHARACTER#viewer',
    ...overrides,
})

const roomDescriptionInitial = (): RoomDescriptionPerceptionThread => ({
    kind: 'roomDescription',
    status: 'Initial',
})

describe('PerceptionThreadsData', () => {
    let cache: PerceptionThreadsData

    beforeEach(() => {
        cache = new PerceptionThreadsData()
    })

    it('set and get round-trip', () => {
        const reg = makeRegistration()
        cache.set(reg, { kind: 'stub' })
        const got = cache.get('ROOM#test', 'pk-one')
        expect(got?.thread).toEqual({ kind: 'stub' })
        expect(got?.registration).toEqual(reg)
        expect(got?.registrationId).toMatch(/^[\da-f-]{36}$/i)
    })

    it('set stores caller registrationId when provided', () => {
        const reg = makeRegistration({ registrationId: 'custom-reg-id' })
        cache.set(reg, { kind: 'stub' })
        expect(cache.get('ROOM#test', 'pk-one')?.registrationId).toBe('custom-reg-id')
    })

    it('update shallow-merges when registrationId matches', () => {
        const reg = makeRegistration()
        cache.set(reg, roomDescriptionInitial())
        const { registrationId } = cache.get('ROOM#test', 'pk-one')!
        const ok = cache.update(
            { componentId: 'ROOM#test', perspectiveKey: 'pk-one', registrationId },
            { status: 'Generating', messageId: 'MESSAGE#m1' }
        )
        expect(ok).toBe(true)
        const t = cache.get('ROOM#test', 'pk-one')!.thread
        expect(t).toMatchObject({
            kind: 'roomDescription',
            status: 'Generating',
            messageId: 'MESSAGE#m1',
        })
    })

    it('update returns false when registrationId mismatches', () => {
        cache.set(makeRegistration(), roomDescriptionInitial())
        const ok = cache.update(
            { componentId: 'ROOM#test', perspectiveKey: 'pk-one', registrationId: 'wrong' },
            { status: 'Terminal' }
        )
        expect(ok).toBe(false)
        expect((cache.get('ROOM#test', 'pk-one')!.thread as { status: string }).status).toBe('Initial')
    })

    it('last set wins for same componentId and perspectiveKey', () => {
        cache.set(makeRegistration({ perspectiveKey: 'same' }), { kind: 'stub' })
        cache.set(makeRegistration({ perspectiveKey: 'same', characterId: 'CHARACTER#two' }), { kind: 'stub' })
        expect(cache.get('ROOM#test', 'same')?.registration.characterId).toBe('CHARACTER#two')
    })

    it('delete removes entry', () => {
        cache.set(makeRegistration(), { kind: 'stub' })
        cache.delete('ROOM#test', 'pk-one')
        expect(cache.get('ROOM#test', 'pk-one')).toBeUndefined()
    })

    it('clear removes all entries', () => {
        cache.set(makeRegistration(), { kind: 'stub' })
        cache.clear()
        expect(cache.get('ROOM#test', 'pk-one')).toBeUndefined()
    })

    it('get returns undefined for missing key', () => {
        expect(cache.get('ROOM#x', 'y')).toBeUndefined()
    })
})

describe('isStubPerceptionThread / isRoomDescriptionPerceptionThread / isPerceptionThread', () => {
    it('accepts stub shape', () => {
        expect(isStubPerceptionThread({ kind: 'stub' })).toBe(true)
        expect(isPerceptionThread({ kind: 'stub' })).toBe(true)
    })

    it('accepts roomDescription shape', () => {
        const t = roomDescriptionInitial()
        expect(isRoomDescriptionPerceptionThread(t)).toBe(true)
        expect(isPerceptionThread(t)).toBe(true)
    })

    it('rejects wrong kind', () => {
        expect(isStubPerceptionThread({ kind: 'other' })).toBe(false)
        expect(isStubPerceptionThread(null)).toBe(false)
        expect(isStubPerceptionThread({})).toBe(false)
    })

    it('rejects roomDescription with invalid status', () => {
        expect(isRoomDescriptionPerceptionThread({
            kind: 'roomDescription',
            status: 'Unknown',
        })).toBe(false)
    })
})
