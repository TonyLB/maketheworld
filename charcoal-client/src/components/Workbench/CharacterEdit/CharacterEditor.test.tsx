/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

/** React 18.3+ `act` (not the deprecated `react-dom/test-utils` re-export from RTL). */
const act = (React as typeof React & {
    act: (callback: () => void | Promise<void>) => void | Promise<void>
}).act
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardCharacter } from '@tonylb/mtw-wml/ts/standardize/components/character'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

import {
    applyLastUpdateStandardMock,
    mockWorkbenchReturn,
    resetWorkbenchAssetMock,
    seedWorkbenchAsset,
    updateStandardMock
} from '../foundations/WorkbenchComponent/testing/mock'

vi.mock('react-redux', () => ({
    useDispatch: () => vi.fn()
}))

vi.mock('../foundations/useWorkbenchAsset', () => ({
    useWorkbenchAsset: () => mockWorkbenchReturn
}))

import { LiteralGlossField } from './CharacterEditor'

const CHARACTER_ID = 'CHARACTER#char1' as ComponentUUID

const FLUSH_DELAY_MS = 500

const characterWml = `
    <Asset uuid=(test)>
        <Character uuid=(char1)>
            <ShortName>Original</ShortName>
            <Gloss>A worn coat.</Gloss>
        </Character>
    </Asset>
`

const getCharacter = (): StandardCharacter => {
    const component = mockWorkbenchReturn.standardForm.byUniversalId[CHARACTER_ID]
    if (!(component instanceof StandardCharacter)) {
        throw new Error('Fixture did not seed a StandardCharacter')
    }
    return component
}

const getFlushedCharacterGloss = (
    componentId: ComponentUUID,
    baseForm: StandardForm
): string | undefined => {
    const updated = applyLastUpdateStandardMock(baseForm._clone())
    const component = updated.byUniversalId[componentId]
    if (!(component instanceof StandardCharacter)) {
        return undefined
    }
    const glossJson = component.gloss?.toJSON()
    return typeof glossJson === 'string' ? glossJson : undefined
}

describe('LiteralGlossField', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        resetWorkbenchAssetMock()
        seedWorkbenchAsset(characterWml)
    })

    afterEach(() => {
        vi.clearAllTimers()
        vi.useRealTimers()
    })

    it('seeds from the committed gloss', () => {
        render(<LiteralGlossField character={getCharacter()} />)

        expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('A worn coat.')
    })

    it('flushes an edited gloss to updateStandard as <Gloss> on the committed StandardCharacter', () => {
        render(<LiteralGlossField character={getCharacter()} />)

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'A cracked clay pot.' } })

        expect(updateStandardMock).not.toHaveBeenCalled()

        act(() => {
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        expect(
            getFlushedCharacterGloss(CHARACTER_ID, mockWorkbenchReturn.standardForm)
        ).toBe('A cracked clay pot.')
    })

    it('clearing the field removes the gloss', () => {
        render(<LiteralGlossField character={getCharacter()} />)

        fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } })

        act(() => {
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        expect(
            getFlushedCharacterGloss(CHARACTER_ID, mockWorkbenchReturn.standardForm)
        ).toBeUndefined()
    })
})
