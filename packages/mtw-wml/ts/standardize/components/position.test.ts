import { diffStandardPositionList, StandardPosition, StandardPositionRemove } from './position';
import { deIndentWML } from '../../schema/utils';
import { Schema, schemaToWML } from '../../schema';
import { StandardPositionData } from './dataTypes/position';

describe('StandardPosition', () => {
    it('should construct StandardPosition from WML', () => {
        const testSource = deIndentWML(`
            <Room key=(test)><Position {1, 2} /></Room>
        `)
        const testPosition = new StandardPosition(testSource)
        expect(testPosition.room.toJSON()).toEqual({ key: 'test', tag: 'Room' })
        expect(testPosition.x).toEqual(1)
        expect(testPosition.y).toEqual(2)
        expect(schemaToWML(testPosition.schema)).toEqual(testSource)
    })

    it('should construct StandardPosition from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Room key=(test)><Position {1, 2} /></Room>
        `)
        schema.loadWML(testSource)
        const testPosition = new StandardPosition(schema.schema)
        expect(testPosition.room.toJSON()).toEqual({ key: 'test', tag: 'Room' })
        expect(testPosition.x).toEqual(1)
        expect(testPosition.y).toEqual(2)
        expect(schemaToWML(testPosition.schema)).toEqual(testSource)
    })

    it('should construct StandardPosition from StandardPositionData', () => {
        const testPositionData: StandardPositionData = {
            room: { key: 'test' },
            x: 1,
            y: 2
        }
        const testPosition = new StandardPosition(testPositionData)
        // Position doesn't serialize redundant tag since it always refers to Room
        expect(testPosition.toJSON()).toEqual({
            room: { key: 'test' },
            x: 1,
            y: 2
        })
    })

    it('should merge correctly', () => {
        expect(schemaToWML(new StandardPosition('<Room key=(test)><Position {1, 2} /></Room>')?.merge(new StandardPosition('<Room key=(test)><Position {4, 5} /></Room>'))?.schema ?? [])).toEqual(deIndentWML('<Room key=(test)><Position {4, 5} /></Room>'))
    })

    it('should correctly parse a StandardPositionRemove', () => {
        const testPositionData = {
            tag: 'Remove',
            match: {
                room: { key: 'test' },
                x: 1,
                y: 2
            }
        } as const
        const testPositionRemove = new StandardPosition(testPositionData)
        expect(testPositionRemove._payload).toBeInstanceOf(StandardPositionRemove)
    })
})

describe('diffStandardPositionList', () => {
    it('should return empty array when both lists are empty', () => {
        const base: StandardPosition[] = []
        const incoming: StandardPosition[] = []
        const result = diffStandardPositionList({ base, incoming })
        expect(result).toEqual([])
    })

    it('should return all removes when incoming list is empty', () => {
        const base = [new StandardPosition({ tag: 'Position', room: { key: 'test' }, x: 1, y: 2 }), new StandardPosition({ tag: 'Position', room: { key: 'test2' }, x: 3, y: 4 })]
        const incoming: StandardPosition[] = []
        const result = diffStandardPositionList({ base, incoming })
        // Position doesn't serialize redundant tag since it always refers to Room
        expect(result.map((reference) => (reference.toJSON()))).toEqual([
            { tag: 'Remove', match: { room: { key: 'test' }, x: 1, y: 2 } },
            { tag: 'Remove', match: { room: { key: 'test2' }, x: 3, y: 4 } }
        ])
    })

    it('should return all adds when base list is empty', () => {
        const base: StandardPosition[] = []
        const incoming = [new StandardPosition({ room: { key: 'test1' }, x: 1, y: 2 }), new StandardPosition({ room: { key: 'test2' }, x: 3, y: 4 })]
        const result = diffStandardPositionList({ base, incoming })
        expect(result).toEqual(incoming)
    })

    it('should return correct diff when lists have different elements', () => {
        const base = [new StandardPosition({ room: { key: 'test1' }, x: 1, y: 2 }), new StandardPosition({ room: { key: 'test2' }, x: 3, y: 4 })]
        const incoming = [new StandardPosition({ room: { key: 'test2' }, x: 3, y: 4 }), new StandardPosition({ room: { key: 'test3' }, x: 5, y: 6 })]
        const result = diffStandardPositionList({ base, incoming })
        // Position doesn't serialize redundant tag since it always refers to Room
        expect(result.map((reference) => (reference.toJSON()))).toEqual([{ tag: 'Remove', match: { room: { key: 'test1' }, x: 1, y: 2 } }, { room: { key: 'test3' }, x: 5, y: 6 }])
    })

    it('should return empty array when lists are identical', () => {
        const base = [new StandardPosition({ room: { key: 'test1' }, x: 1, y: 2 }), new StandardPosition({ room: { key: 'test2' }, x: 3, y: 4 })]
        const incoming = [new StandardPosition({ room: { key: 'test1' }, x: 1, y: 2 }), new StandardPosition({ room: { key: 'test2' }, x: 3, y: 4 })]
        const result = diffStandardPositionList({ base, incoming })
        expect(result).toEqual([])
    })

})