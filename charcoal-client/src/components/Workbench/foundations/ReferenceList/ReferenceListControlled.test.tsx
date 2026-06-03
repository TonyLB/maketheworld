/**
 * @vitest-environment jsdom
 */

import React, { useCallback, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

import { ReferenceListControlled } from './ReferenceListControlled'
import {
    resetWorkbenchAssetMock,
    seedWorkbenchAsset,
    updateStandardMock
} from '../WorkbenchComponent/testing/harness'

vi.mock('../useWorkbenchAsset', async (importOriginal) => {
    const mock = await import('../WorkbenchComponent/testing/mock')
    return {
        useWorkbenchAsset: () => mock.mockWorkbenchReturn
    }
})

vi.mock('react-redux', () => ({
    useDispatch: () => vi.fn()
}))

const wml = `
    <Asset uuid=(test)>
        <Room uuid=(room1)>
            <ShortName>Test Room</ShortName>
            <Guidance uuid=(guid1)><ShortName>Guidance One</ShortName></Guidance>
        </Room>
    </Asset>
`

const TestHost: React.FunctionComponent<{
    onReferenceListChange: (mutate: (list: ReferenceList) => void) => void
}> = ({ onReferenceListChange }) => {
    const [list, setList] = useState(
        () =>
            new ReferenceList([
                new StandardReference({ universalKey: 'GUIDANCE#guid1', tag: 'Guidance' })
            ])
    )

    const handleChange = useCallback(
        (mutate: (list: ReferenceList) => void) => {
            setList((prev) => {
                const next = new ReferenceList(prev.payload)
                mutate(next)
                return next
            })
            onReferenceListChange(mutate)
        },
        [onReferenceListChange]
    )

    return (
        <ReferenceListControlled
            title="Guidance"
            referenceList={list}
            onReferenceListChange={handleChange}
            tag="Guidance"
            association={() => {}}
            requestCreate={() => {}}
        />
    )
}

describe('ReferenceListControlled', () => {
    beforeEach(() => {
        resetWorkbenchAssetMock()
        seedWorkbenchAsset(wml)
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('renders items from referenceList prop', () => {
        const onChange = vi.fn()
        render(<TestHost onReferenceListChange={onChange} />)
        expect(screen.getAllByText('Guidance One').length).toBeGreaterThan(0)
    })

    it('remove calls onReferenceListChange and does not call updateStandard', () => {
        const onChange = vi.fn()
        render(<TestHost onReferenceListChange={onChange} />)

        const deleteButtons = screen.getAllByLabelText('remove')
        act(() => {
            fireEvent.click(deleteButtons[0])
        })

        expect(onChange).toHaveBeenCalledTimes(1)
        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('invokes persistDraftUpdate when provided for association path', () => {
        const persistDraftUpdate = vi.fn((update: (draft: StandardForm) => void) => {
            update(new StandardForm(wml))
        })
        const onAssociateReference = vi.fn()

        render(
            <ReferenceListControlled
                title="Guidance"
                referenceList={
                    new ReferenceList([
                        new StandardReference({
                            universalKey: 'GUIDANCE#guid1' as ComponentUUID,
                            tag: 'Guidance'
                        })
                    ])
                }
                onReferenceListChange={() => {}}
                tag="Guidance"
                association={() => {}}
                requestCreate={() => {}}
                onAssociateReference={onAssociateReference}
                persistDraftUpdate={persistDraftUpdate}
                affordance={{ enableReferenceExisting: true }}
            />
        )

        expect(screen.getByText('Guidance')).toBeTruthy()
    })
})
