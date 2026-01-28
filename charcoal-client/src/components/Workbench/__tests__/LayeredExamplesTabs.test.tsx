import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { LayeredExamplesTabs } from '../LayeredContext/LayeredExamplesTabs'

const exampleId = 'COMPONENT#example' as ComponentUUID
const otherId = 'COMPONENT#other' as ComponentUUID

describe('LayeredExamplesTabs', () => {
    it('falls back to "Untitled" when label is missing', () => {
        const handleChange = vi.fn()
        render(
            <LayeredExamplesTabs
                siblings={[{ id: exampleId, label: null }]}
                currentId={exampleId}
                onChange={handleChange}
            >
                <div>content</div>
            </LayeredExamplesTabs>
        )

        expect(screen.getByText('Untitled')).toBeTruthy()
    })

    it('calls onChange when a different tab is clicked', () => {
        const handleChange = vi.fn()
        render(
            <LayeredExamplesTabs
                siblings={[
                    { id: exampleId, label: 'First' },
                    { id: otherId, label: 'Second' }
                ]}
                currentId={exampleId}
                onChange={handleChange}
            >
                <div>content</div>
            </LayeredExamplesTabs>
        )

        fireEvent.click(screen.getByText('Second'))
        expect(handleChange).toHaveBeenCalledWith(otherId)
    })
})

