import PerceptionThreadsData, {
    isCharacterMovePerceptionThread,
    isPerceptionThread,
    isRoomDescriptionPerceptionThread,
    isRoomHeaderBroadcastPerceptionThread,
    isStubPerceptionThread,
    mergePerceptionThreadPatch,
    type RoomDescriptionPerceptionThread,
    type RoomHeaderBroadcastPerceptionThread,
} from './perceptionThreads'
import type { PerceptionThreadRegisterCommand } from '../dataSource/perception/localApiEvents'

const makeRoomRegistration = (
    overrides: Partial<Extract<PerceptionThreadRegisterCommand, { threadKind: 'roomDescription' }>> = {}
): Extract<PerceptionThreadRegisterCommand, { threadKind: 'roomDescription' }> => ({
    threadKind: 'roomDescription',
    componentId: 'ROOM#test',
    perspectiveKey: 'pk-one',
    characterId: 'CHARACTER#viewer',
    ...overrides,
})

const makeStubRegistration = (
    overrides: Partial<Extract<PerceptionThreadRegisterCommand, { threadKind: 'stub' }>> = {}
): Extract<PerceptionThreadRegisterCommand, { threadKind: 'stub' }> => ({
    threadKind: 'stub',
    componentId: 'FEATURE#test',
    perspectiveKey: 'pk-one',
    ...overrides,
})

const makeHeaderBroadcastRegistration = (
    overrides: Partial<Extract<PerceptionThreadRegisterCommand, { threadKind: 'roomHeaderBroadcast' }>> = {}
): Extract<PerceptionThreadRegisterCommand, { threadKind: 'roomHeaderBroadcast' }> => ({
    threadKind: 'roomHeaderBroadcast',
    componentId: 'ROOM#test',
    perspectiveKey: 'pk-one',
    targets: ['CHARACTER#a', 'CHARACTER#b'],
    ...overrides,
})

const makeCharacterMoveRegistration = (
    overrides: Partial<Extract<PerceptionThreadRegisterCommand, { threadKind: 'characterMove' }>> = {}
): Extract<PerceptionThreadRegisterCommand, { threadKind: 'characterMove' }> => ({
    threadKind: 'characterMove',
    componentId: 'ROOM#test',
    perspectiveKey: 'pk-one',
    characterId: 'CHARACTER#mover',
    departureRoomId: 'ROOM#from',
    messageGroupId: 'MSG#root',
    leaveMessageGroupId: 'MSG#leave',
    arriveMessageGroupId: 'MSG#arrive',
    ...overrides,
})

const roomDescriptionInitial = (): RoomDescriptionPerceptionThread => ({
    kind: 'roomDescription',
    status: 'Initial',
})

const roomHeaderBroadcastInitial = (): RoomHeaderBroadcastPerceptionThread => ({
    kind: 'roomHeaderBroadcast',
    status: 'Initial',
})

describe('PerceptionThreadsData', () => {
    let cache: PerceptionThreadsData

    beforeEach(() => {
        cache = new PerceptionThreadsData()
    })

    it('register and list round-trip', () => {
        const reg = makeStubRegistration()
        cache.register(reg)
        const listed = cache.list('FEATURE#test', 'pk-one')
        expect(listed).toHaveLength(1)
        expect(listed[0].thread).toEqual({ kind: 'stub' })
        expect(listed[0].registration.threadKind).toBe('stub')
        expect(listed[0].registrationId).toMatch(/^[\da-f-]{36}$/i)
    })

    it('register stores caller registrationId when provided', () => {
        const reg = makeStubRegistration({ registrationId: 'custom-reg-id' })
        cache.register(reg)
        expect(cache.list('FEATURE#test', 'pk-one')[0].registrationId).toBe('custom-reg-id')
    })

    it('update shallow-merges when registrationId matches', () => {
        const reg = makeRoomRegistration()
        cache.register(reg)
        const { registrationId } = cache.list('ROOM#test', 'pk-one')[0]
        const ok = cache.update(
            { componentId: 'ROOM#test', perspectiveKey: 'pk-one', registrationId },
            { threadKind: 'roomDescription', status: 'Generating', messageId: 'MESSAGE#m1' }
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
        cache.register(makeRoomRegistration())
        const ok = cache.update(
            { componentId: 'ROOM#test', perspectiveKey: 'pk-one', registrationId: 'wrong' },
            { threadKind: 'roomDescription', status: 'Terminal' }
        )
        expect(ok).toBe(false)
        expect((cache.list('ROOM#test', 'pk-one')[0].thread as { status: string }).status).toBe('Initial')
    })

    it('update throws on stub row', () => {
        cache.register(makeStubRegistration())
        const { registrationId } = cache.list('FEATURE#test', 'pk-one')[0]
        expect(() =>
            cache.update(
                { componentId: 'FEATURE#test', perspectiveKey: 'pk-one', registrationId },
                { status: 'Generating' }
            )
        ).toThrow('stub threads do not support updates')
    })

    it('update throws on roomDescription patch with unknown key', () => {
        cache.register(makeRoomRegistration())
        const { registrationId } = cache.list('ROOM#test', 'pk-one')[0]
        expect(() =>
            cache.update(
                { componentId: 'ROOM#test', perspectiveKey: 'pk-one', registrationId },
                { threadKind: 'roomDescription', mesageId: 'MESSAGE#typo' } as unknown
            )
        ).toThrow('not a valid PerceptionThreadPatch')
    })

    it('update throws when patch uses legacy kind field instead of threadKind', () => {
        cache.register(makeRoomRegistration())
        const { registrationId } = cache.list('ROOM#test', 'pk-one')[0]
        expect(() =>
            cache.update(
                { componentId: 'ROOM#test', perspectiveKey: 'pk-one', registrationId },
                { kind: 'roomDescription' } as unknown
            )
        ).toThrow('not a valid PerceptionThreadPatch')
    })

    it('update throws when patch threadKind does not match roomDescription row', () => {
        cache.register(makeRoomRegistration())
        const { registrationId } = cache.list('ROOM#test', 'pk-one')[0]
        expect(() =>
            cache.update(
                { componentId: 'ROOM#test', perspectiveKey: 'pk-one', registrationId },
                { threadKind: 'stub' }
            )
        ).toThrow('stub patch requires stub thread')
    })

    it('update throws on roomDescription patch with invalid status', () => {
        cache.register(makeRoomRegistration())
        const { registrationId } = cache.list('ROOM#test', 'pk-one')[0]
        expect(() =>
            cache.update(
                { componentId: 'ROOM#test', perspectiveKey: 'pk-one', registrationId },
                { threadKind: 'roomDescription', status: 'bogus' } as unknown
            )
        ).toThrow('not a valid PerceptionThreadPatch')
    })

    it('update throws on roomDescription patch with non-string messageId', () => {
        cache.register(makeRoomRegistration())
        const { registrationId } = cache.list('ROOM#test', 'pk-one')[0]
        expect(() =>
            cache.update(
                { componentId: 'ROOM#test', perspectiveKey: 'pk-one', registrationId },
                { threadKind: 'roomDescription', messageId: 123 } as unknown
            )
        ).toThrow('not a valid PerceptionThreadPatch')
    })

    it('update throws when patch is not a plain object', () => {
        cache.register(makeRoomRegistration())
        const { registrationId } = cache.list('ROOM#test', 'pk-one')[0]
        expect(() =>
            cache.update(
                { componentId: 'ROOM#test', perspectiveKey: 'pk-one', registrationId },
                null
            )
        ).toThrow('not a valid PerceptionThreadPatch')
    })

    it('two registers under same composite key coexist', () => {
        cache.register(makeStubRegistration({ perspectiveKey: 'same', characterId: 'CHARACTER#one' }))
        cache.register(makeStubRegistration({ perspectiveKey: 'same', characterId: 'CHARACTER#two' }))
        const listed = cache.list('FEATURE#test', 'same')
        expect(listed).toHaveLength(2)
        const chars = listed
            .map((e) => (e.registration.threadKind === 'stub' ? e.registration.characterId : undefined))
            .filter((c) => c !== undefined)
            .sort()
        expect(chars).toEqual(['CHARACTER#one', 'CHARACTER#two'].sort())
    })

    it('remove drops one entry and leaves sibling', () => {
        cache.register(makeStubRegistration({ perspectiveKey: 'same', registrationId: 'r1' }))
        cache.register(makeStubRegistration({ perspectiveKey: 'same', registrationId: 'r2' }))
        cache.remove({ componentId: 'FEATURE#test', perspectiveKey: 'same', registrationId: 'r1' })
        const listed = cache.list('FEATURE#test', 'same')
        expect(listed).toHaveLength(1)
        expect(listed[0].registrationId).toBe('r2')
    })

    it('remove clears bucket when last entry removed', () => {
        cache.register(makeStubRegistration())
        const { registrationId } = cache.list('FEATURE#test', 'pk-one')[0]
        cache.remove({ componentId: 'FEATURE#test', perspectiveKey: 'pk-one', registrationId })
        expect(cache.list('FEATURE#test', 'pk-one')).toEqual([])
    })

    it('clear removes all entries', () => {
        cache.register(makeStubRegistration())
        cache.clear()
        expect(cache.list('FEATURE#test', 'pk-one')).toEqual([])
    })

    it('list returns empty array for missing key', () => {
        expect(cache.list('ROOM#x', 'y')).toEqual([])
    })

    it('register roomHeaderBroadcast stores Initial thread and targets', () => {
        cache.register(makeHeaderBroadcastRegistration())
        const listed = cache.list('ROOM#test', 'pk-one')
        expect(listed).toHaveLength(1)
        expect(listed[0].thread).toEqual({ kind: 'roomHeaderBroadcast', status: 'Initial' })
        expect(listed[0].registration.threadKind).toBe('roomHeaderBroadcast')
        expect((listed[0].registration as { targets: string[] }).targets).toEqual(['CHARACTER#a', 'CHARACTER#b'])
    })

    it('update merges roomHeaderBroadcast thread', () => {
        cache.register(makeHeaderBroadcastRegistration())
        const { registrationId } = cache.list('ROOM#test', 'pk-one')[0]
        const ok = cache.update(
            { componentId: 'ROOM#test', perspectiveKey: 'pk-one', registrationId },
            { threadKind: 'roomHeaderBroadcast', status: 'Generating', messageId: 'MESSAGE#h1' }
        )
        expect(ok).toBe(true)
        expect(cache.list('ROOM#test', 'pk-one')[0].thread).toMatchObject({
            kind: 'roomHeaderBroadcast',
            status: 'Generating',
            messageId: 'MESSAGE#h1',
        })
    })

    it('register characterMove stores Initial thread', () => {
        cache.register(makeCharacterMoveRegistration())
        const listed = cache.list('ROOM#test', 'pk-one')
        expect(listed).toHaveLength(1)
        expect(listed[0].thread).toEqual({ kind: 'characterMove', status: 'Initial' })
        expect(listed[0].registration.threadKind).toBe('characterMove')
    })

    it('update merges characterMove thread and registration leaveWorldMessage', () => {
        cache.register(makeCharacterMoveRegistration())
        const { registrationId } = cache.list('ROOM#test', 'pk-one')[0]
        const ok = cache.update(
            { componentId: 'ROOM#test', perspectiveKey: 'pk-one', registrationId },
            {
                threadKind: 'characterMove',
                status: 'Generating',
                messageId: 'MESSAGE#cm1',
                leaveWorldMessage: { targets: ['ROOM#from'], message: ['bye'] },
            }
        )
        expect(ok).toBe(true)
        const row = cache.list('ROOM#test', 'pk-one')[0]
        expect(row.thread).toMatchObject({
            kind: 'characterMove',
            status: 'Generating',
            messageId: 'MESSAGE#cm1',
        })
        expect(row.registration.threadKind).toBe('characterMove')
        if (row.registration.threadKind === 'characterMove') {
            expect(row.registration.leaveWorldMessage).toEqual({ targets: ['ROOM#from'], message: ['bye'] })
        }
    })
})

describe('mergePerceptionThreadPatch roomHeaderBroadcast', () => {
    it('merges status and messageId', () => {
        const base = roomHeaderBroadcastInitial()
        const merged = mergePerceptionThreadPatch(base, {
            threadKind: 'roomHeaderBroadcast',
            status: 'Generating',
            messageId: 'MESSAGE#x',
        })
        expect(merged).toMatchObject({
            kind: 'roomHeaderBroadcast',
            status: 'Generating',
            messageId: 'MESSAGE#x',
        })
    })
})

describe('mergePerceptionThreadPatch characterMove', () => {
    it('merges status stripping registration-only patch fields from thread body', () => {
        const base = { kind: 'characterMove' as const, status: 'Initial' as const }
        const merged = mergePerceptionThreadPatch(base, {
            threadKind: 'characterMove',
            status: 'Generating',
            messageId: 'MESSAGE#cm',
            leaveWorldMessage: { targets: ['ROOM#r'], message: ['x'] },
        })
        expect(merged).toEqual({
            kind: 'characterMove',
            status: 'Generating',
            messageId: 'MESSAGE#cm',
        })
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

    it('accepts roomHeaderBroadcast shape', () => {
        const t = roomHeaderBroadcastInitial()
        expect(isRoomHeaderBroadcastPerceptionThread(t)).toBe(true)
        expect(isPerceptionThread(t)).toBe(true)
    })

    it('accepts characterMove shape', () => {
        const t = { kind: 'characterMove' as const, status: 'Initial' as const }
        expect(isCharacterMovePerceptionThread(t)).toBe(true)
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
