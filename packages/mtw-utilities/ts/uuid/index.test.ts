//
// This is mostly a way to document how we override the test with a manual mock, since
// folder mocks don't get picked up by nested calls (and therefore really don't help much
// in testing).
//
jest.mock('./index', () => {
    return {
        ...jest.requireActual('./___mocks___/index')
    }
})
import { UUIDGenerator } from './index'

describe('UUIDGenerator', () => {
    let generator: UUIDGenerator

    beforeEach(() => {
        generator = new UUIDGenerator()
    })

    it('should generate sequential mock UUIDs', () => {
        const uuid1 = generator.next()
        const uuid2 = generator.next()
        expect(uuid1).toBe('mock-uuid-1')
        expect(uuid2).toBe('mock-uuid-2')
    })

    it('should index independently for each instance', () => {
        const generator2 = new UUIDGenerator()
        const uuid1 = generator.next()
        const uuid2 = generator2.next()
        expect(uuid1).toBe('mock-uuid-1')
        expect(uuid2).toBe('mock-uuid-1')
    })
})