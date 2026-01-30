/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { vi, beforeEach, describe, it, expect } from 'vitest'
import '@testing-library/jest-dom'
import { createEditor, Descendant } from 'slate'
import { Slate, withReact } from 'slate-react'
import { Element, Leaf } from './components'
import { CustomParagraphElement, CustomText, CustomFeatureLinkElement, CustomKnowledgeLinkElement } from '../baseClasses'

// Mock the DescriptionLinkFeatureChip component
vi.mock('../../Message/DescriptionLink', () => ({
    DescriptionLinkFeatureChip: ({ children, tooltipTitle }: { children: React.ReactNode, tooltipTitle: string }) => (
        <span data-testid="description-link-chip" title={tooltipTitle}>
            {children}
        </span>
    )
}))

// Mock the InlineChromiumBugfix component
vi.mock('../../../lib/slateUtils', () => ({
    default: () => <span data-testid="inline-chromium-bugfix" />
}))

// Valid default document for Slate (0.123+ requires initialValue to be a list of elements)
const DEFAULT_SLATE_VALUE: Descendant[] = [
    { type: 'paragraph', children: [{ text: '' }] }
]

// Test wrapper with Material-UI theme and Slate editor
const TestWrapper: React.FC<{ children: React.ReactNode, initialValue?: Descendant[] }> = ({ children, initialValue = DEFAULT_SLATE_VALUE }) => {
    const theme = createTheme()
    const editor = withReact(createEditor())

    return (
        <ThemeProvider theme={theme}>
            <Slate editor={editor} initialValue={initialValue}>
                {children}
            </Slate>
        </ThemeProvider>
    )
}

describe('StandardRenderEditor Components', () => {
    describe('Element Component', () => {
        const mockAttributes = { 
            'data-slate-node': 'element' as const,
            'data-slate-element': 'true',
            ref: null
        }
        const mockChildren = <span>Test content</span>

        describe('featureLink rendering', () => {
            it('renders feature link with correct tooltip and structure', () => {
                const element: CustomFeatureLinkElement = {
                    type: 'featureLink',
                    to: 'test-feature',
                    children: []
                }

                render(
                    <TestWrapper>
                        <Element
                            attributes={mockAttributes}
                            children={mockChildren}
                            element={element}
                        />
                    </TestWrapper>
                )

                const linkChip = screen.getByTestId('description-link-chip')
                expect(linkChip).toBeInTheDocument()
                expect(linkChip).toHaveAttribute('title', 'Feature: test-feature')
                
                // Check for InlineChromiumBugfix components
                const bugfixes = screen.getAllByTestId('inline-chromium-bugfix')
                expect(bugfixes).toHaveLength(2)
                
                // Check content is rendered
                expect(screen.getByText('Test content')).toBeInTheDocument()
            })
        })

        describe('knowledgeLink rendering', () => {
            it('renders knowledge link with correct tooltip and structure', () => {
                const element: CustomKnowledgeLinkElement = {
                    type: 'knowledgeLink',
                    to: 'test-knowledge',
                    children: []
                }

                render(
                    <TestWrapper>
                        <Element
                            attributes={mockAttributes}
                            children={mockChildren}
                            element={element}
                        />
                    </TestWrapper>
                )

                const linkChip = screen.getByTestId('description-link-chip')
                expect(linkChip).toBeInTheDocument()
                expect(linkChip).toHaveAttribute('title', 'Knowledge: test-knowledge')
                
                // Check for InlineChromiumBugfix components
                const bugfixes = screen.getAllByTestId('inline-chromium-bugfix')
                expect(bugfixes).toHaveLength(2)
                
                // Check content is rendered
                expect(screen.getByText('Test content')).toBeInTheDocument()
            })
        })

        describe('paragraph rendering', () => {
            it('renders paragraph as simple block with inline-block layout', () => {
                const element: CustomParagraphElement = {
                    type: 'paragraph',
                    children: []
                }

                render(
                    <TestWrapper>
                        <Element
                            attributes={mockAttributes}
                            children={mockChildren}
                            element={element}
                        />
                    </TestWrapper>
                )

                const paragraph = screen.getByText('Test content').closest('div')
                expect(paragraph).toBeInTheDocument()
                expect(paragraph).toHaveStyle({
                    display: 'inline-block',
                    verticalAlign: 'top',
                    marginRight: '0.1em'
                })
            })
        })

        describe('default element rendering', () => {
            it('renders unknown element types as div with attributes', () => {
                const element = {
                    type: 'unknown',
                    children: []
                } as any  // Use any for unknown element types

                render(
                    <TestWrapper>
                        <Element
                            attributes={mockAttributes}
                            children={mockChildren}
                            element={element}
                        />
                    </TestWrapper>
                )

                const div = screen.getByText('Test content').closest('div')
                expect(div).toBeInTheDocument()
                expect(div).toHaveAttribute('data-slate-element', 'true')
            })
        })
    })

    describe('Leaf Component', () => {
        const mockAttributes = { 
            'data-slate-leaf': true as const,
            'data-slate-length': '11',
            ref: null
        }
        const mockChildren = <span>Leaf content</span>

        it('renders leaf content', () => {
            const leaf: CustomText = {
                text: 'test'
            }

            render(
                <TestWrapper>
                    <Leaf
                        attributes={mockAttributes}
                        children={mockChildren}
                        leaf={leaf}
                        text={leaf}  // Slate expects this for RenderLeafProps
                    />
                </TestWrapper>
            )

            expect(screen.getByText('Leaf content')).toBeInTheDocument()
        })

        it('applies correct styles to leaf content', () => {
            const leaf: CustomText = {
                text: 'test'
            }

            render(
                <TestWrapper>
                    <Leaf
                        attributes={mockAttributes}
                        children={mockChildren}
                        leaf={leaf}
                        text={leaf}  // Slate expects this for RenderLeafProps
                    />
                </TestWrapper>
            )

            // Find the content span, then check its parent for attributes
            const contentSpan = screen.getByText('Leaf content')
            const parentElement = contentSpan.closest('[data-slate-leaf]')
            expect(parentElement).toHaveAttribute('data-slate-leaf', 'true')
        })
    })
})
