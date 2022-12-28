import IndexSubstitution from './indexSubstitution'

describe('IndexSubstitution', () => {
    const compare = (A: { value: string }, B: { value: string }): boolean => (A.value === B.value)
    it('should merge two sets', () => {
        const indexSub = new IndexSubstitution(compare)
        indexSub.add([
            { value: 'TestA' },
            { value: 'TestB' },
            { value: 'TestC' }
        ])
        indexSub.add([
            { value: 'TestB' },
            { value: 'TestC' },
            { value: 'TestD' }
        ])
        expect(indexSub.toIndex({ value: 'TestA' })).toEqual(0)
        expect(indexSub.toIndex({ value: 'TestB' })).toEqual(1)
        expect(indexSub.toIndex({ value: 'TestC' })).toEqual(2)
        expect(indexSub.toIndex({ value: 'TestD' })).toEqual(3)
    })
})