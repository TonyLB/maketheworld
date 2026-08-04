import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardObject from '@tonylb/mtw-wml/ts/standardize/components/object'
import type { EphemeraCacheDynamoItem, EphemeraCacheRenderedContent } from '../renderCache/baseClasses'
import {
    objectRenderChannelWmlForObjectId,
    objectRenderWmlFromCacheRecord,
} from './objectRenderWmlFromCacheRecord'

describe('objectRenderWmlFromCacheRecord', () => {
    const objectId = 'OBJECT#TestOne' as const

    it('builds a placeholder ShortName WML when renderedContent.displayName is present but no fallbackShortName is given', () => {
        const renderedContent: EphemeraCacheRenderedContent = {
            displayName: ['serving tray'],
            description: [],
        }
        const wml = objectRenderWmlFromCacheRecord(objectId, renderedContent)
        expect(wml).toContain('Object uuid=(TestOne)')
        expect(wml).toContain('<ShortName>⁠</ShortName>')
        expect(wml).toContain('<Render><DisplayName>serving tray</DisplayName></Render>')
        const parsed = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const object = parsed.byUniversalId[objectId] as StandardObject
        expect(object.render).toEqual({ displayName: 'serving tray' })
    })

    it('falls back to fallbackShortName when renderedContent.displayName is empty (no authored SITUATION#DEFAULT facet yet)', () => {
        const wml = objectRenderWmlFromCacheRecord(objectId, { description: [] }, { fallbackShortName: 'a small brass key' })
        expect(wml).toContain('<ShortName>a small brass key</ShortName>')
    })

    it('keeps ShortName and DisplayName distinct when both are present, rather than one overwriting the other', () => {
        const renderedContent: EphemeraCacheRenderedContent = {
            displayName: ['serving tray'],
            description: [],
        }
        const wml = objectRenderWmlFromCacheRecord(objectId, renderedContent, { fallbackShortName: 'a small brass key' })
        expect(wml).toContain('<ShortName>a small brass key</ShortName>')
        expect(wml).toContain('<Render><DisplayName>serving tray</DisplayName></Render>')
        const parsed = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const object = parsed.byUniversalId[objectId] as StandardObject
        expect(object.shortName?._payload?.plain?.toJSON()).toBe('a small brass key')
        expect(object.render).toEqual({ displayName: 'serving tray' })
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

    it('emits renderedContent.description as a Render facet alongside a distinct ShortName', () => {
        const renderedContent: EphemeraCacheRenderedContent = {
            displayName: ['rocket skateboard'],
            description: ['A skateboard with a small rocket motor attached to the rear.'],
        }
        const wml = objectRenderWmlFromCacheRecord(objectId, renderedContent, { fallbackShortName: 'skateboard' })
        expect(wml).toContain('<ShortName>skateboard</ShortName>')
        expect(wml).toContain('<Render>')
        expect(wml).toContain('<DisplayName>rocket skateboard</DisplayName>')
        expect(wml).toContain('A skateboard with a small rocket motor attached to the rear.')
    })

    it('round-trips description through StandardForm into StandardObject.render', () => {
        const renderedContent: EphemeraCacheRenderedContent = {
            displayName: ['rocket skateboard'],
            description: ['Rocket motor on the rear.'],
        }
        const wml = objectRenderWmlFromCacheRecord(objectId, renderedContent)
        const parsed = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const object = parsed.byUniversalId[objectId] as StandardObject
        expect(object.render?.description).toEqual(['Rocket motor on the rear.'])
    })

    it('omits Render entirely when the cache record carries no prose', () => {
        const wml = objectRenderWmlFromCacheRecord(objectId, { description: [] }, { fallbackShortName: 'a small brass key' })
        expect(wml).not.toContain('<Render>')
    })

    it('round-trips through StandardForm: parsed shortName matches fallbackShortName, not renderedContent.displayName', () => {
        const wml = objectRenderWmlFromCacheRecord(
            objectId,
            { displayName: ['a small brass key'], description: [] },
            { fallbackShortName: 'brass key' }
        )
        const parsed = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const object = parsed.byUniversalId[objectId] as StandardObject
        expect(object.shortName?._payload?.plain?.toJSON()).toBe('brass key')
        expect(object.render?.displayName).toBe('a small brass key')
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
        // No fallbackShortName is threaded through this entry point, so ShortName falls back to the
        // placeholder while the authored displayName lands in the distinct Render facet.
        expect(wml).toContain('<Render><DisplayName>serving tray</DisplayName></Render>')
        const parsed = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const object = parsed.byUniversalId[objectId] as StandardObject
        expect(object.render).toEqual({ displayName: 'serving tray' })
    })
})
