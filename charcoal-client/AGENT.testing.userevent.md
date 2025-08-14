# UserEvent Testing Patterns - Development Roadmap

## Overview

**Purpose**: This document outlines the userEvent testing patterns we need to develop to support comprehensive integration testing of the `StandardRenderEditor` component and establish consistent user interaction testing across the client codebase.

**Context**: Our `StandardRenderEditor` integration tests currently have multiple TODO items that require userEvent patterns for realistic user interaction testing. This document serves as a roadmap for developing these patterns.

**Current Status**: 
- `@testing-library/user-event` v7.2.1 is installed and available
- Multiple test scenarios are commented out due to missing userEvent patterns
- No documented patterns exist for userEvent usage in our codebase

**Cross-Reference**: See [AGENT.testing.md](./AGENT.testing.md) for general testing standards and [AGENT.testing.slate.md](./AGENT.testing.slate.md) for Slate-specific testing patterns.

## Critical Discovery: JSDOM Limitations with Slate Editors

### **The Core Problem**

Recent research has revealed that our userEvent testing challenges are not due to implementation issues, but rather fundamental limitations of the JSDOM environment:

- **JSDOM Limitations**: JSDOM, used by React Testing Library and Jest/Vitest, does not fully support `contenteditable` or the `beforeinput` event that Slate heavily utilizes for its internal logic
- **Impact**: Standard `userEvent.type()` calls may not trigger the expected Slate behavior or `onChange` events
- **Result**: Tests hang/timeout because Slate's internal event handling is not properly simulated

### **What This Means for Our Testing Strategy**

1. **Direct userEvent.type() won't work reliably** with Slate editors in JSDOM
2. **We need alternative approaches** for testing Slate's core functionality
3. **Some userEvent interactions may still work** (clicking, focusing, simple interactions)
4. **We should explore specialized Slate testing tools**

### **Recommended Alternatives**

#### **1. slate-test-utils**
- **Purpose**: Utilities specifically designed for testing Slate editors with Jest, React Testing Library, and hyperscript
- **Benefits**: Better support for simulating user interactions and staging editor states
- **Integration**: Works with our existing testing setup

#### **2. Limited userEvent Usage**
- **What works**: Simple interactions like `userEvent.click()`, `userEvent.focus()`
- **What doesn't work**: Complex typing operations that depend on Slate's contenteditable logic
- **Strategy**: Use userEvent for setup/focus, test Slate behavior through other means

## Required UserEvent Testing Patterns

### **1. Basic UserEvent Setup and Configuration**

#### **Pattern Needed: Import and Setup**
```typescript
// Current TODO in tests:
// import { userEvent } from '@testing-library/user-event'
// const user = userEvent.setup()

// Pattern to develop:
import userEvent from '@testing-library/user-event'

describe('UserEvent Testing', () => {
    let user: ReturnType<typeof userEvent.setup>
    
    beforeEach(() => {
        user = userEvent.setup({
            // Configuration options for realistic user interaction simulation
            // Need to research: What options are available and recommended?
        })
    })
})
```

#### **Research Questions**
- What configuration options does userEvent.setup() provide?
- How do we configure userEvent for realistic typing speeds?
- What are the best practices for userEvent setup in our testing environment?

### **2. Text Input and Editing Workflows**

#### **Pattern Needed: Rich Text Editor Text Input**
```typescript
// Current TODO in tests:
// TODO: Implement actual text input testing when userEvent is working
// const editor = screen.getByRole('textbox')
// await user.type(editor, 'Hello world')

// Pattern to develop:
it('should handle text input and trigger onChange with debouncing', async () => {
    const user = userEvent.setup()
    const initialValue = new StandardRender([''])
    
    render(
        <TestWrapper>
            <StandardRenderEditor
                value={initialValue}
                onChange={mockOnChange}
                toolbar={false}
            />
        </TestWrapper>
    )

    const editor = screen.getByRole('textbox')
    await user.type(editor, 'Hello world')
    
    // Pattern needed: How to test debounced onChange calls
    // Pattern needed: How to advance timers for debounced operations
})
```

#### **Research Questions**
- How do we test that onChange is called with the correct value?
- How do we test debouncing behavior with vi.useFakeTimers()?
- How do we verify the editor content updates correctly?

### **3. Complex User Interaction Sequences**

#### **Pattern Needed: Link Creation Workflow**
```typescript
// Current TODO in tests:
// TODO: Implement actual link creation testing when userEvent is working

// Pattern to develop:
it('should handle link creation workflow', async () => {
    const user = userEvent.setup()
    const initialValue = new StandardRender(['Plain text'])
    
    render(
        <TestWrapper>
            <StandardRenderEditor
                value={initialValue}
                onChange={mockOnChange}
                toolbar={true}
                validLinkTags={['Feature', 'Knowledge']}
            />
        </TestWrapper>
    )

    // Pattern needed: How to test selecting text
    // Pattern needed: How to test clicking toolbar buttons
    // Pattern needed: How to test dialog interactions
    // Pattern needed: How to test form submissions
})
```

#### **Research Questions**
- How do we simulate text selection in Slate editors?
- How do we test clicking Material-UI toolbar buttons?
- How do we test dialog open/close interactions?
- How do we test form submission and validation?

### **4. Performance and Stability Testing**

#### **Pattern Needed: Rapid User Interactions**
```typescript
// Current TODO in tests:
// TODO: Implement actual performance testing when userEvent is working

// Pattern to develop:
it('should handle rapid text changes without errors', async () => {
    const user = userEvent.setup()
    const initialValue = new StandardRender([''])
    
    render(
        <TestWrapper>
            <StandardRenderEditor
                value={initialValue}
                onChange={mockOnChange}
                toolbar={false}
            />
        </TestWrapper>
    )

    const editor = screen.getByRole('textbox')
    
    // Pattern needed: How to simulate rapid typing
    // Pattern needed: How to test editor state stability
    // Pattern needed: How to verify no errors occur during rapid changes
})
```

#### **Research Questions**
- How do we simulate realistic rapid typing patterns?
- How do we verify editor state remains stable during rapid changes?
- How do we catch and test for errors during performance stress tests?

### **5. Readonly Mode User Interaction Testing**

#### **Pattern Needed: Readonly Behavior Verification**
```typescript
// Current TODO in tests:
// TODO: Implement actual readonly testing when userEvent is working

// Pattern to develop:
it('should not trigger onChange in readonly mode', async () => {
    const user = userEvent.setup()
    mockUseLibraryAsset.mockReturnValue({
        standardForm: mockStandardForm,
        readonly: true
    })
    
    const initialValue = new StandardRender(['Initial'])
    
    render(
        <TestWrapper>
            <StandardRenderEditor
                value={initialValue}
                onChange={mockOnChange}
                toolbar={false}
            />
        </TestWrapper>
    )

    const editor = document.querySelector('[data-slate-editor="true"]')
    expect(editor).toHaveAttribute('contenteditable', 'false')
    
    // Pattern needed: How to verify readonly behavior
    // Pattern needed: How to test that user interactions are blocked
})
```

#### **Research Questions**
- How do we verify that readonly mode actually prevents user interactions?
- How do we test that onChange is not called in readonly mode?
- How do we test that the editor remains visually consistent in readonly mode?

## Integration Test Context Requirements

### **Redux Store Integration**

#### **Pattern Needed: Minimal Reducer Configuration**
```typescript
// Current implementation in tests:
const store = configureStore({
    reducer: {
        // Add minimal reducers for testing
        personalAssets: (state = {}) => state,
        player: (state = {}) => state,
    }
})

// Pattern to develop: What minimal reducers are actually required?
// Research needed: What Redux state does StandardRenderEditor actually depend on?
```

#### **Research Questions**
- What Redux state does StandardRenderEditor actually read from?
- What actions does it dispatch?
- Can we create more realistic mock state for testing?

### **Slate Editor Integration**

#### **Pattern Needed: Slate-Specific User Interactions**
```typescript
// Pattern needed: How to test Slate editor components with userEvent
// Pattern needed: How to verify Slate editor state changes
// Pattern needed: How to test Slate-specific user interactions

// Research needed:
// - How do Slate editors handle userEvent interactions?
// - How do we verify Slate's internal state changes?
// - How do we test Slate-specific features like link insertion?
```

#### **Research Questions**
- How does userEvent interact with Slate's contenteditable implementation?
- How do we verify that Slate's internal value changes correctly?
- How do we test Slate-specific features like link insertion and formatting?

### **Debounced Operations Testing**

#### **Pattern Needed: Timer and Debouncing Testing**
```typescript
// Current implementation in tests:
beforeEach(() => {
    // Reset timers for debounced operations
    vi.useFakeTimers()
})

afterEach(() => {
    vi.useRealTimers()
})

// Pattern needed: How to test debounced onChange calls
// Pattern needed: How to advance timers for debounced operations
// Pattern needed: How to verify debouncing behavior
```

#### **Research Questions**
- How do we properly test debounced operations with userEvent?
- How do we advance timers to trigger debounced callbacks?
- How do we verify that rapid changes are properly debounced?

## Timer and Async Testing Patterns

### **Pattern Needed: Fake Timers with UserEvent**
```typescript
// Pattern needed: How to use vi.useFakeTimers() with userEvent
// Pattern needed: How to advance timers for debounced operations
// Pattern needed: How to clean up timers between tests

// Research needed:
// - How do fake timers interact with userEvent?
// - What's the proper sequence for timer advancement?
// - How do we avoid timer conflicts between tests?
```

### **Research Questions**
- Do fake timers work correctly with userEvent's async operations?
- What's the proper sequence for setting up, using, and cleaning up fake timers?
- How do we avoid timer state bleeding between tests?

## Revised Implementation Priority (Post-JSDOM Discovery)

### **Phase 1: Investigate slate-test-utils**
1. **Research**: Evaluate slate-test-utils for Slate-specific testing
2. **Integration**: Test integration with our existing Vitest setup
3. **Documentation**: Document working patterns for Slate editor testing

### **Phase 2: Limited userEvent Testing**
1. **Identify**: What userEvent operations work with Slate in JSDOM
2. **Develop**: Patterns for simple interactions (click, focus, etc.)
3. **Test**: Basic setup and focus testing

### **Phase 3: Alternative Testing Approaches**
1. **Research**: Direct Slate API testing approaches
2. **Develop**: State-based testing patterns
3. **Test**: Editor behavior verification without userEvent

### **Phase 4: Hybrid Testing Strategy**
1. **Combine**: Working userEvent patterns + Slate-specific testing
2. **Develop**: Comprehensive testing coverage
3. **Document**: Complete testing patterns

### **Phase 5: Performance and Edge Cases**
1. **Implement**: Performance testing using alternative approaches
2. **Develop**: Edge case testing patterns
3. **Test**: Complete integration test coverage

## Research Resources

### **Official Documentation**
- [@testing-library/user-event Documentation](https://testing-library.com/docs/user-event/intro)
- [Vitest Timer Mocking Documentation](https://vitest.dev/guide/mocking.html#timers)
- [React Testing Library Async Testing](https://testing-library.com/docs/dom-testing-library/api-async)

### **Slate-Specific Testing Resources**
- **slate-test-utils**: Library for testing Slate editors with Jest/React Testing Library
- **Slate Testing Documentation**: Official Slate testing patterns and examples
- **Community Solutions**: GitHub issues and discussions about Slate testing

### **Community Resources**
- Testing Library Discord community
- React Testing Library GitHub discussions
- Vitest GitHub issues and discussions
- Slate GitHub discussions and issues

### **Related Code Examples**
- StandardRenderEditor component implementation
- Existing Slate editor test patterns
- Redux integration patterns in other components

## Success Criteria

### **Pattern Completeness**
- All TODO items in StandardRenderEditor tests can be implemented
- Testing patterns are documented and reusable (whether userEvent or alternative)
- Integration tests provide comprehensive coverage of user interactions

### **Code Quality**
- Tests are reliable and don't flake
- Performance testing catches real issues
- Patterns follow established testing standards

### **Documentation Quality**
- Patterns are well-documented with examples
- Common pitfalls and solutions are documented
- Integration with existing testing standards is clear
- JSDOM limitations and workarounds are clearly explained

---

**Note**: This document serves as a development roadmap. As we research and implement each pattern, we should update this document with the actual working patterns and remove the "Pattern needed" placeholders. The goal is to create a comprehensive guide for testing Slate editors that can be used across the entire client codebase.

**Critical Update**: The discovery of JSDOM limitations with Slate editors has fundamentally changed our approach. We now need to focus on alternative testing strategies rather than trying to force userEvent to work with contenteditable limitations.
