import { objectMap } from './objects.js'

describe('Objects utility functions', () => {

    it('should correctly map an empty object with objectMap', () => {
        expect(objectMap({}, ({ Test }) => ({ Test: Test * 2 }))).toEqual({})
    })

    it('should correctly map an empty object with objectMap', () => {
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
})
