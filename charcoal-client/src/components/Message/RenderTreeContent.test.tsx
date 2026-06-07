/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import RenderTreeContent from './RenderTreeContent'
import { RenderTree } from '@tonylb/mtw-base/ts/renderTree'

const noopOnClickLink = () => {}

const spaceTag = { data: { tag: 'Space' as const }, children: [] as [] }
const brTag = { data: { tag: 'br' as const }, children: [] as [] }
const doubleSpaceTag = { data: { tag: 'DoubleSpace' as const }, children: [] as [] }
const doubleBRTag = { data: { tag: 'DoubleBR' as const }, children: [] as [] }

const renderTree = (list: RenderTree) => {
    return render(<RenderTreeContent list={list} onClickLink={noopOnClickLink} />)
}

const countLineBreaks = () => screen.queryAllByTestId('render-line-break').length

describe('RenderTreeContent display collapse', () => {
    describe('core fixtures', () => {
        it('collapses DoubleSpace to a single visible space', () => {
            renderTree(['Hello', doubleSpaceTag, 'world'])
            expect(screen.getByText('Hello world')).toBeInTheDocument()
        })

        it('collapses DoubleBR to one block break', () => {
            const { container } = renderTree(['First', doubleBRTag, 'Last'])
            expect(container.textContent).toContain('First')
            expect(container.textContent).toContain('Last')
            expect(countLineBreaks()).toBe(1)
        })

        it('collapses legacy consecutive br to one block break', () => {
            const { container } = renderTree(['First', brTag, brTag, 'Last'])
            expect(container.textContent).toContain('First')
            expect(container.textContent).toContain('Last')
            expect(countLineBreaks()).toBe(1)
        })

        it('keeps Track B Space before br invisible with one break', () => {
            const { container } = renderTree(['Line one', spaceTag, brTag, 'Line two'])
            expect(container.textContent).toContain('Line one')
            expect(container.textContent).toContain('Line two')
            expect(countLineBreaks()).toBe(1)
        })

        it('keeps Track B Space after br invisible with one break', () => {
            const { container } = renderTree(['Line one', brTag, spaceTag, 'Line two'])
            expect(container.textContent).toContain('Line one')
            expect(container.textContent).toContain('Line two')
            expect(countLineBreaks()).toBe(1)
        })
    })

    describe('interaction fixtures', () => {
        it('collapses DoubleSpace near Space and br without double breaks', () => {
            renderTree(['Hello', doubleSpaceTag, spaceTag, brTag, 'Next'])
            expect(screen.getByText(/Hello Next/)).toBeInTheDocument()
            expect(countLineBreaks()).toBe(1)
        })

        it('collapses DoubleBR with Track B paragraph-edge spaces to one break', () => {
            const { container } = renderTree(['First', spaceTag, doubleBRTag, brTag, spaceTag, 'Last'])
            expect(container.textContent).toContain('First')
            expect(container.textContent).toContain('Last')
            expect(countLineBreaks()).toBe(1)
        })
    })
})
