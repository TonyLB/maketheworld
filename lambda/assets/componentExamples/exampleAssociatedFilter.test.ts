import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import {
    EXAMPLE_ASSOCIATED_TAGS,
    EXAMPLE_PARENT_TAGS,
    isExampleAssociatedComponent,
} from './exampleAssociatedFilter'

describe('exampleAssociatedFilter', () => {
    describe('EXAMPLE_ASSOCIATED_TAGS', () => {
        it('should contain Example, Room, Feature, Knowledge', () => {
            expect(EXAMPLE_ASSOCIATED_TAGS.has('Example')).toBe(true)
            expect(EXAMPLE_ASSOCIATED_TAGS.has('Room')).toBe(true)
            expect(EXAMPLE_ASSOCIATED_TAGS.has('Feature')).toBe(true)
            expect(EXAMPLE_ASSOCIATED_TAGS.has('Knowledge')).toBe(true)
            expect(EXAMPLE_ASSOCIATED_TAGS.size).toBe(4)
        })
    })

    describe('EXAMPLE_PARENT_TAGS', () => {
        it('should contain Room, Feature, Knowledge only', () => {
            expect(EXAMPLE_PARENT_TAGS.has('Room')).toBe(true)
            expect(EXAMPLE_PARENT_TAGS.has('Feature')).toBe(true)
            expect(EXAMPLE_PARENT_TAGS.has('Knowledge')).toBe(true)
            expect(EXAMPLE_PARENT_TAGS.has('Example')).toBe(false)
            expect(EXAMPLE_PARENT_TAGS.size).toBe(3)
        })
    })

    describe('isExampleAssociatedComponent', () => {
        it('should return true for Example regardless of examples field', () => {
            expect(isExampleAssociatedComponent({ tag: 'Example' } as StandardComponent)).toBe(true)
            expect(isExampleAssociatedComponent({ tag: 'Example', examples: { payload: [] } } as StandardComponent)).toBe(true)
        })

        it('should return true for Room, Feature, Knowledge when examples has non-zero length', () => {
            const withExamples = { payload: [{ tag: 'Example', universalKey: 'EXAMPLE#x' }] }
            expect(isExampleAssociatedComponent({ tag: 'Room', examples: withExamples } as StandardComponent)).toBe(true)
            expect(isExampleAssociatedComponent({ tag: 'Feature', examples: withExamples } as StandardComponent)).toBe(true)
            expect(isExampleAssociatedComponent({ tag: 'Knowledge', examples: withExamples } as StandardComponent)).toBe(true)
        })

        it('should return false for Room, Feature, Knowledge when examples is missing', () => {
            expect(isExampleAssociatedComponent({ tag: 'Room' } as StandardComponent)).toBe(false)
            expect(isExampleAssociatedComponent({ tag: 'Feature' } as StandardComponent)).toBe(false)
            expect(isExampleAssociatedComponent({ tag: 'Knowledge' } as StandardComponent)).toBe(false)
        })

        it('should return false for Room, Feature, Knowledge when examples.payload is empty', () => {
            expect(isExampleAssociatedComponent({ tag: 'Room', examples: { payload: [] } } as StandardComponent)).toBe(false)
            expect(isExampleAssociatedComponent({ tag: 'Feature', examples: { payload: [] } } as StandardComponent)).toBe(false)
            expect(isExampleAssociatedComponent({ tag: 'Knowledge', examples: { payload: [] } } as StandardComponent)).toBe(false)
        })

        it('should return false for Room, Feature, Knowledge when examples.payload is undefined', () => {
            expect(isExampleAssociatedComponent({ tag: 'Room', examples: {} } as StandardComponent)).toBe(false)
        })

        it('should return false for Character, Message, Guidance, Lens, Mark', () => {
            expect(isExampleAssociatedComponent({ tag: 'Character' } as StandardComponent)).toBe(false)
            expect(isExampleAssociatedComponent({ tag: 'Message' } as StandardComponent)).toBe(false)
            expect(isExampleAssociatedComponent({ tag: 'Guidance' } as StandardComponent)).toBe(false)
            expect(isExampleAssociatedComponent({ tag: 'Lens' } as StandardComponent)).toBe(false)
            expect(isExampleAssociatedComponent({ tag: 'Mark' } as StandardComponent)).toBe(false)
        })

        it('should return false for other component tags', () => {
            expect(isExampleAssociatedComponent({ tag: 'Map' } as StandardComponent)).toBe(false)
            expect(isExampleAssociatedComponent({ tag: 'Image' } as StandardComponent)).toBe(false)
            expect(isExampleAssociatedComponent({ tag: 'Moment' } as StandardComponent)).toBe(false)
        })

        it('should return false when tag is missing or not in set', () => {
            expect(isExampleAssociatedComponent({} as StandardComponent)).toBe(false)
            expect(isExampleAssociatedComponent({ tag: 'Other' } as StandardComponent)).toBe(false)
        })
    })
})
