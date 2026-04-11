import PerceptionThreadsData, {
    isPerceptionThread,
    isStubPerceptionThread,
} from './perceptionThreads'
import type { PerceptionThreadRegisteredCommand } from '../dataSource/perception/localApiEvents'

const makeRegistration = (overrides: Partial<PerceptionThreadRegisteredCommand> = {}): PerceptionThreadRegisteredCommand => ({
    componentId: 'ROOM#test',
    perspectiveKey: 'pk-one',
    ...overrides,
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
    })

    it('last set wins for same componentId and perspectiveKey', () => {
        cache.set(makeRegistration({ perspectiveKey: 'same' }), { kind: 'stub' })
        cache.set(makeRegistration({ perspectiveKey: 'same', characterId: 'CHARACTER#two' }), { kind: 'stub' })
        expect(cache.get('ROOM#test', 'same')?.registration.characterId).toBe('CHARACTER#two')
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

describe('isStubPerceptionThread / isPerceptionThread', () => {
    it('accepts stub shape', () => {
        expect(isStubPerceptionThread({ kind: 'stub' })).toBe(true)
        expect(isPerceptionThread({ kind: 'stub' })).toBe(true)
    })

    it('rejects wrong kind', () => {
        expect(isStubPerceptionThread({ kind: 'other' })).toBe(false)
        expect(isStubPerceptionThread(null)).toBe(false)
        expect(isStubPerceptionThread({})).toBe(false)
    })
})
