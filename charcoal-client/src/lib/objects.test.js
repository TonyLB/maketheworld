import { objectMap, objectFilter } from './objects.js'

describe('Objects utility functions', () => {

    it('should correctly map an empty object with objectMap', () => {
        expect(objectMap({}, ({ Test }) => ({ Test: Test * 2 }))).toEqual({})
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
        expect(objectFilter({}, ({ Test }) => (Test))).toEqual({})
    })

    it('should correctly filter an object with objectFilter', () => {
        expect(objectFilter({ One: { Test: 1 }, Two: { Test: 2 }}, ({ Test }) => ( Test === 1 )))
            .toEqual({
                One: {
                    Test: 1
                }
            })
    })

})
