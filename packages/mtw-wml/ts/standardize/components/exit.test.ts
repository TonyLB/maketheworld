import { deIndentWML } from '../../schema/utils'
import { Schema, schemaToWML } from '../../schema'
import { StandardExit, StandardExitData, StandardExitRemove } from './exit'
import { StandardKey } from './reference'

describe('StandardExit', () => {
    it('should construct StandardExit from WML', () => {
        const testSource = deIndentWML(`
            <Exit to=(test)>Test Exit</Exit>
        `)
        const testExit = StandardExit.create(testSource)
        expect(testExit.toJSON()).toEqual({ to: { key: 'test' }, description: 'Test Exit' })
        expect(schemaToWML(testExit.schema)).toEqual(testSource)
    })

    it('should construct StandardExit from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Exit to=(test)>Test Exit</Exit>
        `)
        schema.loadWML(testSource)
        const testExit = StandardExit.create(schema.schema)
        expect(testExit.toJSON()).toEqual({ to: { key: 'test' }, description: 'Test Exit' })
        expect(schemaToWML(testExit.schema)).toEqual(testSource)
    })

    it('should construct StandardExit from StandardExitData', () => {
        const testExitData: StandardExitData = {
            to: { key: 'test' },
            description: 'Test Exit'
        }
        const testExit = StandardExit.create(testExitData)
        expect(testExit.toJSON()).toEqual(testExitData)
    })

    it('should merge correctly', () => {
        expect(schemaToWML(StandardExit.create('<Exit to=(test)>One</Exit>')?.merge(StandardExit.create('<Exit to=(test)>Two</Exit>'))?.schema ?? [])).toEqual(deIndentWML('<Exit to=(test)>OneTwo</Exit>'))
    })

    it('should correctly parse a StandardExitRemove', () => {
        const testExitData = {
            tag: 'Remove',
            match: {
                to: { key: 'test' },
                description: 'Test Exit'
            }
        } as const
        const testExitRemove = StandardExit.create(testExitData)
        expect(testExitRemove).toBeInstanceOf(StandardExitRemove)
    })

    it('should correctly remap references', () => {
        const testExit = StandardExit.create(`<Exit to=(test)>Test Exit</Exit>`)
        const remappedExit = testExit.remapReferences({ mapTo: 'universal', mappings: [new StandardKey({ key: 'test', universalKey: 'ROOM#universalTest' })] })
        expect(schemaToWML(remappedExit.schema)).toEqual(`<Exit to=(ROOM#universalTest)>Test Exit</Exit>`)
    })
})

// describe('diffStandardPositionList', () => {
//     it('should return empty array when both lists are empty', () => {
//         const base: StandardPosition[] = []
//         const incoming: StandardPosition[] = []
//         const result = diffStandardPositionList({ base, incoming })
//         expect(result).toEqual([])
//     })

//     it('should return all removes when incoming list is empty', () => {
//         const base = [new StandardPosition({ tag: 'Position', room: { tag: 'Room', key: 'test' }, x: 1, y: 2 }), new StandardPosition({ tag: 'Position', room: { tag: 'Room', key: 'test2' }, x: 3, y: 4 })]
//         const incoming: StandardPosition[] = []
//         const result = diffStandardPositionList({ base, incoming })
//         expect(result.map((reference) => (reference.toJSON()))).toEqual([
//             { tag: 'Remove', match: { room: { key: 'test', tag: 'Room' }, x: 1, y: 2 } },
//             { tag: 'Remove', match: { room: { key: 'test2', tag: 'Room' }, x: 3, y: 4 } }
//         ])
//     })

//     it('should return all adds when base list is empty', () => {
//         const base: StandardPosition[] = []
//         const incoming = [new StandardPosition({ room: { tag: 'Room', key: 'test1' }, x: 1, y: 2 }), new StandardPosition({ room: { tag: 'Room', key: 'test2' }, x: 3, y: 4 })]
//         const result = diffStandardPositionList({ base, incoming })
//         expect(result).toEqual(incoming)
//     })

//     it('should return correct diff when lists have different elements', () => {
//         const base = [new StandardPosition({ room: { tag: 'Room', key: 'test1' }, x: 1, y: 2 }), new StandardPosition({ room: { tag: 'Room', key: 'test2' }, x: 3, y: 4 })]
//         const incoming = [new StandardPosition({ room: { tag: 'Room', key: 'test2' }, x: 3, y: 4 }), new StandardPosition({ room: { tag: 'Room', key: 'test3' }, x: 5, y: 6 })]
//         const result = diffStandardPositionList({ base, incoming })
//         expect(result.map((reference) => (reference.toJSON()))).toEqual([{ tag: 'Remove', match: { room: { key: 'test1', tag: 'Room' }, x: 1, y: 2 } }, { room: { key: 'test3', tag: 'Room' }, x: 5, y: 6 }])
//     })

//     it('should return empty array when lists are identical', () => {
//         const base = [new StandardPosition({ room: { tag: 'Room', key: 'test1' }, x: 1, y: 2 }), new StandardPosition({ room: { tag: 'Room', key: 'test2' }, x: 3, y: 4 })]
//         const incoming = [new StandardPosition({ room: { tag: 'Room', key: 'test1' }, x: 1, y: 2 }), new StandardPosition({ room: { tag: 'Room', key: 'test2' }, x: 3, y: 4 })]
//         const result = diffStandardPositionList({ base, incoming })
//         expect(result).toEqual([])
//     })

// })