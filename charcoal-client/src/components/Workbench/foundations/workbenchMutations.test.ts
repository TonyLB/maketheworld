import { describe, expect, it } from 'vitest'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'

import {
    applyShortNameOnComponent,
    applyWorkingComponentToDraft,
    literalPlainString,
    normalizeOptionalLiteral,
    prepareComponentForFlush,
    reconcileCommittedComponent
} from './workbenchMutations'

const FEATURE_ID = 'FEATURE#feat1' as ComponentUUID

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

describe('shortName mutations (D11)', () => {
    it('literalPlainString returns empty string when literal is missing', () => {
        expect(literalPlainString(undefined)).toBe('')
    })

    it('normalizeOptionalLiteral clears empty and whitespace-only literals', () => {
        expect(normalizeOptionalLiteral(undefined)).toBeUndefined()
        expect(normalizeOptionalLiteral(new StandardLiteral(''))).toBeUndefined()
        expect(normalizeOptionalLiteral(new StandardLiteral('   '))).toBeUndefined()
    })

    it('normalizeOptionalLiteral trims non-empty literals', () => {
        expect(normalizeOptionalLiteral(new StandardLiteral('  hello  '))?.toJSON()).toBe('hello')
    })

    it('applyShortNameOnComponent clears whitespace-only shortName on payload', () => {
        const feature = featureWithShortName('Original')
        feature._payload._shortName = new StandardLiteral('   ')
        applyShortNameOnComponent(feature)
        expect(feature.shortName).toBeUndefined()
    })

    it('prepareComponentForFlush clears shortName on payload for whitespace-only input', () => {
        const feature = featureWithShortName('Original')
        feature._payload._shortName = new StandardLiteral('   ')
        const flushed = prepareComponentForFlush(feature)
        expect(flushed.shortName).toBeUndefined()
        expect((flushed.toJSON() as { shortName?: unknown }).shortName).toBeUndefined()
    })
})

describe('applyWorkingComponentToDraft', () => {
    const assetWithFeature = (): StandardForm =>
        new StandardForm(
            deIndentWML(`
                <Asset uuid=(test)>
                    <Feature uuid=(feat1)>
                        <ShortName>Original</ShortName>
                        <Situation uuid=(DEFAULT)><DisplayName>Base</DisplayName></Situation>
                    </Feature>
                </Asset>
            `)
        )

    it('assigns D11-normalized component to draft.byUniversalId and returns flushed clone', () => {
        const draft = assetWithFeature()
        const working = draft.byUniversalId[FEATURE_ID]!.clone() as StandardFeature
        working._payload._shortName = new StandardLiteral('   ')

        const flushed = applyWorkingComponentToDraft(draft, FEATURE_ID, working)
        const inDraft = draft.byUniversalId[FEATURE_ID]

        expect(inDraft).toBeDefined()
        expect(inDraft?.shortName).toBeUndefined()
        expect(flushed.shortName).toBeUndefined()
        expect(flushed.equals(inDraft!)).toBe(true)
        expect(working.shortName).toBeDefined()
    })

    it('writes trimmed shortName to draft when working has valid shortName', () => {
        const draft = assetWithFeature()
        const working = draft.byUniversalId[FEATURE_ID]!.clone() as StandardFeature
        working._payload._shortName = new StandardLiteral('  Trimmed  ')

        const flushed = applyWorkingComponentToDraft(draft, FEATURE_ID, working)

        expect(flushed.shortName?.toJSON()).toBe('Trimmed')
        expect(draft.byUniversalId[FEATURE_ID]?.shortName?.toJSON()).toBe('Trimmed')
    })
})

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
