import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { LayeredTabs } from './LayeredTabs'

const exampleId = 'EXAMPLE#tab-one' as ComponentUUID
const guidanceId = 'GUIDANCE#tab-two' as ComponentUUID

describe('LayeredTabs', () => {
    it('falls back to "Untitled" when label is missing', () => {
        const handleChange = vi.fn()
        render(
            <LayeredTabs
                siblings={[{ id: exampleId, label: null }]}
                currentId={exampleId}
                onChange={handleChange}
            >
                <div>content</div>
            </LayeredTabs>
        )

        expect(screen.getByText('Untitled')).toBeTruthy()
    })

    it('calls onChange when a different tab is clicked', () => {
        const handleChange = vi.fn()
        render(
            <LayeredTabs
                siblings={[
                    { id: exampleId, label: 'First' },
                    { id: guidanceId, label: 'Second' }
                ]}
                currentId={exampleId}
                onChange={handleChange}
            >
                <div>content</div>
            </LayeredTabs>
        )

        fireEvent.click(screen.getByText('Second'))
        expect(handleChange).toHaveBeenCalledWith(guidanceId)
    })
})
