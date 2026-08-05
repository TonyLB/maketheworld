import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import type { EphemeraCacheDynamoItem, EphemeraCacheRenderedContent } from '../renderCache/baseClasses'
import {
    characterRenderChannelWmlForCharacterId,
    characterRenderWmlFromCacheRecord,
} from './characterRenderWmlFromCacheRecord'

describe('characterRenderWmlFromCacheRecord', () => {
    const characterId = 'CHARACTER#TestOne' as const

    it('includes Render-backed prose', () => {
        const renderedContent: EphemeraCacheRenderedContent = {
            displayName: ['Example Name'],
            description: ['Description'],
        }
        const wml = characterRenderWmlFromCacheRecord(characterId, renderedContent)
        expect(wml).toEqual(deIndentWML(`
            <Asset uuid=(render)>
                <Character uuid=(TestOne) ref={0}>
                    <Render>
                        <DisplayName>Example Name</DisplayName>
                        <Description>Description</Description>
                    </Render>
                </Character>
            </Asset>
        `))
        const parsed = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const character = parsed.byUniversalId[characterId] as StandardCharacter
        expect(character.render).toEqual({ displayName: 'Example Name', description: ['Description'] })
    })

    it('produces minimal Character when renderedContent maps to empty facet', () => {
        const wml = characterRenderWmlFromCacheRecord(characterId, { description: [] })
        const parsed = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const character = parsed.byUniversalId[characterId]
        expect(character).toBeInstanceOf(StandardCharacter)
        expect((character as StandardCharacter).render).toBeUndefined()
        expect(schemaToWML([parsed.schema])).toEqual(deIndentWML(`
            <Asset uuid=(render)><Character uuid=(TestOne) ref={0} /></Asset>
        `))
    })
})

describe('characterRenderChannelWmlForCharacterId', () => {
    const characterId = 'CHARACTER#TestOne' as const

    it('uses SITUATION#DEFAULT cache row when multiple rows exist', () => {
        const defaultRecord: EphemeraCacheDynamoItem = {
            EphemeraId: characterId,
            DataCategory: 'CACHE#default',
            markState: { markValue: [] },
            renderedContent: {
                displayName: ['From DEFAULT'],
                description: ['Default description'],
            },
            provenance: { type: 'authored' },
            perspectiveId: 'PERSPECTIVE#test',
            perspectiveMatcher: { requiredAssetIds: [], forbiddenAssetIds: [] },
            situationId: 'SITUATION#DEFAULT',
        }
        const otherRecord: EphemeraCacheDynamoItem = {
            ...defaultRecord,
            DataCategory: 'CACHE#other',
            renderedContent: {
                displayName: ['From other situation'],
                description: ['Other description'],
            },
            situationId: 'SITUATION#other',
        }
        const wml = characterRenderChannelWmlForCharacterId(characterId, [otherRecord, defaultRecord])
        expect(wml).toMatch(/From DEFAULT/)
        expect(wml).not.toMatch(/From other situation/)
    })

    it('omits Render when no SITUATION#DEFAULT row exists', () => {
        const otherRecord: EphemeraCacheDynamoItem = {
            EphemeraId: characterId,
            DataCategory: 'CACHE#other',
            markState: { markValue: [] },
            renderedContent: {
                displayName: ['Other situation'],
                description: ['Other description'],
            },
            provenance: { type: 'authored' },
            perspectiveId: 'PERSPECTIVE#test',
            perspectiveMatcher: { requiredAssetIds: [], forbiddenAssetIds: [] },
            situationId: 'SITUATION#other',
        }
        const wml = characterRenderChannelWmlForCharacterId(characterId, [otherRecord])
        expect(schemaToWML([new StandardForm(wml, { standardizeMode: 'ephemeraWire' }).schema])).toEqual(deIndentWML(`
            <Asset uuid=(render)><Character uuid=(TestOne) ref={0} /></Asset>
        `))
    })

    it('matches empty-list behavior when there are no cache rows', () => {
        const wmlEmpty = characterRenderChannelWmlForCharacterId(characterId, [])
        const wmlDirect = characterRenderWmlFromCacheRecord(characterId, { description: [] })
        expect(wmlEmpty).toEqual(wmlDirect)
    })
})
