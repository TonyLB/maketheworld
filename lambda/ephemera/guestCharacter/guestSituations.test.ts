import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'
import type { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import { characterRenderWmlFromCacheRecord } from '../dataSource/perception/characterRenderWmlFromCacheRecord'
import { guestCoyoteSituations } from './guestSituations'

const characterId = 'CHARACTER#guest-1' as const

const guestPayload = (name: string) => {
    const [facet] = guestCoyoteSituations(name)
    return (facet as { payload: { displayName: string; summary: RenderTree; description: RenderTree } }).payload
}

describe('guestCoyoteSituations', () => {
    it('supplies the full DisplayName/Summary/Description triplet that <Render> requires', () => {
        const payload = guestPayload('TonyLB')
        expect(payload.displayName).toEqual('TonyLB')
        expect(payload.summary?.length).toBeGreaterThan(0)
        expect(payload.description?.length).toBeGreaterThan(0)
    })

    //
    // Regression: the guest facet originally carried `description` only. `toProseTripletChildren`
    // emits just the fields that are present, so that produced a one-child `<Render>` --- which the
    // client could not reparse ("Render tag must contain exactly three children"), a show-stopper
    // that no server-side test caught because the render tests assert the emitted *string* without
    // ever parsing it back.
    //
    it('round-trips through the render channel into WML the client can reparse', () => {
        const payload = guestPayload('TonyLB')
        const wml = characterRenderWmlFromCacheRecord(characterId, {
            displayName: [payload.displayName],
            summary: payload.summary,
            description: payload.description,
        })

        const parsed = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const character = parsed.byUniversalId[characterId]
        expect(character).toBeInstanceOf(StandardCharacter)
        expect((character as StandardCharacter).render).toBeDefined()
    })
})
