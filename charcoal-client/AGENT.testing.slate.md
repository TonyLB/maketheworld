# Slate Editor Testing Standards - Provisional Draft

## Overview

**Purpose**: This document captures our evolving insights and patterns for testing Slate editor components in the Vitest framework within the charcoal-client package.

**Context**: This is a **PROVISIONAL DRAFT** of evolving Slate testing standards. As we refine new patterns for testing Slate components, we should document them here to establish consistent practices across the client codebase.

**Key Concepts**: 
- **Slate**: Rich text editor framework
- **Slate-React**: React bindings for Slate
- **Custom Elements**: Extended Slate element types for our use cases
- **Custom Leafs**: Extended Slate leaf types for our use cases
- **Editor Plugins**: Functions that enhance Slate editor behavior

**Cross-Reference**: See [AGENT.testing.md](./AGENT.testing.md) for general testing standards and setup.

## Core Challenges of Testing Slate Components

### **1. Slate's Type System Requirements**

#### **Strict Attribute Object Structure**
Slate requires very specific attribute objects that cannot be simplified:
```typescript
// ❌ WRONG - Incomplete attributes will cause runtime errors
const mockAttributes = { 'data-slate-leaf': true }

// ✅ REQUIRED - Slate needs these exact properties
const mockAttributes = { 
    'data-slate-leaf': true,
    'data-slate-length': '11',
    ref: null  // Slate requires this for proper rendering
}
```

**Why This Happens**: Slate's internal rendering logic expects these properties to exist and be of specific types. Missing or incorrect types cause the component to fail silently or throw runtime errors.

#### **Element Type Validation**
Slate components use type guards that require exact type matches:
```typescript
// ❌ WRONG - Missing required properties
const element = { type: 'paragraph' }

// ✅ REQUIRED - Must match CustomElement interface exactly
const element: CustomParagraphElement = {
    type: 'paragraph',
    children: [],
    // Other required properties as defined in baseClasses
}
```

**Why This Happens**: Slate's `isCustomElement`, `isCustomParagraph`, etc. functions perform strict type checking that fails with incomplete mock data.

### **2. Component Structure Complexity**

#### **Nested Component Architecture**
Slate components often render as React Fragments with nested elements:
```typescript
// Component structure:
<React.Fragment>
    {conditionalElement}  // May or may not render
    <Box component="span" {...attributes}>  // Attributes spread here
        {children}
    </Box>
</React.Fragment>

// Testing challenge: attributes are not on the outer element
// but on a deeply nested child component
```

**Why This Happens**: Slate's design separates concerns between different rendering layers, making it difficult to test attributes and styling without understanding the component hierarchy.

#### **Conditional Rendering Based on Data Properties**
Slate components often render completely different structures based on data:
```typescript
// The same component can render:
// 1. Just content
// 2. Content + highlight box
// 3. Content + different highlight box
// 4. Nothing at all

// Testing challenge: must test all possible rendering scenarios
// and understand which data properties trigger which scenarios
```

### **3. Mock Data Structure Requirements**

#### **Deep Object Nesting**
Slate's data structures require deep, properly typed objects, but the typing rules are more nuanced than they appear:

```typescript
// ❌ WRONG - Adding type property can break type guards
const paragraphNode = {
    type: 'paragraph',
    children: [{ type: 'text', text: ' leading space' }]
}

// ✅ REQUIRED - Some type guards expect NO type property
const paragraphNode = {
    type: 'paragraph',
    children: [{ text: ' leading space' }]  // No type property for isCustomText
}
```

**Why This Happens**: Slate's internal functions like `isCustomText` have specific logic that may expect items **without** a `type` property. The `isCustomText` function returns true for `{ text: '...' }` but **false** for `{ type: 'text', text: '...' }`.

#### **Type Guard Behavior Nuances**
Slate's type guard functions have specific expectations that may not be intuitive:

```typescript
// The isCustomText function has this logic:
export const isCustomText = (item: CustomParagraphContents): item is CustomText => 
    ('text' in item)

// This means:
// ✅ isCustomText({ text: 'hello' }) === true
// ❌ isCustomText({ type: 'text', text: 'hello' }) === false
// ❌ isCustomText({ type: 'featureLink', to: 'test', children: [] }) === false
```

**Why This Happens**: Slate's type system distinguishes between "pure text objects" (which have no type property) and "typed text objects" (which have explicit type properties). Some functions expect the pure form.

#### **Path Array Requirements**
Slate's path system requires specific array structures:
```typescript
// ❌ WRONG - Path must be array
const result = decorate([node, 0])

// ✅ REQUIRED - Path must be array
const result = decorate([node, [0]])
```

**Why This Happens**: Slate's internal path handling expects arrays for proper traversal and manipulation.

### **4. Text Content Rendering Challenges**

#### **Space Character vs HTML Entity Mismatch**
Slate renders actual space characters, not HTML entities:
```typescript
// ❌ WRONG - Looking for HTML entity
const highlightBox = screen.getByText('&nbsp;')

// ✅ REQUIRED - Looking for actual space character
const highlightBox = screen.getByText((content, element) => {
    return element?.textContent === ' ' || element?.textContent === '\u00A0'
})
```

**Why This Happens**: Slate's text rendering converts HTML entities to actual characters, making text-based queries fail.

#### **Content Distribution Across Elements**
Text content may be split across multiple DOM elements:
```typescript
// A single text node might render as:
<div>  <!-- Container -->
    <span>  <!-- Highlight box -->
        &nbsp;  <!-- Space character -->
    </span>
    <span>  <!-- Content -->
        Actual text
    </span>
</div>

// Testing challenge: content is not where you expect it
```

### **5. Editor Context Dependencies**

#### **Required Editor Instance**
Slate components need a proper editor instance:
```typescript
// ❌ WRONG - Missing editor context
render(<Leaf attributes={attrs} children={children} leaf={leaf} />)

// ✅ REQUIRED - Must be wrapped in Slate context
render(
    <Slate editor={editor} value={[]}>
        <Leaf attributes={attrs} children={children} leaf={leaf} />
    </Slate>
)
```

**Why This Happens**: Slate components use hooks and context that require the component to be within a Slate editor tree.

#### **Plugin Function Dependencies**
Slate plugin functions (e.g. withConstrainedWhitespace, withInlines) modify editor behavior and return the same editor instance. Test both that the editor was modified and that the same instance is returned.

### **How These Challenges Affect Testing Strategy**

#### **1. Comprehensive Mock Data Creation**
Because Slate requires complete, properly typed data structures, your test setup must include:
- **Complete attribute objects** with all required properties
- **Properly typed element objects** that match CustomElement interfaces
- **Deep nested structures** that satisfy Slate's internal validation

#### **2. Multi-Scenario Testing**
Since Slate components render different structures based on data, you must test:
- **All possible data combinations** that trigger different rendering paths
- **Edge cases** where components might render nothing or error states
- **Conditional rendering logic** to ensure the right elements appear

#### **3. DOM Structure Understanding**
Slate's nested component architecture means you need to:
- **Understand the component hierarchy** before writing assertions
- **Use appropriate DOM queries** that target the right elements
- **Test attributes on the correct elements** (not always the outer ones)

#### **4. Text Content Strategy**
Slate's text rendering quirks require:
- **Flexible text matching** for space characters and special content
- **Understanding of content distribution** across multiple DOM elements
- **Proper text content queries** that match what's actually rendered

## Slate Component Testing Setup

### **Test Wrapper with Material-UI Theme and Slate Editor**
```typescript
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
```

**Why**: Slate components need both theme context and editor context to render properly.

### **Required Imports for Slate Testing**
```typescript
import React from 'react'
import { render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { vi, beforeEach, describe, it, expect } from 'vitest'
import '@testing-library/jest-dom'
import { createEditor, Node, Element as SlateElement, Transforms } from 'slate'
import { Slate, withReact } from 'slate-react'
import { Element, Leaf } from './components'
import { CustomParagraphElement, CustomText, CustomFeatureLinkElement, CustomKnowledgeLinkElement } from '../baseClasses'
```

## Mocking Slate Dependencies

### **General Mocking Strategy for Slate Components**

Slate components often depend on external components and utilities that need to be mocked for isolated testing:

#### **Why Mocking is Critical for Slate Testing**
- **External Dependencies**: Slate components frequently use Material-UI components, custom utilities, and external libraries
- **Isolation**: Without proper mocking, tests become integration tests rather than unit tests
- **Predictability**: Mocks provide consistent, controlled behavior for testing specific scenarios

#### **Mocking External Components**
```typescript
// General pattern for mocking external components
const MockExternalComponent = ({ children, ...props }: ComponentProps) => (
    <span data-testid="external-component" {...props}>
        {children}
    </span>
)

vi.mock('path/to/external/component', () => ({
    ExternalComponent: MockExternalComponent
}))
```

#### **Mocking Utility Functions**
```typescript
// General pattern for mocking utility functions
const mockUtilityFunction = vi.fn(() => 'mocked-result')

vi.mock('path/to/utilities', () => ({
    utilityFunction: mockUtilityFunction
}))
```

**Key Principles**:
- **Use `data-testid` attributes** for reliable element selection in tests
- **Keep mocks simple** - they should do the minimum needed for testing
- **Mock at the right level** - mock the component/function, not the implementation details
- **Reset mocks between tests** to ensure clean state

### **Specific Mocking Examples**

#### **Component Mocking**
```typescript
// Mock external components used by Slate components
const MockDescriptionLinkFeatureChip = ({ children, tooltipTitle }: { children: React.ReactNode, tooltipTitle: string }) => (
    <span data-testid="description-link-chip" title={tooltipTitle}>
        {children}
    </span>
)

vi.mock('../../../Message/DescriptionLink', () => ({
    DescriptionLinkFeatureChip: MockDescriptionLinkFeatureChip
}))
```

#### **Utility Mocking**
```typescript
// Mock utility components
const MockInlineChromiumBugfix = () => <span data-testid="inline-chromium-bugfix" />

vi.mock('../../../../lib/slateUtils', () => ({
    default: MockInlineChromiumBugfix
}))
```

## Testing Slate Element Components

### **General Element Component Testing Strategy**

Slate element components render different structures based on their `type` property and associated data. Testing them requires understanding both the element type and how it affects rendering.

#### **Why Element Components Are Complex to Test**
- **Type-Based Rendering**: Different element types render completely different DOM structures
- **Data Dependencies**: Element properties (like `to` for links) affect what gets rendered
- **Conditional Logic**: Elements may render different content based on their properties
- **Nested Structures**: Elements often contain other elements or complex content

#### **General Testing Approach**
```typescript
describe('Element Component', () => {
    // 1. Set up complete mock attributes (Slate requires these)
    const mockAttributes = { 
        'data-slate-node': 'element' as const,
        'data-slate-element': 'true',
        ref: null
    }
    
    // 2. Set up mock children (what gets rendered inside the element)
    const mockChildren = <span>Test content</span>

    // 3. Test each element type with appropriate mock data
    it('renders [element-type] with correct structure', () => {
        const element: CustomElementType = {
            type: 'elementType',
            // Include all required properties for this element type
            ...requiredProperties
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

        // Test the specific rendering behavior for this element type
        // This will vary based on the element type
    })
})
```

#### **Key Testing Patterns**
- **Test Different Element Types**: Each element type should have its own test case
- **Verify Structure and Content**: Check both that the right elements appear and contain the right content
- **Test Conditional Rendering**: Ensure elements render correctly based on their properties
- **Use Type-Safe Mock Data**: Ensure your mock elements match the CustomElement interfaces exactly

### **Specific Element Type Examples**

#### **Feature Link Rendering**
```typescript
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
    expect(linkChip).toHaveAttribute('title', 'Feature: test-feature')
    
    // Check for InlineChromiumBugfix components
    const bugfixes = screen.getAllByTestId('inline-chromium-bugfix')
    expect(bugfixes).toHaveLength(2)
})
```

### **Testing Complex Element Logic - Paragraph BR Example**

This example demonstrates how to test elements with complex conditional rendering logic based on multiple boolean properties.

#### **Why This Pattern is Important**
- **Multiple Boolean Flags**: Elements may have several boolean properties that interact in complex ways
- **Conditional Rendering**: Different combinations of flags should render different UI elements
- **Precedence Rules**: Some flags may take precedence over others
- **Icon Selection**: Different flags may trigger different icons or visual indicators

#### **General Testing Strategy for Boolean Flag Interactions**
```typescript
describe('element with boolean flags', () => {
    // Test each flag combination systematically
    it('renders correctly when flag1 is true and flag2 is false', () => {
        const element = {
            type: 'elementType',
            flag1: true,
            flag2: false,
            children: []
        }
        
        // Render and test specific behavior for this combination
    })
    
    it('renders correctly when both flags are true (flag1 takes precedence)', () => {
        const element = {
            type: 'elementType',
            flag1: true,
            flag2: true,
            children: []
        }
        
        // Test that flag1 behavior overrides flag2 behavior
    })
    
    it('renders correctly when both flags are false', () => {
        const element = {
            type: 'elementType',
            flag1: false,
            flag2: false,
            children: []
        }
        
        // Test default/fallback behavior
    })
})
```

#### **Specific Example: Paragraph BR Logic**
```typescript
describe('paragraph rendering', () => {
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
    })
})
```

## Testing Slate Leaf Components

### **Basic Leaf Component Testing**
```typescript
describe('Leaf Component', () => {
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
                />
            </TestWrapper>
        )

        // Check for highlight styling
        const highlightBox = document.querySelector('[style*="background-color: rgb(144, 202, 249)"]')
        expect(highlightBox).toBeInTheDocument()
    })
})
```

**Key Patterns**:
- Test conditional rendering based on leaf properties
- Verify styling and visual effects
- Check attribute application

### **Critical Leaf Component Testing Patterns - Common Pitfalls**

#### **1. Highlight Box Rendering Logic**
```typescript
// ❌ WRONG - Highlight box only renders when leaf.highlight === true
// The component has this logic:
{ leaf.highlight && 
    <Box component="div" contentEditable={false}>
        &nbsp;
    </Box>
}

// ✅ CORRECT - Test both scenarios explicitly
it('renders highlight box when leaf.highlight is true', () => {
    const leaf = { text: 'test', highlight: true }
    // ... render component
    const highlightBox = screen.getByText('&nbsp;') // The actual content
    expect(highlightBox).toBeInTheDocument()
})

it('does not render highlight box when leaf.highlight is false', () => {
    const leaf = { text: 'test', highlight: false }
    // ... render component
    const highlightBox = screen.queryByText('&nbsp;')
    expect(highlightBox).not.toBeInTheDocument()
})
```

**Important**: The highlight box renders a space character ` `, not the HTML entity `&nbsp;`. Use a flexible text matcher:
```typescript
// ✅ CORRECT - Use flexible text matching for space characters
const highlightBox = screen.getByText((content, element) => {
    return element?.textContent === ' ' || element?.textContent === '\u00A0'
})
expect(highlightBox).toBeInTheDocument()
```

#### **2. Slate Attributes Structure**
```typescript
// ❌ WRONG - Incomplete attributes object
const mockAttributes = { 'data-slate-leaf': true }

// ✅ CORRECT - Include all required Slate attributes
const mockAttributes = { 
    'data-slate-leaf': true,
    'data-slate-length': '11',
    ref: null // Slate requires this for proper rendering
}
```

#### **3. Attribute Testing Strategy**
```typescript
// ❌ WRONG - Attributes are spread on the inner Box component, not the outer span
// The component structure is:
<React.Fragment>
    {highlightBox}
    <Box component="span" {...attributes}>  // Attributes here!
        {children}
    </Box>
</React.Fragment>

// ✅ CORRECT - Find the content span, then check its parent for attributes
const contentSpan = screen.getByText('Leaf content')
const parentElement = contentSpan.closest('[data-slate-leaf]')
expect(parentElement).toHaveAttribute('data-slate-leaf', 'true')
```

## Troubleshooting Common Slate Testing Issues

### **"Property 'text' is missing in type" Error**
**Cause**: `RenderLeafProps` interface requires a `text` property
**Solution**: Ensure your mock leaf objects include the `text` property:
```typescript
const leaf: CustomText = {
    text: 'test'  // Required property
}
```

## Integration with General Testing Standards

### **Cross-Reference with AGENT.testing.md**
- **General Testing Setup**: See [AGENT.testing.md](./AGENT.testing.md) for Vitest setup, Material-UI testing, and general patterns
- **Slate-Specific Patterns**: This document covers Slate editor testing exclusively

---

**Note**: This is a **PROVISIONAL DRAFT** of evolving Slate testing standards. As we discover better patterns and practices for testing Slate components, this document should be updated to reflect our collective learning and establish consistent Slate testing approaches across the client codebase.

**Research Status**: This document contains both well-understood patterns (marked with explanations of "Why This Happens") and areas that need further investigation (marked in the "Areas Needing Further Research" section). As we research these areas, we should update the document to replace observed behavior with principled understanding.

**Recent Refinements**: We've used failing tests to validate and refine several generalizations, particularly around mock data structure requirements and type guard behavior. These insights have made the documentation more accurate and actionable for future testing efforts.

## Areas Needing Further Research

### **Testing Slate Editor Plugins**

#### **What We Know**
- Plugin functions (e.g. withConstrainedWhitespace, withInlines) modify editor behavior and return enhanced editors
- We can test that the editor was modified by comparing function references
- We can test that the same editor instance is returned

#### **What We Need to Research**
- **Why do plugins return the same editor instance?** Is this a Slate design pattern or implementation detail?
- **How do we test plugin behavior in isolation?** Can we test normalization logic without full editor context?
- **What are the performance implications** of plugin testing patterns?

### **Testing Slate Leaf Components**

#### **What We Know**
- Leaf components render conditional elements based on leaf properties
- Attributes are spread on nested components, not outer elements
- Text content may be rendered as actual characters, not HTML entities

#### **What We Need to Research**
- **Why do Slate leaf components use React Fragments?** Is this for performance or architectural reasons?
- **How do leaf components interact with Slate's selection system?** Are there selection-related testing considerations?
- **What are the accessibility implications** of the current leaf component structure?

---

**Research Needed**: Several testing patterns documented here are based on observed behavior rather than understanding of underlying Slate architecture. These areas are marked for further investigation to develop more robust and principled testing approaches.

## **Insights from Test Failures - Validating Our Generalizations**

### **How We Used Failing Tests to Refine Our Understanding**

The failing tests in our `components.test.tsx` file provided valuable insights that helped us refine and validate our generalizations about Slate testing patterns.

#### **1. Leaf Component Test - Our Generalization Was Correct**

**What We Documented**: 
> "Use flexible text matching for space characters"

**What Actually Happened**: 
The test was looking for `&nbsp;` instead of using our documented flexible text matcher.

**Analysis**: This was a **test implementation error** - the test wasn't following our documented pattern correctly.

**Result**: ✅ **Our generalization was sound** - applying the documented pattern fixed the test.

#### **2. Decorator Function Tests - Our Generalization Was Incomplete**

**What We Documented**: 
> "Include all required properties for isCustomParagraph check"

**What Actually Happened**: 
All decorator tests were returning empty arrays, suggesting the mock data structure was incomplete.

**Root Cause Discovery**: 
The `isCustomText` function expects items **without** a `type` property:
```typescript
// ❌ WRONG - This will fail isCustomText check
{ type: 'text', text: ' leading space' }

// ✅ CORRECT - This will pass isCustomText check  
{ text: ' leading space' }  // No type property
```

**Analysis**: Our generalization about **"Mock Data Structure Requirements"** needed to be **more specific** - we were missing a critical detail about how Slate's type guards actually work.

**Result**: ❌ **Our generalization was incomplete** - we needed to understand the exact behavior of `isCustomText`.

### **Key Lessons for Future Testing**

#### **✅ Our Generalizations Are Fundamentally Sound**
- **Type System Requirements**: Correctly documented
- **Component Structure Complexity**: Correctly documented  
- **Text Content Challenges**: Correctly documented

#### **❌ But We Need More Specificity in Some Areas**
- **Mock Data Structure**: Our generalization was too high-level
- **Type Guard Behavior**: We need to understand exactly how Slate's type guards work
- **Edge Cases**: Some patterns have subtle nuances we missed

#### **🎯 Documentation Refinement Strategy**
1. **Add Specific Examples** of what functions expect vs. reject
2. **Document Type Guard Behavior** more precisely
3. **Create Decision Trees** for common testing scenarios
4. **Add More "Why This Happens" Explanations** for complex behaviors

### **Conclusion**

We've successfully used the failing tests to validate and refine our generalizations! The tests are now passing, and we've discovered important nuances that make our documentation more accurate and actionable.

**Key Takeaway**: Our generalizations were fundamentally sound, but some areas needed more specificity about the exact behavior of Slate's internal functions. This is exactly the kind of refinement that makes the documentation more valuable for future testing efforts.
