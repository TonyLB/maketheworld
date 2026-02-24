import internalCache from '../internalCache'
import StandardExample from '@tonylb/mtw-wml/ts/standardize/components/example'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import {
    enrichExampleEvent,
    exampleToCacheShape,
    getOrderedAssetStack,
} from './exampleEnrichment'

jest.mock('../internalCache', () => ({
    __esModule: true,
    default: {
        AssetData: {
            get: jest.fn(),
        },
        ComponentData: {
            get: jest.fn(),
        },
    },
}))

describe('exampleEnrichment helpers', () => {
    const mockInternalCache = internalCache as unknown as {
        AssetData: { get: jest.Mock };
        ComponentData: { get: jest.Mock };
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should order asset stack by _from depth with event asset preferred last', () => {
        const exampleId = 'EXAMPLE#one' as const
        const eventAssetId = 'ASSET#child' as const

        const baseExample = new StandardExample({
            tag: 'Example',
            universalKey: exampleId,
        })
        const childExample = new StandardExample({
            tag: 'Example',
            universalKey: exampleId,
        })
        ;(childExample as any)._from = 'ASSET#base'

        const stack = getOrderedAssetStack(exampleId, eventAssetId, [
            { AssetId: 'ASSET#base', component: baseExample },
            { AssetId: 'ASSET#child', component: childExample },
        ])

        expect(stack).toEqual(['ASSET#base', 'ASSET#child'])
    })

    it('should extract markState and renderedContent from Example', () => {
        const example = new StandardExample(deIndentWML(`
            <Example key=(ex) uuid=(EXAMPLE#one)>
                <Description>Hello</Description>
                <Mark key=(m1) uuid=(MARK#one)>
                    <Match>match-value</Match>
                </Mark>
            </Example>
        `))

        const payload = exampleToCacheShape(example)

        expect(payload.markState.markValue).toEqual([
            { mark: 'MARK#one', value: 'match-value' },
        ])
        expect(payload.renderedContent.description).toEqual(['Hello'])
        expect(payload.provenance.type).toBe('authored')
    })

    it('should merge Example and find parentIds in enrichExampleEvent', async () => {
        const exampleId = 'EXAMPLE#one' as const
        const eventAssetId = 'ASSET#asset1' as const

        const exampleBase = new StandardExample(deIndentWML(`
            <Example key=(base) uuid=(EXAMPLE#one)>
                <Description>Hello</Description>
            </Example>
        `))

        const room = new StandardRoom({
            tag: 'Room',
            universalKey: 'ROOM#one',
            examples: [
                { universalKey: exampleId, key: 'exampleRef', tag: 'Example' } as any,
            ],
        } as any)

        const standardForm = new StandardForm([
            {
                tag: 'Asset',
                key: 'asset1',
                universalKey: eventAssetId,
            } as any,
            exampleBase.toJSON() as any,
            room.toJSON() as any,
        ])

        mockInternalCache.ComponentData.get.mockResolvedValue([
            {
                ComponentId: exampleId,
                byAssets: [
                    {
                        AssetId: eventAssetId,
                        component: exampleBase,
                    },
                ],
            },
        ])

        mockInternalCache.AssetData.get.mockResolvedValue([
            {
                AssetId: eventAssetId,
                standardForm,
            },
        ])

        const result = await enrichExampleEvent({
            exampleId,
            eventAssetId,
            component: exampleBase,
            eventType: 'Component Updated',
        })

        expect(result.exampleId).toBe(exampleId)
        expect(result.assetStack).toEqual([eventAssetId])
        expect(result.parentIds).toEqual(['ROOM#one'])
        expect(result.example).toBeDefined()
        expect(result.example?.renderedContent.description.length).toBeGreaterThan(0)
    })
})

