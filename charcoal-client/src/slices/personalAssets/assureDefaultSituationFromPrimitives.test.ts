import { describe, it, expect } from 'vitest'
import { assureDefaultSituationFromPrimitives } from './assureDefaultSituationFromPrimitives'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

describe('assureDefaultSituationFromPrimitives', () => {
    it('adds SITUATION#DEFAULT with _from primitives when draft is empty and returns true', () => {
        const draft = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
            </Asset>
        `))
        const result = assureDefaultSituationFromPrimitives(draft)
        expect(result).toBe(true)
        const component = draft.byUniversalId['SITUATION#DEFAULT']
        expect(component).toBeDefined()
        expect(component!._from).toBe('ASSET#primitives')
    })

    it('returns false when form already has SITUATION#DEFAULT from primitives', () => {
        const draft = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Situation uuid=(DEFAULT) from=(ASSET#primitives) />
            </Asset>
        `))
        const result = assureDefaultSituationFromPrimitives(draft)
        expect(result).toBe(false)
        const component = draft.byUniversalId['SITUATION#DEFAULT']
        expect(component).toBeDefined()
        expect(component!._from).toBe('ASSET#primitives')
    })

    it('replaces SITUATION#DEFAULT with correct _from when existing has different or missing _from and returns true', () => {
        const draft = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Situation uuid=(DEFAULT) />
            </Asset>
        `))
        const result = assureDefaultSituationFromPrimitives(draft)
        expect(result).toBe(true)
        const component = draft.byUniversalId['SITUATION#DEFAULT']
        expect(component).toBeDefined()
        expect(component!._from).toBe('ASSET#primitives')
    })

    it('uses custom fromAsset when provided', () => {
        const draft = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
            </Asset>
        `))
        const result = assureDefaultSituationFromPrimitives(draft, 'ASSET#customSource' as any)
        expect(result).toBe(true)
        const component = draft.byUniversalId['SITUATION#DEFAULT']
        expect(component).toBeDefined()
        expect(component!._from).toBe('ASSET#customSource')
    })
})
