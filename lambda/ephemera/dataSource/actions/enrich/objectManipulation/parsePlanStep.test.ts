import { RUNTIME_PRIMITIVE_NAMES, isRuntimePrimitiveName } from './parsePlanStep'

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
