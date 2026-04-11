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

    it('register and list round-trip', () => {
        const reg = makeRegistration()
        cache.register(reg, { kind: 'stub' })
        const listed = cache.list('ROOM#test', 'pk-one')
        expect(listed).toHaveLength(1)
        expect(listed[0].thread).toEqual({ kind: 'stub' })
        expect(listed[0].registration.characterId).toBe(reg.characterId)
        expect(listed[0].registrationId).toMatch(/^[\da-f-]{36}$/i)
    })

    it('register stores caller registrationId when provided', () => {
        const reg = makeRegistration({ registrationId: 'custom-reg-id' })
        cache.register(reg, { kind: 'stub' })
        expect(cache.list('ROOM#test', 'pk-one')[0].registrationId).toBe('custom-reg-id')
    })

    it('update shallow-merges when registrationId matches', () => {
        const reg = makeRegistration()
        cache.register(reg, roomDescriptionInitial())
        const { registrationId } = cache.list('ROOM#test', 'pk-one')[0]
        const ok = cache.update(
            { componentId: 'ROOM#test', perspectiveKey: 'pk-one', registrationId },
            { status: 'Generating', messageId: 'MESSAGE#m1' }
        )
        expect(ok).toBe(true)
        const t = cache.list('ROOM#test', 'pk-one')[0].thread
        expect(t).toMatchObject({
            kind: 'roomDescription',
            status: 'Generating',
            messageId: 'MESSAGE#m1',
        })
    })

    it('update returns false when registrationId mismatches', () => {
        cache.register(makeRegistration(), roomDescriptionInitial())
        const ok = cache.update(
            { componentId: 'ROOM#test', perspectiveKey: 'pk-one', registrationId: 'wrong' },
            { status: 'Terminal' }
        )
        expect(ok).toBe(false)
        expect((cache.list('ROOM#test', 'pk-one')[0].thread as { status: string }).status).toBe('Initial')
    })

    it('two registers under same composite key coexist', () => {
        cache.register(makeRegistration({ perspectiveKey: 'same', characterId: 'CHARACTER#one' }), { kind: 'stub' })
        cache.register(makeRegistration({ perspectiveKey: 'same', characterId: 'CHARACTER#two' }), { kind: 'stub' })
        const listed = cache.list('ROOM#test', 'same')
        expect(listed).toHaveLength(2)
        const chars = listed.map((e) => e.registration.characterId).sort()
        expect(chars).toEqual(['CHARACTER#one', 'CHARACTER#two'].sort())
    })

    it('remove drops one entry and leaves sibling', () => {
        cache.register(makeRegistration({ perspectiveKey: 'same', registrationId: 'r1' }), { kind: 'stub' })
        cache.register(makeRegistration({ perspectiveKey: 'same', registrationId: 'r2' }), { kind: 'stub' })
        cache.remove({ componentId: 'ROOM#test', perspectiveKey: 'same', registrationId: 'r1' })
        const listed = cache.list('ROOM#test', 'same')
        expect(listed).toHaveLength(1)
        expect(listed[0].registrationId).toBe('r2')
    })

    it('remove clears bucket when last entry removed', () => {
        cache.register(makeRegistration(), { kind: 'stub' })
        const { registrationId } = cache.list('ROOM#test', 'pk-one')[0]
        cache.remove({ componentId: 'ROOM#test', perspectiveKey: 'pk-one', registrationId })
        expect(cache.list('ROOM#test', 'pk-one')).toEqual([])
    })

    it('clear removes all entries', () => {
        cache.register(makeRegistration(), { kind: 'stub' })
        cache.clear()
        expect(cache.list('ROOM#test', 'pk-one')).toEqual([])
    })

    it('list returns empty array for missing key', () => {
        expect(cache.list('ROOM#x', 'y')).toEqual([])
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
