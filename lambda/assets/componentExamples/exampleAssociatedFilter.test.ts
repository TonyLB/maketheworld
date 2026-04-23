import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import {
    EXAMPLE_ASSOCIATED_TAGS,
    EXAMPLE_PARENT_TAGS,
    isExampleAssociatedComponent,
} from './exampleAssociatedFilter'

describe('exampleAssociatedFilter', () => {
    describe('EXAMPLE_ASSOCIATED_TAGS', () => {
        it('should contain Example, Feature, Knowledge', () => {
            expect(EXAMPLE_ASSOCIATED_TAGS.has('Example')).toBe(true)
            expect(EXAMPLE_ASSOCIATED_TAGS.has('Feature')).toBe(true)
            expect(EXAMPLE_ASSOCIATED_TAGS.has('Knowledge')).toBe(true)
            expect(EXAMPLE_ASSOCIATED_TAGS.has('Room')).toBe(false)
            expect(EXAMPLE_ASSOCIATED_TAGS.size).toBe(3)
        })
    })

    describe('EXAMPLE_PARENT_TAGS', () => {
        it('should contain Feature, Knowledge only', () => {
            expect(EXAMPLE_PARENT_TAGS.has('Feature')).toBe(true)
            expect(EXAMPLE_PARENT_TAGS.has('Knowledge')).toBe(true)
            expect(EXAMPLE_PARENT_TAGS.has('Room')).toBe(false)
            expect(EXAMPLE_PARENT_TAGS.has('Example')).toBe(false)
            expect(EXAMPLE_PARENT_TAGS.size).toBe(2)
        })
    })

    describe('isExampleAssociatedComponent', () => {
        it('should return true for Example regardless of examples field', () => {
            expect(isExampleAssociatedComponent({ tag: 'Example' } as unknown as StandardComponent)).toBe(true)
            expect(isExampleAssociatedComponent({ tag: 'Example', examples: { payload: [] } } as unknown as StandardComponent)).toBe(true)
        })

        it('should return false for Room (not in Example-lifecycle filter after Gate D)', () => {
            const withSituations = { items: [{ reference: { universalKey: 'SITUATION#x' }, payload: {} }] }
            expect(isExampleAssociatedComponent({ tag: 'Room', situations: withSituations } as unknown as StandardComponent)).toBe(false)
            expect(isExampleAssociatedComponent({ tag: 'Room', examples: { payload: [{ tag: 'Example', universalKey: 'EXAMPLE#x' }] } } as unknown as StandardComponent)).toBe(false)
        })

        it('should return true for Feature, Knowledge when examples has non-zero length', () => {
            const withExamples = { payload: [{ tag: 'Example', universalKey: 'EXAMPLE#x' }] }
            expect(isExampleAssociatedComponent({ tag: 'Feature', examples: withExamples } as unknown as StandardComponent)).toBe(true)
            expect(isExampleAssociatedComponent({ tag: 'Knowledge', examples: withExamples } as unknown as StandardComponent)).toBe(true)
        })

        it('should return false for Room, Feature, Knowledge when examples/situations is missing', () => {
            expect(isExampleAssociatedComponent({ tag: 'Room' } as unknown as StandardComponent)).toBe(false)
            expect(isExampleAssociatedComponent({ tag: 'Feature' } as unknown as StandardComponent)).toBe(false)
            expect(isExampleAssociatedComponent({ tag: 'Knowledge' } as unknown as StandardComponent)).toBe(false)
        })

        it('should return false for Feature, Knowledge when examples.payload is empty', () => {
            expect(isExampleAssociatedComponent({ tag: 'Feature', examples: { payload: [] } } as unknown as StandardComponent)).toBe(false)
            expect(isExampleAssociatedComponent({ tag: 'Knowledge', examples: { payload: [] } } as unknown as StandardComponent)).toBe(false)
        })

        it('should return false for Feature, Knowledge when examples.payload is undefined', () => {
            expect(isExampleAssociatedComponent({ tag: 'Feature', examples: {} } as unknown as StandardComponent)).toBe(false)
            expect(isExampleAssociatedComponent({ tag: 'Knowledge', examples: {} } as unknown as StandardComponent)).toBe(false)
        })

        it('should return false for Character, Message, Guidance, Lens, Mark', () => {
            expect(isExampleAssociatedComponent({ tag: 'Character' } as unknown as StandardComponent)).toBe(false)
            expect(isExampleAssociatedComponent({ tag: 'Message' } as unknown as StandardComponent)).toBe(false)
            expect(isExampleAssociatedComponent({ tag: 'Guidance' } as unknown as StandardComponent)).toBe(false)
            expect(isExampleAssociatedComponent({ tag: 'Lens' } as unknown as StandardComponent)).toBe(false)
            expect(isExampleAssociatedComponent({ tag: 'Mark' } as unknown as StandardComponent)).toBe(false)
        })

        it('should return false for other component tags', () => {
            expect(isExampleAssociatedComponent({ tag: 'Map' } as unknown as StandardComponent)).toBe(false)
            expect(isExampleAssociatedComponent({ tag: 'Image' } as unknown as StandardComponent)).toBe(false)
            expect(isExampleAssociatedComponent({ tag: 'Moment' } as unknown as StandardComponent)).toBe(false)
        })

        it('should return false when tag is missing or not in set', () => {
            expect(isExampleAssociatedComponent({} as unknown as StandardComponent)).toBe(false)
            expect(isExampleAssociatedComponent({ tag: 'Other' } as unknown as StandardComponent)).toBe(false)
        })
    })
})
