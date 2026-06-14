import PerceptionThreadsData, {
    isCharacterMovePerceptionThread,
    isPerceptionThread,
    isRoomDescriptionPerceptionThread,
    isRoomHeaderBroadcastPerceptionThread,
    isSessionOrientationAffordancesPerceptionThread,
    isSessionOrientationRenderPerceptionThread,
    mergePerceptionThreadPatch,
    type RoomDescriptionPerceptionThread,
    type RoomHeaderBroadcastPerceptionThread,
    type SessionOrientationRenderPerceptionThread,
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

const makeHeaderBroadcastRegistration = (
    overrides: Partial<Extract<PerceptionThreadRegisterCommand, { threadKind: 'roomHeaderBroadcast' }>> = {}
): Extract<PerceptionThreadRegisterCommand, { threadKind: 'roomHeaderBroadcast' }> => ({
    threadKind: 'roomHeaderBroadcast',
    componentId: 'ROOM#test',
    perspectiveKey: 'pk-one',
    targets: ['CHARACTER#a', 'CHARACTER#b'],
    ...overrides,
})

const makeSessionOrientationRenderRegistration = (
    overrides: Partial<Extract<PerceptionThreadRegisterCommand, { threadKind: 'sessionOrientationRender' }>> = {}
): Extract<PerceptionThreadRegisterCommand, { threadKind: 'sessionOrientationRender' }> => ({
    threadKind: 'sessionOrientationRender',
    componentId: 'ROOM#test',
    perspectiveKey: 'pk-one',
    characterId: 'CHARACTER#viewer',
    targets: ['SESSION#session-1'],
    ...overrides,
})

const makeSessionOrientationAffordancesRegistration = (
    overrides: Partial<Extract<PerceptionThreadRegisterCommand, { threadKind: 'sessionOrientationAffordances' }>> = {}
): Extract<PerceptionThreadRegisterCommand, { threadKind: 'sessionOrientationAffordances' }> => ({
    threadKind: 'sessionOrientationAffordances',
    componentId: 'ROOM#test',
    perspectiveKey: 'pk-one',
    characterId: 'CHARACTER#viewer',
    targets: ['SESSION#session-1'],
    ...overrides,
})

const makeCharacterMoveRegistration = (
    overrides: Partial<Extract<PerceptionThreadRegisterCommand, { threadKind: 'characterMove' }>> = {}
): Extract<PerceptionThreadRegisterCommand, { threadKind: 'characterMove' }> => ({
    threadKind: 'characterMove',
    componentId: 'ROOM#test',
    perspectiveKey: 'pk-one',
    characterId: 'CHARACTER#mover',
    targets: ['CHARACTER#mover'],
    messageGroupId: 'MSG#root',
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
        const reg = makeRoomRegistration()
        cache.register(reg)
        const listed = cache.list('ROOM#test', 'pk-one')
        expect(listed).toHaveLength(1)
        expect(listed[0].thread).toEqual({ kind: 'roomDescription', status: 'Initial' })
        expect(listed[0].registration.threadKind).toBe('roomDescription')
        expect(listed[0].registrationId).toMatch(/^[\da-f-]{36}$/i)
    })

    it('register stores caller registrationId when provided', () => {
        const reg = makeRoomRegistration({ registrationId: 'custom-reg-id' })
        cache.register(reg)
        expect(cache.list('ROOM#test', 'pk-one')[0].registrationId).toBe('custom-reg-id')
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

    it('update stores createdTime on render-correlated thread kinds', () => {
        const reg = makeRoomRegistration()
        cache.register(reg)
        const { registrationId } = cache.list('ROOM#test', 'pk-one')[0]
        const ok = cache.update(
            { componentId: 'ROOM#test', perspectiveKey: 'pk-one', registrationId },
            { threadKind: 'roomDescription', status: 'Generating', messageId: 'MESSAGE#m1', createdTime: 1000000000000 }
        )
        expect(ok).toBe(true)
        expect(cache.list('ROOM#test', 'pk-one')[0].thread).toMatchObject({
            kind: 'roomDescription',
            status: 'Generating',
            messageId: 'MESSAGE#m1',
            createdTime: 1000000000000,
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
                { threadKind: 'characterMove', status: 'Generating' }
            )
        ).toThrow('characterMove patch requires characterMove thread')
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
        cache.register(makeRoomRegistration({ perspectiveKey: 'same', registrationId: 'r1' }))
        cache.register(makeRoomRegistration({ perspectiveKey: 'same', registrationId: 'r2', characterId: 'CHARACTER#other' }))
        const listed = cache.list('ROOM#test', 'same')
        expect(listed).toHaveLength(2)
        const ids = listed.map((e) => e.registrationId).sort()
        expect(ids).toEqual(['r1', 'r2'])
    })

    it('remove drops one entry and leaves sibling', () => {
        cache.register(makeRoomRegistration({ perspectiveKey: 'same', registrationId: 'r1' }))
        cache.register(makeRoomRegistration({ perspectiveKey: 'same', registrationId: 'r2' }))
        cache.remove({ componentId: 'ROOM#test', perspectiveKey: 'same', registrationId: 'r1' })
        const listed = cache.list('ROOM#test', 'same')
        expect(listed).toHaveLength(1)
        expect(listed[0].registrationId).toBe('r2')
    })

    it('remove clears bucket when last entry removed', () => {
        cache.register(makeRoomRegistration())
        const { registrationId } = cache.list('ROOM#test', 'pk-one')[0]
        cache.remove({ componentId: 'ROOM#test', perspectiveKey: 'pk-one', registrationId })
        expect(cache.list('ROOM#test', 'pk-one')).toEqual([])
    })

    it('clear removes all entries', () => {
        cache.register(makeRoomRegistration())
        cache.clear()
        expect(cache.list('ROOM#test', 'pk-one')).toEqual([])
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

    it('register sessionOrientationRender stores Initial thread and targets', () => {
        cache.register(makeSessionOrientationRenderRegistration())
        const listed = cache.list('ROOM#test', 'pk-one')
        expect(listed).toHaveLength(1)
        expect(listed[0].thread).toEqual({ kind: 'sessionOrientationRender', status: 'Initial' })
        expect(listed[0].registration.threadKind).toBe('sessionOrientationRender')
        expect((listed[0].registration as { targets: string[] }).targets).toEqual(['SESSION#session-1'])
    })

    it('update merges sessionOrientationRender thread', () => {
        cache.register(makeSessionOrientationRenderRegistration())
        const { registrationId } = cache.list('ROOM#test', 'pk-one')[0]
        const ok = cache.update(
            { componentId: 'ROOM#test', perspectiveKey: 'pk-one', registrationId },
            { threadKind: 'sessionOrientationRender', status: 'Generating', messageId: 'MESSAGE#s1' }
        )
        expect(ok).toBe(true)
        expect(cache.list('ROOM#test', 'pk-one')[0].thread).toMatchObject({
            kind: 'sessionOrientationRender',
            status: 'Generating',
            messageId: 'MESSAGE#s1',
        })
    })

    it('register sessionOrientationAffordances stores Initial thread', () => {
        cache.register(makeSessionOrientationAffordancesRegistration())
        const listed = cache.list('ROOM#test', 'pk-one')
        expect(listed).toHaveLength(1)
        expect(listed[0].thread).toEqual({ kind: 'sessionOrientationAffordances', status: 'Initial' })
        expect(listed[0].registration.threadKind).toBe('sessionOrientationAffordances')
    })

    it('update rejects Generating status on sessionOrientationAffordances', () => {
        cache.register(makeSessionOrientationAffordancesRegistration())
        const { registrationId } = cache.list('ROOM#test', 'pk-one')[0]
        expect(() =>
            cache.update(
                { componentId: 'ROOM#test', perspectiveKey: 'pk-one', registrationId },
                { threadKind: 'sessionOrientationAffordances', status: 'Generating' } as unknown
            )
        ).toThrow('not a valid PerceptionThreadPatch')
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

    it('register characterMove stores Initial thread and targets', () => {
        cache.register(makeCharacterMoveRegistration())
        const listed = cache.list('ROOM#test', 'pk-one')
        expect(listed).toHaveLength(1)
        expect(listed[0].thread).toEqual({ kind: 'characterMove', status: 'Initial' })
        expect(listed[0].registration.threadKind).toBe('characterMove')
        if (listed[0].registration.threadKind === 'characterMove') {
            expect(listed[0].registration.targets).toEqual(['CHARACTER#mover'])
        }
    })

    it('update merges characterMove thread', () => {
        cache.register(makeCharacterMoveRegistration())
        const { registrationId } = cache.list('ROOM#test', 'pk-one')[0]
        const ok = cache.update(
            { componentId: 'ROOM#test', perspectiveKey: 'pk-one', registrationId },
            {
                threadKind: 'characterMove',
                status: 'Generating',
                messageId: 'MESSAGE#cm1',
            }
        )
        expect(ok).toBe(true)
        expect(cache.list('ROOM#test', 'pk-one')[0].thread).toMatchObject({
            kind: 'characterMove',
            status: 'Generating',
            messageId: 'MESSAGE#cm1',
        })
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
    it('merges status and messageId', () => {
        const base = { kind: 'characterMove' as const, status: 'Initial' as const }
        const merged = mergePerceptionThreadPatch(base, {
            threadKind: 'characterMove',
            status: 'Generating',
            messageId: 'MESSAGE#cm',
        })
        expect(merged).toEqual({
            kind: 'characterMove',
            status: 'Generating',
            messageId: 'MESSAGE#cm',
        })
    })
})

describe('isRoomDescriptionPerceptionThread / isPerceptionThread', () => {
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

    it('accepts sessionOrientationRender shape', () => {
        const t: SessionOrientationRenderPerceptionThread = { kind: 'sessionOrientationRender', status: 'Initial' }
        expect(isSessionOrientationRenderPerceptionThread(t)).toBe(true)
        expect(isPerceptionThread(t)).toBe(true)
    })

    it('accepts sessionOrientationAffordances shape', () => {
        const t = { kind: 'sessionOrientationAffordances' as const, status: 'Initial' as const }
        expect(isSessionOrientationAffordancesPerceptionThread(t)).toBe(true)
        expect(isPerceptionThread(t)).toBe(true)
    })

    it('rejects sessionOrientationAffordances with Generating status', () => {
        expect(isSessionOrientationAffordancesPerceptionThread({
            kind: 'sessionOrientationAffordances',
            status: 'Generating',
        })).toBe(false)
    })

    it('rejects roomDescription with invalid status', () => {
        expect(isRoomDescriptionPerceptionThread({
            kind: 'roomDescription',
            status: 'Unknown',
        })).toBe(false)
    })
})
