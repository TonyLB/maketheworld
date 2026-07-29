import PerceptionThreadsData, {
    isPerceptionThread,
    isRoomHeaderBroadcastPerceptionThread,
    isSessionOrientationAffordancesPerceptionThread,
    mergePerceptionThreadPatch,
    type RoomHeaderBroadcastPerceptionThread,
} from './perceptionThreads'
import type { PerceptionThreadRegisterCommand } from '../dataSource/perception/localApiEvents'

const makeHeaderBroadcastRegistration = (
    overrides: Partial<Extract<PerceptionThreadRegisterCommand, { threadKind: 'roomHeaderBroadcast' }>> = {}
): Extract<PerceptionThreadRegisterCommand, { threadKind: 'roomHeaderBroadcast' }> => ({
    threadKind: 'roomHeaderBroadcast',
    componentId: 'ROOM#test',
    perspectiveKey: 'pk-one',
    targets: ['CHARACTER#a', 'CHARACTER#b'],
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
        const reg = makeHeaderBroadcastRegistration()
        cache.register(reg)
        const listed = cache.list('ROOM#test', 'pk-one')
        expect(listed).toHaveLength(1)
        expect(listed[0].thread).toEqual({ kind: 'roomHeaderBroadcast', status: 'Initial' })
        expect(listed[0].registration.threadKind).toBe('roomHeaderBroadcast')
        expect(listed[0].registrationId).toMatch(/^[\da-f-]{36}$/i)
    })

    it('register stores caller registrationId when provided', () => {
        const reg = makeHeaderBroadcastRegistration({ registrationId: 'custom-reg-id' })
        cache.register(reg)
        expect(cache.list('ROOM#test', 'pk-one')[0].registrationId).toBe('custom-reg-id')
    })

    it('update shallow-merges when registrationId matches', () => {
        const reg = makeHeaderBroadcastRegistration()
        cache.register(reg)
        const { registrationId } = cache.list('ROOM#test', 'pk-one')[0]
        const ok = cache.update(
            { componentId: 'ROOM#test', perspectiveKey: 'pk-one', registrationId },
            { threadKind: 'roomHeaderBroadcast', status: 'Generating', messageId: 'MESSAGE#m1' }
        )
        expect(ok).toBe(true)
        const t = cache.list('ROOM#test', 'pk-one')[0].thread
        expect(t).toMatchObject({
            kind: 'roomHeaderBroadcast',
            status: 'Generating',
            messageId: 'MESSAGE#m1',
        })
    })

    it('update stores createdTime on render-correlated thread kinds', () => {
        const reg = makeHeaderBroadcastRegistration()
        cache.register(reg)
        const { registrationId } = cache.list('ROOM#test', 'pk-one')[0]
        const ok = cache.update(
            { componentId: 'ROOM#test', perspectiveKey: 'pk-one', registrationId },
            { threadKind: 'roomHeaderBroadcast', status: 'Generating', messageId: 'MESSAGE#m1', createdTime: 1000000000000 }
        )
        expect(ok).toBe(true)
        expect(cache.list('ROOM#test', 'pk-one')[0].thread).toMatchObject({
            kind: 'roomHeaderBroadcast',
            status: 'Generating',
            messageId: 'MESSAGE#m1',
            createdTime: 1000000000000,
        })
    })

    it('update returns false when registrationId mismatches', () => {
        cache.register(makeHeaderBroadcastRegistration())
        const ok = cache.update(
            { componentId: 'ROOM#test', perspectiveKey: 'pk-one', registrationId: 'wrong' },
            { threadKind: 'roomHeaderBroadcast', status: 'Terminal' }
        )
        expect(ok).toBe(false)
        expect((cache.list('ROOM#test', 'pk-one')[0].thread as { status: string }).status).toBe('Initial')
    })

    it('update throws on roomHeaderBroadcast patch with unknown key', () => {
        cache.register(makeHeaderBroadcastRegistration())
        const { registrationId } = cache.list('ROOM#test', 'pk-one')[0]
        expect(() =>
            cache.update(
                { componentId: 'ROOM#test', perspectiveKey: 'pk-one', registrationId },
                { threadKind: 'roomHeaderBroadcast', mesageId: 'MESSAGE#typo' } as unknown
            )
        ).toThrow('not a valid PerceptionThreadPatch')
    })

    it('update throws when patch uses legacy kind field instead of threadKind', () => {
        cache.register(makeHeaderBroadcastRegistration())
        const { registrationId } = cache.list('ROOM#test', 'pk-one')[0]
        expect(() =>
            cache.update(
                { componentId: 'ROOM#test', perspectiveKey: 'pk-one', registrationId },
                { kind: 'roomHeaderBroadcast' } as unknown
            )
        ).toThrow('not a valid PerceptionThreadPatch')
    })

    it('update throws when patch threadKind does not match roomHeaderBroadcast row', () => {
        cache.register(makeHeaderBroadcastRegistration())
        const { registrationId } = cache.list('ROOM#test', 'pk-one')[0]
        expect(() =>
            cache.update(
                { componentId: 'ROOM#test', perspectiveKey: 'pk-one', registrationId },
                { threadKind: 'sessionOrientationAffordances', status: 'Terminal' }
            )
        ).toThrow('sessionOrientationAffordances patch requires sessionOrientationAffordances thread')
    })

    it('update throws on roomHeaderBroadcast patch with invalid status', () => {
        cache.register(makeHeaderBroadcastRegistration())
        const { registrationId } = cache.list('ROOM#test', 'pk-one')[0]
        expect(() =>
            cache.update(
                { componentId: 'ROOM#test', perspectiveKey: 'pk-one', registrationId },
                { threadKind: 'roomHeaderBroadcast', status: 'bogus' } as unknown
            )
        ).toThrow('not a valid PerceptionThreadPatch')
    })

    it('update throws on roomHeaderBroadcast patch with non-string messageId', () => {
        cache.register(makeHeaderBroadcastRegistration())
        const { registrationId } = cache.list('ROOM#test', 'pk-one')[0]
        expect(() =>
            cache.update(
                { componentId: 'ROOM#test', perspectiveKey: 'pk-one', registrationId },
                { threadKind: 'roomHeaderBroadcast', messageId: 123 } as unknown
            )
        ).toThrow('not a valid PerceptionThreadPatch')
    })

    it('update throws when patch is not a plain object', () => {
        cache.register(makeHeaderBroadcastRegistration())
        const { registrationId } = cache.list('ROOM#test', 'pk-one')[0]
        expect(() =>
            cache.update(
                { componentId: 'ROOM#test', perspectiveKey: 'pk-one', registrationId },
                null
            )
        ).toThrow('not a valid PerceptionThreadPatch')
    })

    it('two registers under same composite key coexist', () => {
        cache.register(makeHeaderBroadcastRegistration({ perspectiveKey: 'same', registrationId: 'r1' }))
        cache.register(makeHeaderBroadcastRegistration({ perspectiveKey: 'same', registrationId: 'r2', targets: ['CHARACTER#other'] }))
        const listed = cache.list('ROOM#test', 'same')
        expect(listed).toHaveLength(2)
        const ids = listed.map((e) => e.registrationId).sort()
        expect(ids).toEqual(['r1', 'r2'])
    })

    it('remove drops one entry and leaves sibling', () => {
        cache.register(makeHeaderBroadcastRegistration({ perspectiveKey: 'same', registrationId: 'r1' }))
        cache.register(makeHeaderBroadcastRegistration({ perspectiveKey: 'same', registrationId: 'r2' }))
        cache.remove({ componentId: 'ROOM#test', perspectiveKey: 'same', registrationId: 'r1' })
        const listed = cache.list('ROOM#test', 'same')
        expect(listed).toHaveLength(1)
        expect(listed[0].registrationId).toBe('r2')
    })

    it('remove clears bucket when last entry removed', () => {
        cache.register(makeHeaderBroadcastRegistration())
        const { registrationId } = cache.list('ROOM#test', 'pk-one')[0]
        cache.remove({ componentId: 'ROOM#test', perspectiveKey: 'pk-one', registrationId })
        expect(cache.list('ROOM#test', 'pk-one')).toEqual([])
    })

    it('clear removes all entries', () => {
        cache.register(makeHeaderBroadcastRegistration())
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

describe('isRoomHeaderBroadcastPerceptionThread / isPerceptionThread', () => {
    it('accepts roomHeaderBroadcast shape', () => {
        const t = roomHeaderBroadcastInitial()
        expect(isRoomHeaderBroadcastPerceptionThread(t)).toBe(true)
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

    it('rejects roomHeaderBroadcast with invalid status', () => {
        expect(isRoomHeaderBroadcastPerceptionThread({
            kind: 'roomHeaderBroadcast',
            status: 'Unknown',
        })).toBe(false)
    })
})
