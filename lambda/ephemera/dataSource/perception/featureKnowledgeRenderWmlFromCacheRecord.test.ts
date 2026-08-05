import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import type { EphemeraCacheDynamoItem, EphemeraCacheRenderedContent } from '../renderCache/baseClasses'
import {
    featureRenderChannelWmlForFeatureId,
    featureRenderWmlFromCacheRecord,
    knowledgeRenderChannelWmlForKnowledgeId,
    knowledgeRenderWmlFromCacheRecord,
} from './featureKnowledgeRenderWmlFromCacheRecord'

describe('featureRenderWmlFromCacheRecord', () => {
    const featureId = 'FEATURE#TestOne' as const

    it('includes Render-backed prose', () => {
        const renderedContent: EphemeraCacheRenderedContent = {
            displayName: ['Example Name'],
            description: ['Description'],
        }
        const wml = featureRenderWmlFromCacheRecord(featureId, renderedContent)
        expect(wml).toEqual(deIndentWML(`
            <Asset uuid=(render)>
                <Feature uuid=(TestOne) ref={0}>
                    <Render>
                        <DisplayName>Example Name</DisplayName>
                        <Description>Description</Description>
                    </Render>
                </Feature>
            </Asset>
        `))
        const parsed = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const feature = parsed.byUniversalId[featureId] as StandardFeature
        expect(feature.render).toEqual({ displayName: 'Example Name', description: ['Description'] })
    })

    it('produces minimal Feature when renderedContent maps to empty facet', () => {
        const wml = featureRenderWmlFromCacheRecord(featureId, { description: [] })
        const parsed = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const feature = parsed.byUniversalId[featureId]
        expect(feature).toBeInstanceOf(StandardFeature)
        expect((feature as StandardFeature).render).toBeUndefined()
        expect(schemaToWML([parsed.schema])).toEqual(deIndentWML(`
            <Asset uuid=(render)><Feature uuid=(TestOne) ref={0} /></Asset>
        `))
    })
})

describe('knowledgeRenderWmlFromCacheRecord', () => {
    const knowledgeId = 'KNOWLEDGE#TestOne' as const

    it('includes Render-backed prose', () => {
        const renderedContent: EphemeraCacheRenderedContent = {
            displayName: ['Example Name'],
            summary: ['Summary'],
            description: ['Description'],
        }
        const wml = knowledgeRenderWmlFromCacheRecord(knowledgeId, renderedContent)
        const parsed = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const knowledge = parsed.byUniversalId[knowledgeId]
        expect(knowledge).toBeInstanceOf(StandardKnowledge)
        expect((knowledge as StandardKnowledge).render).toBeDefined()
        expect(schemaToWML([parsed.schema])).toEqual(deIndentWML(`
            <Asset uuid=(render)>
                <Knowledge uuid=(TestOne) ref={0}>
                    <Render>
                        <DisplayName>Example Name</DisplayName>
                        <Summary>Summary</Summary>
                        <Description>Description</Description>
                    </Render>
                </Knowledge>
            </Asset>
        `))
    })

    it('produces minimal Knowledge when renderedContent maps to empty facet', () => {
        const wml = knowledgeRenderWmlFromCacheRecord(knowledgeId, { description: [] })
        const parsed = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const knowledge = parsed.byUniversalId[knowledgeId]
        expect(knowledge).toBeInstanceOf(StandardKnowledge)
        expect((knowledge as StandardKnowledge).render).toBeUndefined()
    })
})

describe('featureRenderChannelWmlForFeatureId', () => {
    const featureId = 'FEATURE#TestOne' as const

    it('uses SITUATION#DEFAULT cache row when multiple rows exist', () => {
        const defaultRecord: EphemeraCacheDynamoItem = {
            EphemeraId: featureId,
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
        const wml = featureRenderChannelWmlForFeatureId(featureId, [otherRecord, defaultRecord])
        expect(wml).toMatch(/From DEFAULT/)
        expect(wml).not.toMatch(/From other situation/)
    })

    it('omits Render when no SITUATION#DEFAULT row exists', () => {
        const otherRecord: EphemeraCacheDynamoItem = {
            EphemeraId: featureId,
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
        const wml = featureRenderChannelWmlForFeatureId(featureId, [otherRecord])
        expect(schemaToWML([new StandardForm(wml, { standardizeMode: 'ephemeraWire' }).schema])).toEqual(deIndentWML(`
            <Asset uuid=(render)><Feature uuid=(TestOne) ref={0} /></Asset>
        `))
    })

    it('matches empty-list behavior when there are no cache rows', () => {
        const wmlEmpty = featureRenderChannelWmlForFeatureId(featureId, [])
        const wmlDirect = featureRenderWmlFromCacheRecord(featureId, { description: [] })
        expect(wmlEmpty).toEqual(wmlDirect)
    })
})

describe('knowledgeRenderChannelWmlForKnowledgeId', () => {
    const knowledgeId = 'KNOWLEDGE#TestOne' as const

    it('uses SITUATION#DEFAULT cache row', () => {
        const defaultRecord: EphemeraCacheDynamoItem = {
            EphemeraId: knowledgeId,
            DataCategory: 'CACHE#default',
            markState: { markValue: [] },
            renderedContent: {
                displayName: ['Example Name'],
                summary: ['Summary'],
                description: ['Description'],
            },
            provenance: { type: 'authored' },
            perspectiveId: 'PERSPECTIVE#test',
            perspectiveMatcher: { requiredAssetIds: [], forbiddenAssetIds: [] },
            situationId: 'SITUATION#DEFAULT',
        }
        const wml = knowledgeRenderChannelWmlForKnowledgeId(knowledgeId, [defaultRecord])
        expect(wml).toMatch(/Example Name/)
        expect(wml).toMatch(/Summary/)
    })

    it('matches empty-list behavior when there are no cache rows', () => {
        const wmlEmpty = knowledgeRenderChannelWmlForKnowledgeId(knowledgeId, [])
        const wmlDirect = knowledgeRenderWmlFromCacheRecord(knowledgeId, { description: [] })
        expect(wmlEmpty).toEqual(wmlDirect)
    })
})
