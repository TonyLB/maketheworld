import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { buildRoomDescriptionPrompt } from './buildRoomDescriptionPrompt'
import type { EphemeraCacheDynamoItem, EphemeraCacheMarkState } from '../dataSource/renderCache/baseClasses'

const makeMarkState = (entries: Array<{ mark: string; value: string }>): EphemeraCacheMarkState => ({
    markValue: entries
})

const minimalWML = deIndentWML(`
    <Asset uuid=(test)>
        <Room uuid=(room1) key=(room1)>
            <ShortName>Test Room</ShortName>
            <Lens uuid=(lens1)>
                <ShortName>Test Lens</ShortName>
                <Mark uuid=(mark1)><ShortName>Illumination</ShortName></Mark>
            </Lens>
            <Guidance uuid=(guid1) key=(guid1)>
                <ShortName>Bright mood</ShortName>
                <Instructions>Be descriptive; emphasize light and clarity.</Instructions>
                <Mark uuid=(mark1)><Match>Bright</Match></Mark>
            </Guidance>
        </Room>
    </Asset>
`)

describe('buildRoomDescriptionPrompt', () => {
    it('includes room name, marks, guidance, proposed state, and JSON instruction', () => {
        const form = new StandardForm(minimalWML)
        const markState = makeMarkState([{ mark: 'MARK#m1', value: 'Dim' }])
        const prompt = buildRoomDescriptionPrompt({
            roomId: 'ROOM#test',
            generationContext: form,
            markState,
            cachedExamples: []
        })
        expect(prompt).toContain('## Room')
        expect(prompt).toContain('Test Room')
        expect(prompt).toContain('## Marks')
        expect(prompt).toContain('Illumination')
        expect(prompt).toContain('## Guidance')
        expect(prompt).toContain('Bright mood')
        expect(prompt).toContain('Be descriptive; emphasize light and clarity')
        expect(prompt).toContain('## Proposed state')
        expect(prompt).toContain('MARK#m1: Dim')
        expect(prompt).toContain('(No existing examples')
        expect(prompt).toContain('displayName, summary, description')
        expect(prompt).toContain('No markdown')
    })

    it('includes cached examples when provided', () => {
        const form = new StandardForm(minimalWML)
        const markState = makeMarkState([])
        const cachedExamples: EphemeraCacheDynamoItem[] = [
            {
                EphemeraId: 'ROOM#r1',
                DataCategory: 'CACHE#x',
                markState: makeMarkState([{ mark: 'MARK#m1', value: 'Bright' }]),
                renderedContent: {
                    displayName: ['Bright Hall'],
                    summary: ['A well-lit space.'],
                    description: ['The room is filled with natural light.']
                },
                provenance: { type: 'authored' },
                perspectiveId: 'P#1',
                perspectiveMatcher: { requiredAssetIds: [] }
            }
        ]
        const prompt = buildRoomDescriptionPrompt({
            roomId: 'ROOM#r1',
            generationContext: form,
            markState,
            cachedExamples
        })
        expect(prompt).toContain('--- Example 1 ---')
        expect(prompt).toContain('Bright Hall')
        expect(prompt).toContain('A well-lit space.')
        expect(prompt).toContain('The room is filled with natural light.')
    })
})
