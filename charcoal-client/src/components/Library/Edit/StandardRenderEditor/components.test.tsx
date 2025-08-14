/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { vi, beforeEach, describe, it, expect } from 'vitest'
import '@testing-library/jest-dom'
import { createEditor, Node, Element as SlateElement, Transforms } from 'slate'
import { Slate, withReact } from 'slate-react'
import { Element, Leaf, withParagraphBR, decorateFactory } from './components'
import { CustomParagraphElement, CustomText, CustomFeatureLinkElement, CustomKnowledgeLinkElement } from '../baseClasses'

// Mock the DescriptionLinkFeatureChip component
vi.mock('../../../Message/DescriptionLink', () => ({
    DescriptionLinkFeatureChip: ({ children, tooltipTitle }: { children: React.ReactNode, tooltipTitle: string }) => (
        <span data-testid="description-link-chip" title={tooltipTitle}>
            {children}
        </span>
    )
}))

// Mock the InlineChromiumBugfix component
vi.mock('../../../../lib/slateUtils', () => ({
    default: () => <span data-testid="inline-chromium-bugfix" />
}))

// Test wrapper with Material-UI theme and Slate editor
const TestWrapper: React.FC<{ children: React.ReactNode, value?: any[] }> = ({ children, value = [] }) => {
    const theme = createTheme()
    const editor = withReact(createEditor())
    
    return (
        <ThemeProvider theme={theme}>
            <Slate editor={editor} value={value}>
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
            it('renders paragraph without BR when no BR flags are set', () => {
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

            it('renders paragraph with explicit BR when explicitBR is true', () => {
                const element: CustomParagraphElement = {
                    type: 'paragraph',
                    explicitBR: true,
                    softBR: false,
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

                // Check for KeyboardReturnIcon (explicit BR)
                const returnIcon = screen.getByTestId('KeyboardReturnIcon')
                expect(returnIcon).toBeInTheDocument()
                
                // Check for BR element
                const brElement = document.querySelector('br')
                expect(brElement).toBeInTheDocument()
            })

            it('renders paragraph with soft BR when softBR is true and explicitBR is false', () => {
                const element: CustomParagraphElement = {
                    type: 'paragraph',
                    explicitBR: false,
                    softBR: true,
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

                // Check for MoreIcon (soft BR)
                const moreIcon = screen.getByTestId('MoreIcon')
                expect(moreIcon).toBeInTheDocument()
                
                // Check for BR element
                const brElement = document.querySelector('br')
                expect(brElement).toBeInTheDocument()
            })

            it('renders paragraph with only explicit BR when both flags are true (explicit takes precedence)', () => {
                const element: CustomParagraphElement = {
                    type: 'paragraph',
                    explicitBR: true,
                    softBR: true,
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

                // When both are true, only explicit BR icon should show
                const returnIcon = screen.getByTestId('KeyboardReturnIcon')
                expect(returnIcon).toBeInTheDocument()
                
                // MoreIcon should not be visible because of the condition: (element.softBR && !element.explicitBR)
                const moreIcon = screen.queryByTestId('MoreIcon')
                expect(moreIcon).not.toBeInTheDocument()
                
                // Check for BR element
                const brElement = document.querySelector('br')
                expect(brElement).toBeInTheDocument()
            })

            it('renders paragraph with only explicit BR when both flags are true (explicit takes precedence)', () => {
                const element: CustomParagraphElement = {
                    type: 'paragraph',
                    explicitBR: true,
                    softBR: true,
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

                // When both are true, only explicit BR icon should show
                const returnIcon = screen.getByTestId('KeyboardReturnIcon')
                expect(returnIcon).toBeInTheDocument()
                
                // MoreIcon should not be visible because of the condition: (element.softBR && !element.explicitBR)
                const moreIcon = screen.queryByTestId('MoreIcon')
                expect(moreIcon).not.toBeInTheDocument()
                
                // Check for BR element
                const brElement = document.querySelector('br')
                expect(brElement).toBeInTheDocument()
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

        it('renders leaf without highlight when highlight is false', () => {
            const leaf: CustomText = {
                text: 'test',
                highlight: false
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

            // Should not have highlight box
            const highlightBox = screen.queryByTestId('highlight-box')
            expect(highlightBox).not.toBeInTheDocument()
            
            // Should render content
            expect(screen.getByText('Leaf content')).toBeInTheDocument()
        })

        it('renders leaf with highlight when highlight is true', () => {
            const leaf: CustomText = {
                text: 'test',
                highlight: true
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

            // Should have highlight box (check for space character content)
            const highlightBox = screen.getByText((content, element) => {
                return element?.textContent === ' ' || element?.textContent === '\u00A0'
            })
            expect(highlightBox).toBeInTheDocument()
            
            // Should render content
            expect(screen.getByText('Leaf content')).toBeInTheDocument()
        })

        it('applies correct styles to leaf content', () => {
            const leaf: CustomText = {
                text: 'test',
                highlight: false
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

    describe('withParagraphBR Plugin', () => {
        it('applies paragraph BR normalization to editor', () => {
            const editor = withReact(createEditor())
            const originalNormalizeNode = editor.normalizeNode
            
            const enhancedEditor = withParagraphBR(editor)
            
            expect(enhancedEditor.normalizeNode).not.toBe(originalNormalizeNode)
            expect(typeof enhancedEditor.normalizeNode).toBe('function')
        })

        it('returns the enhanced editor', () => {
            const editor = withReact(createEditor())
            const enhancedEditor = withParagraphBR(editor)
            
            expect(enhancedEditor).toBe(editor)
        })
    })

    describe('decorateFactory Function', () => {
        it('returns empty array for non-paragraph elements', () => {
            const editor = withReact(createEditor())
            const decorate = decorateFactory(editor)
            
            // Create a valid Slate text node
            const nonParagraphNode = { 
                text: 'test content'
            }
            const result = decorate([nonParagraphNode, [0]])
            
            expect(result).toEqual([])
        })

        it('returns empty array for paragraph elements without children', () => {
            const editor = withReact(createEditor())
            const decorate = decorateFactory(editor)
            
            // Create a valid CustomParagraphElement that matches our baseClasses
            const paragraphNode: CustomParagraphElement = { 
                type: 'paragraph', 
                children: [] 
            }
            const result = decorate([paragraphNode, [0]])
            
            expect(result).toEqual([])
        })

        it('creates decorators for leading spaces in paragraph content', () => {
            const editor = withReact(createEditor())
            const decorate = decorateFactory(editor)
            
            // Create a valid CustomParagraphElement with text children that match isCustomText expectations
            const paragraphNode: CustomParagraphElement = {
                type: 'paragraph',
                children: [
                    { text: ' leading space' }  // No type property - isCustomText expects this
                ]
            }
            const result = decorate([paragraphNode, [0]])
            
            expect(result).toHaveLength(1)
            expect(result[0]).toHaveProperty('highlight', true)
            expect(result[0]).toHaveProperty('anchor')
            expect(result[0]).toHaveProperty('focus')
        })

        it('creates decorators for trailing spaces in paragraph content', () => {
            const editor = withReact(createEditor())
            const decorate = decorateFactory(editor)
            
            // Create a valid CustomParagraphElement with text children that match isCustomText expectations
            const paragraphNode: CustomParagraphElement = {
                type: 'paragraph',
                children: [
                    { text: 'trailing space ' }  // No type property - isCustomText expects this
                ]
            }
            const result = decorate([paragraphNode, [0]])
            
            expect(result).toHaveLength(1)
            expect(result[0]).toHaveProperty('highlight', true)
            expect(result[0]).toHaveProperty('anchor')
            expect(result[0]).toHaveProperty('focus')
        })

        it('creates decorators for both leading and trailing spaces', () => {
            const editor = withReact(createEditor())
            const decorate = decorateFactory(editor)
            
            // Create a valid CustomParagraphElement with text children that match isCustomText expectations
            const paragraphNode: CustomParagraphElement = {
                type: 'paragraph',
                children: [
                    { text: ' both spaces ' }  // No type property - isCustomText expects this
                ]
            }
            const result = decorate([paragraphNode, [0]])
            
            expect(result).toHaveLength(2)
            expect(result.every(decorator => decorator.highlight)).toBe(true)
        })
    })
})
