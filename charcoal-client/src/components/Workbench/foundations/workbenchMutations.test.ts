import { describe, expect, it } from 'vitest'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'

import { reconcileCommittedComponent } from './workbenchMutations'

const featureWithShortName = (shortName: string): StandardFeature =>
    new StandardFeature(
        deIndentWML(`
            <Feature key=(test)>
                <ShortName>${shortName}</ShortName>
                <Situation uuid=(DEFAULT)><DisplayName>Base</DisplayName></Situation>
            </Feature>
        `)
    )

const featureWithShortNameAndSituation = (
    shortName: string,
    situationWml: string
): StandardFeature =>
    new StandardFeature(
        deIndentWML(`
            <Feature key=(test)>
                <ShortName>${shortName}</ShortName>
                ${situationWml}
            </Feature>
        `)
    )

describe('reconcileCommittedComponent', () => {
    it('clears state when incoming is undefined (component removed)', () => {
        const lastReceived = featureWithShortName('Original')
        const working = lastReceived.clone() as StandardFeature

        const result = reconcileCommittedComponent({
            lastReceived,
            working,
            incoming: undefined
        })

        expect(result.working).toBeUndefined()
        expect(result.lastReceived).toBeUndefined()
        expect(result.superseded).toBe(false)
    })

    it('adopts incoming when there are no local edits', () => {
        const lastReceived = featureWithShortName('Original')
        const working = lastReceived.clone() as StandardFeature
        const incoming = featureWithShortName('Updated')

        const result = reconcileCommittedComponent({
            lastReceived,
            working,
            incoming
        })

        expect(result.superseded).toBe(false)
        expect(result.working?.shortName?.toJSON()).toBe('Updated')
        expect(result.lastReceived?.shortName?.toJSON()).toBe('Updated')
        expect(result.working?.equals(incoming)).toBe(true)
    })

    it('merges local shortName with incoming changes on a different field', () => {
        const lastReceived = featureWithShortName('Original')
        const working = lastReceived.clone() as StandardFeature
        working._payload._shortName = new StandardLiteral('Local')

        const incoming = featureWithShortNameAndSituation(
            'Original',
            `<Situation uuid=(night)><DisplayName>Night</DisplayName></Situation>
                <Situation uuid=(DEFAULT)><DisplayName>Base</DisplayName></Situation>`
        )

        const result = reconcileCommittedComponent({
            lastReceived,
            working,
            incoming
        })

        expect(result.superseded).toBe(false)
        expect(result.working?.shortName?.toJSON()).toBe('Local')
        expect(
            result.working?.situations.items.some(
                (item) => item.reference.universalKey === 'SITUATION#night'
            )
        ).toBe(true)
    })

    it('supersedes when the same field conflicts locally and externally', () => {
        const lastReceived = featureWithShortName('Original')
        const working = lastReceived.clone() as StandardFeature
        working._payload._shortName = new StandardLiteral('Local')

        const incoming = featureWithShortName('External')

        const result = reconcileCommittedComponent({
            lastReceived,
            working,
            incoming
        })

        expect(result.superseded).toBe(true)
        expect(result.working?.shortName?.toJSON()).toBe('External')
        expect(result.working?.equals(incoming)).toBe(true)
    })
})
