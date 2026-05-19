import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import {
    EXAMPLE_ASSOCIATED_TAGS,
    EXAMPLE_PARENT_TAGS,
    isExampleAssociatedComponent,
} from './exampleAssociatedFilter'

describe('exampleAssociatedFilter', () => {
    describe('EXAMPLE_ASSOCIATED_TAGS', () => {
        it('should contain Example only', () => {
            expect(EXAMPLE_ASSOCIATED_TAGS.has('Example')).toBe(true)
            expect(EXAMPLE_ASSOCIATED_TAGS.has('Feature')).toBe(false)
            expect(EXAMPLE_ASSOCIATED_TAGS.has('Knowledge')).toBe(false)
            expect(EXAMPLE_ASSOCIATED_TAGS.has('Room')).toBe(false)
            expect(EXAMPLE_ASSOCIATED_TAGS.size).toBe(1)
        })
    })

    describe('EXAMPLE_PARENT_TAGS', () => {
        it('should contain Room, Feature, Knowledge for enrichment parent discovery', () => {
            expect(EXAMPLE_PARENT_TAGS.has('Room')).toBe(true)
            expect(EXAMPLE_PARENT_TAGS.has('Feature')).toBe(true)
            expect(EXAMPLE_PARENT_TAGS.has('Knowledge')).toBe(true)
            expect(EXAMPLE_PARENT_TAGS.has('Example')).toBe(false)
            expect(EXAMPLE_PARENT_TAGS.size).toBe(3)
        })
    })

    describe('isExampleAssociatedComponent', () => {
        it('should return true for Example regardless of examples field', () => {
            expect(isExampleAssociatedComponent({ tag: 'Example' } as unknown as StandardComponent)).toBe(true)
            expect(isExampleAssociatedComponent({ tag: 'Example', examples: { payload: [] } } as unknown as StandardComponent)).toBe(true)
        })

        it('should return false for Room even with situations (handled in index early branch)', () => {
            const withSituations = { items: [{ reference: { universalKey: 'SITUATION#x' }, payload: {} }] }
            expect(isExampleAssociatedComponent({ tag: 'Room', situations: withSituations } as unknown as StandardComponent)).toBe(false)
            expect(isExampleAssociatedComponent({ tag: 'Room', examples: { payload: [{ tag: 'Example', universalKey: 'EXAMPLE#x' }] } } as unknown as StandardComponent)).toBe(false)
        })

        it('should return false for Feature, Knowledge even with non-empty situations', () => {
            const feature = new StandardFeature(deIndentWML(`
                <Feature key=(feat) uuid=(FEATURE#one)>
                    <Situation uuid=(DEFAULT)><DisplayName>Feature prose</DisplayName></Situation>
                </Feature>
            `))
            const knowledge = new StandardKnowledge(deIndentWML(`
                <Knowledge key=(know) uuid=(KNOWLEDGE#one)>
                    <Situation uuid=(DEFAULT)><DisplayName>Knowledge prose</DisplayName></Situation>
                </Knowledge>
            `))
            expect(isExampleAssociatedComponent(feature)).toBe(false)
            expect(isExampleAssociatedComponent(knowledge)).toBe(false)
        })

        it('should return false for Feature, Knowledge when situations is missing or empty', () => {
            expect(isExampleAssociatedComponent(new StandardFeature({ tag: 'Feature', universalKey: 'FEATURE#empty' } as any))).toBe(false)
            expect(isExampleAssociatedComponent(new StandardKnowledge({ tag: 'Knowledge', universalKey: 'KNOWLEDGE#empty' } as any))).toBe(false)
        })

        it('should return false for Feature, Knowledge with legacy examples field only', () => {
            const withExamples = { payload: [{ tag: 'Example', universalKey: 'EXAMPLE#x' }] }
            expect(isExampleAssociatedComponent({ tag: 'Feature', examples: withExamples } as unknown as StandardComponent)).toBe(false)
            expect(isExampleAssociatedComponent({ tag: 'Knowledge', examples: withExamples } as unknown as StandardComponent)).toBe(false)
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
