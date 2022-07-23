import { objectMap, objectFilter, deepEqual } from './objects'

describe('Objects utility functions', () => {

    it('should correctly map an empty object with objectMap', () => {
        expect(objectMap({}, ({ Test }: { Test: number }) => ({ Test: Test * 2 }))).toEqual({})
    })

    it('should correctly map an object with objectMap', () => {
        expect(objectMap({ One: { Test: 1 }, Two: { Test: 2 }}, ({ Test }) => ({ Test: Test * 2 })))
            .toEqual({
                One: {
                    Test: 2
                },
                Two: {
                    Test: 4
                }
            })
    })

    it('should correctly filter an empty object with objectFilter', () => {
        expect(objectFilter({} as Record<string, { Test: number }>, ({ Test }: { Test: number }) => (Boolean(Test)))).toEqual({})
    })

    it('should correctly filter an object with objectFilter', () => {
        expect(objectFilter({ One: { Test: 1 }, Two: { Test: 2 }}, ({ Test }) => ( Test === 1 )))
            .toEqual({
                One: {
                    Test: 1
                }
            })
    })

    describe('deepEqual', () => {
        it('should correctly compare strings', () => {
            expect(deepEqual('test', 'test')).toBe(true)
            expect(deepEqual('test', 'blah')).toBe(false)
        })

        it('should correctly compare numbers', () => {
            expect(deepEqual(1, 1)).toBe(true)
            expect(deepEqual(1, 2)).toBe(false)
            expect(deepEqual(1, '1')).toBe(false)
        })

        it('should correctly compare arrays', () => {
            expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true)
            expect(deepEqual([1, 2, 3], [3, 4, 5])).toBe(false)
            expect(deepEqual([1, 2, 3], 1)).toBe(false)
        })

        it('should correctly compare objects', () => {
            expect(deepEqual({ foo: 'bar', baz: 'bip' }, { baz: 'bip', foo: 'bar' })).toBe(true)
            expect(deepEqual({ foo: 'bar', baz: 2 }, { foo: 'bar' })).toBe(false)
            expect(deepEqual({ foo: 'bar' }, [1, 2, 3])).toBe(false)
            expect(deepEqual({ foo: 'bar' }, 'foobar')).toBe(false)
        })

        it('should correctly compare nested structures', () => {
            expect(deepEqual(
                { foo: 'bar', test: [1, 2, 'test', { baz: 'bip' }]},
                { foo: 'bar', test: [1, 2, 'test', { baz: 'bip' }]}
            )).toBe(true)
            expect(deepEqual(
                { foo: 'bar', test: [1, 2, 'test', { baz: 'bip' }]},
                { foo: 'bar', test: [1, 2, 'test', { baz: 'test' }]}
            )).toBe(false)
        })
    })

})
