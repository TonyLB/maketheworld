import {
    authoredExampleSetFromEntries,
    authoredExampleSetSituationIds,
    emptyAuthoredExampleSet,
    type AuthoredExample,
} from './result'

const exampleFor = (situationId: string): AuthoredExample => ({
    situationId: situationId as AuthoredExample['situationId'],
    markState: { markValue: [{ mark: 'm', value: 'v' }] },
    renderedContent: { description: [] },
    provenance: { type: 'authored' },
})

describe('AuthoredExampleSet helpers', () => {
    it('emptyAuthoredExampleSet returns an empty map', () => {
        expect(emptyAuthoredExampleSet().size).toBe(0)
    })

    it('authoredExampleSetFromEntries builds a keyed set', () => {
        const set = authoredExampleSetFromEntries([
            ['SITUATION#a', exampleFor('SITUATION#a')],
            ['SITUATION#b', exampleFor('SITUATION#b')],
        ] as const)
        expect(set.size).toBe(2)
        expect(authoredExampleSetSituationIds(set)).toEqual(['SITUATION#a', 'SITUATION#b'])
    })

    it('rejects duplicate situationId keys', () => {
        expect(() => authoredExampleSetFromEntries([
            ['SITUATION#a', exampleFor('SITUATION#a')],
            ['SITUATION#a', exampleFor('SITUATION#a')],
        ] as const)).toThrow(/Duplicate situationId/)
    })

    it('rejects key mismatch with example.situationId', () => {
        expect(() => authoredExampleSetFromEntries([
            ['SITUATION#a', exampleFor('SITUATION#b')],
        ] as const)).toThrow(/does not match map key/)
    })
})
