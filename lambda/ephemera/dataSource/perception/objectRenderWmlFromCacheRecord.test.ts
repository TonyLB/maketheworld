import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardObject from '@tonylb/mtw-wml/ts/standardize/components/object'
import type { EphemeraCacheDynamoItem, EphemeraCacheRenderedContent } from '../renderCache/baseClasses'
import {
    objectRenderChannelWmlForObjectId,
    objectRenderWmlFromCacheRecord,
} from './objectRenderWmlFromCacheRecord'

describe('objectRenderWmlFromCacheRecord', () => {
    const objectId = 'OBJECT#TestOne' as const

    it('builds shortName WML from renderedContent.displayName (stub, PK-6)', () => {
        const renderedContent: EphemeraCacheRenderedContent = {
            displayName: ['serving tray'],
            description: [],
        }
        const wml = objectRenderWmlFromCacheRecord(objectId, renderedContent)
        expect(wml).toContain('Object uuid=(TestOne)')
        expect(wml).toContain('<ShortName>serving tray</ShortName>')
    })

    it('always round-trips as valid, re-parseable WML --- Object structurally requires a non-empty ShortName', () => {
        const wml = objectRenderWmlFromCacheRecord(objectId, { description: [] })
        // Object's WML content model requires exactly one non-empty ShortName child; re-parsing must
        // not throw even when no real shortName text was resolved (the placeholder covers this).
        const parsed = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const object = parsed.byUniversalId[objectId]
        expect(object).toBeInstanceOf(StandardObject)
        expect((object as StandardObject).shortName).toBeDefined()
    })

    it('round-trips through StandardForm: parsed shortName matches the source text', () => {
        const wml = objectRenderWmlFromCacheRecord(objectId, { displayName: ['a small brass key'], description: [] })
        const parsed = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const object = parsed.byUniversalId[objectId] as StandardObject
        expect(object.shortName?._payload?.plain?.toJSON()).toBe('a small brass key')
    })
})

describe('objectRenderChannelWmlForObjectId', () => {
    const objectId = 'OBJECT#TestOne' as const

    it('falls back to a valid placeholder Object when no cache records are supplied', () => {
        const wml = objectRenderChannelWmlForObjectId(objectId, [])
        expect(wml).toContain('Object uuid=(TestOne)')
        expect(() => new StandardForm(wml, { standardizeMode: 'ephemeraWire' })).not.toThrow()
    })

    it('selects the default situation cache record when present', () => {
        const records = [
            {
                EphemeraId: objectId,
                DataCategory: 'CACHE#one',
                situationId: 'SITUATION#DEFAULT',
                renderedContent: { displayName: ['serving tray'], description: [] },
            } as unknown as EphemeraCacheDynamoItem,
        ]
        const wml = objectRenderChannelWmlForObjectId(objectId, records)
        expect(wml).toContain('<ShortName>serving tray</ShortName>')
    })
})
