/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardRender } from '@tonylb/mtw-wml/ts/standardize/render'

import { mockWorkbenchReturn, resetWorkbenchAssetMock } from '../WorkbenchComponent/testing/mock'
import StandardRenderEditor from './StandardRenderEditor'

vi.mock('react-redux', () => ({
    useDispatch: () => vi.fn()
}))

vi.mock('../useWorkbenchAsset', () => ({
    useWorkbenchAsset: () => mockWorkbenchReturn
}))

vi.mock('../../../Onboarding/TutorialPopover', () => ({
    default: () => null
}))

describe('StandardRenderEditor', () => {
    beforeEach(() => {
        resetWorkbenchAssetMock()
    })

    it('does not storm onChange when parent rerenders with clone-equal StandardRender (debounce=false)', () => {
        const onChange = vi.fn()
        const standardForm = new StandardForm({
            universalKey: 'ASSET#test',
            components: [],
            metaData: []
        })
        mockWorkbenchReturn.standardForm = standardForm
        mockWorkbenchReturn.localStandardForm = standardForm

        const initialValue = new StandardRender(['Hello'])

        const { rerender } = render(
            <StandardRenderEditor
                value={initialValue}
                onChange={onChange}
                debounce={false}
                tag="Summary"
            />
        )

        expect(onChange).toHaveBeenCalledTimes(0)

        rerender(
            <StandardRenderEditor
                value={initialValue.clone()}
                onChange={onChange}
                debounce={false}
                tag="Summary"
            />
        )
        rerender(
            <StandardRenderEditor
                value={initialValue.clone()}
                onChange={onChange}
                debounce={false}
                tag="Summary"
            />
        )
        rerender(
            <StandardRenderEditor
                value={initialValue.clone()}
                onChange={onChange}
                debounce={false}
                tag="Summary"
            />
        )

        expect(onChange).toHaveBeenCalledTimes(0)
    })

    it('does not loop onChange when parent pushes different render content without user input', () => {
        const onChange = vi.fn()
        const standardForm = new StandardForm({
            universalKey: 'ASSET#test',
            components: [],
            metaData: []
        })
        mockWorkbenchReturn.standardForm = standardForm
        mockWorkbenchReturn.localStandardForm = standardForm

        const { rerender } = render(
            <StandardRenderEditor
                value={new StandardRender(['Hello'])}
                onChange={onChange}
                debounce={false}
                tag="Summary"
            />
        )

        expect(onChange.mock.calls.length).toBeLessThan(5)

        rerender(
            <StandardRenderEditor
                value={new StandardRender(['World'])}
                onChange={onChange}
                debounce={false}
                tag="Summary"
            />
        )

        expect(onChange.mock.calls.length).toBeLessThan(5)
    })
})
