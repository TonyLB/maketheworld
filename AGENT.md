# Make The World - AI Navigation Guide

## Quick Reference (Common Agent Failures)
- **Client testing**: `npm test` (watch) or `npm run test:single` (single run; in `charcoal-client/`)
- **Package testing**: `npm run test` (watch) or `npm run test -- --watchAll=false` (single run)
- **Detailed testing procedures**: See below for comprehensive testing patterns and examples

---

## Project Overview

Make The World is a collaborative world-building platform that enables users to create, share, and interact with rich narrative environments. The system uses a custom World Markup Language (WML) for data representation and provides real-time interaction through a microservices architecture.

### Core Architecture
- **WML System**: Custom markup language for world data representation
- **Ephemera System**: Real-time game state and character interactions
- **Asset System**: Content management and version control
- **Client System**: React-based frontend for user interaction
- **Lambda Functions**: AWS serverless backend services

## Documentation Standards

This project uses `AGENT.md` files as the primary documentation format for AI assistants and human collaborators. These files follow established patterns to ensure consistency and navigability.

### **AGENT.md File Structure**

Each `AGENT.md` file should include these standard sections:

#### **1. Overview**
- **Purpose**: Clear description of what the system/component does
- **Context**: How it fits into the broader architecture
- **Key Concepts**: Essential terminology and concepts

#### **2. Core Purpose**
- **Primary Function**: What the system is designed to accomplish
- **Key Responsibilities**: Main tasks and operations

#### **3. Technical Details**
- **Data Structures**: Key types, interfaces, and data formats
- **Core Methods**: Essential functions and their usage
- **Configuration**: Important settings and parameters

#### **4. Integration Points**
- **Dependencies**: What other systems this component relies on
- **Cross-References**: Links to related `AGENT.md` files
- **API Contracts**: How other systems interact with this component
- **System Relationships**: How this component fits into the broader architecture

#### **5. Usage Patterns**
- **Common Scenarios**: Typical use cases with code examples
- **Best Practices**: Recommended approaches and patterns
- **Error Handling**: How to handle common issues

#### **6. Navigation Tips**
- **Getting Started**: Where to begin when exploring the code
- **Key Files**: Most important files to understand
- **Related Documentation**: Links to other relevant docs

#### **7. Development Notes**
- **Current State**: Known limitations or issues
- **Future Plans**: Upcoming changes or improvements
- **Technical Debt**: Areas that need attention

### **Cross-Reference Standards**

#### **Linking Between AGENT.md Files**
Use relative paths to link between documentation files:
```markdown
See [`../internalCache/componentRender.AGENT.md`](../internalCache/componentRender.AGENT.md) for details
```

#### **Integration Points Section**
Always include an "Integration Points" section that:
- Lists dependencies on other systems
- Provides links to related `AGENT.md` files
- Explains how systems work together

#### **Navigation Tips**
Include specific guidance for AI assistants:
- Which files to examine first
- How to understand the system's role
- Where to find related functionality

### **Code Example Standards**

#### **TypeScript Examples**
- Use realistic but simple examples
- Include type annotations where helpful
- Show common usage patterns
- Demonstrate error handling

#### **WML Examples**
- Use clear, well-formatted XML
- Include comments explaining structure
- Show both simple and complex cases
- Demonstrate best practices

### **Documentation Hierarchy**

#### **System-Level Documentation**
- **Root `AGENT.md`**: Project overview and navigation
- **Package `AGENT.md`**: Major subsystem documentation
- **Directory `AGENT.md`**: Component group documentation

#### **Component-Level Documentation**
- **File `AGENT.md`**: Individual component documentation
- **Function Documentation**: Inline code comments
- **Type Definitions**: Interface and type documentation

#### **Task planning (`taskPlanning/`)**
- **[`taskPlanning/AGENT.md`](taskPlanning/AGENT.md)**: What belongs in task plans versus durable package docs, durability expectations, and how to add a new planning document.
- **Area notes**: Subfolders may include `AGENT.development.md` (for example [`taskPlanning/charcoal-client/AGENT.development.md`](taskPlanning/charcoal-client/AGENT.development.md)) with exact test commands and links to [`charcoal-client/AGENT.testing.md`](charcoal-client/AGENT.testing.md).
- **Example (ephemera / Coyote):** [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](lambda/ephemera/dataSource/coyoteGame/AGENT.md) **Engine testing harness (dev)** — graded Coyote hypothesis runs via `runCoyoteEngineTestHarness`.

## Quick Navigation

### **Core Systems**

#### **WML System** (`packages/mtw-wml/`)
- **[WML Language](packages/mtw-wml/ts/AGENT.md)**: Core markup language and concepts
- **[Standard Components](packages/mtw-wml/ts/standardize/components/AGENT.md)**: Component classes and interfaces
- **[Standard Render](packages/mtw-wml/ts/standardize/render/AGENT.md)**: Rich text processing
- **[Standard Form](packages/mtw-wml/ts/standardize/AGENT.md)**: Asset-level operations

#### **Interface System** (`packages/mtw-interfaces/`)
- **[Message Contracts](packages/mtw-interfaces/AGENT.md)**: API message definitions and validation

#### **Ephemera System** (`lambda/ephemera/`)
- **[Internal Cache](lambda/ephemera/internalCache/AGENT.md)**: Caching system overview
- **[Component Asset Meta](lambda/ephemera/internalCache/componentAssetMeta.AGENT.md)**: Component metadata caching from assetDB
- **[Component Ephemera Meta](lambda/ephemera/internalCache/componentEphemeraMeta.AGENT.md)**: EphemeraDB `Meta::Room` read-through cache (`EphemeraMetaRoom`)
- **[Component Render](lambda/ephemera/internalCache/componentRender.AGENT.md)**: Component rendering pipeline
- **[Examples](lambda/ephemera/internalCache/examples.AGENT.md)**: Example system and future vision
- **[Perception](lambda/ephemera/perception/AGENT.md)**: Message routing and display engine

#### **Client System** (`charcoal-client/`)
- **[Client Architecture](charcoal-client/AGENT.md)**: Frontend system with authoring vs playing mode distinction
- **[Authoring Workbench](charcoal-client/src/components/Workbench/AGENT.md)**: Form-based WML editing, component navigation, reference lists, layered context patterns
- **[Client Testing Standards](charcoal-client/AGENT.testing.md)**: Vitest patterns and React component testing guidelines
- **[Message Persistence](charcoal-client/src/slices/messages/AGENT.md)**: Dual-layer client/server message storage, IndexedDB caching, synchronization
- **[personalAssets](charcoal-client/src/slices/personalAssets/AGENT.md)**: Per-asset WML editing state, optimistic edits, base derivation from wmlDataSource

### **Architectural Philosophy**

#### **Core Principles**
- **[Architectural Philosophy](AGENT.architecture.philosophy.md)**: Perception-driven processing, cost optimization, and the "tree falls in forest" principle
- **[Event Architecture](AGENT.architecture.events.md)**: Technical implementation of event processing, character presence filtering, and performance optimization

### **Development Guidelines**

#### **Migration and Architecture Planning**
- **[Development Roadmap](AGENT.development.md)**: Master planning document for major migrations and architectural changes
- **[Task planning framework](taskPlanning/AGENT.md)**: Task-scoped plans under `taskPlanning/` (disposable after completion); content split versus package `AGENT.md` files
- **Migration Phases**: Message format standardization, Variable/Computed/Action removal, asset caching migration, LLM-mediated systems
- **Strategic Planning**: Coordinated approach to completing incomplete migrations and legacy system removal

#### **Testing Patterns**
- **Client (Vitest)**: Use `npm test` for watch mode, `npm run test:single` for single run (from `charcoal-client/`)
- **Packages (Jest)**: Use `npm run test` for watch mode, `npm run test -- --watchAll=false` for single run
- **Specific Files**: `npm run test:single -- src/path/to/test.ts` (client) or `npm run test -- src/path/to/test.ts` (packages)
- **Test Coverage**: Follow existing test patterns and naming conventions
- **Client Testing Standards**: See [`charcoal-client/AGENT.testing.md`](charcoal-client/AGENT.testing.md) for detailed Vitest patterns and React component testing

#### **Adding New Documentation**
1. **Follow the Structure**: Use the standard sections outlined above
2. **Cross-Reference**: Link to related `AGENT.md` files
3. **Include Examples**: Provide realistic code examples
4. **Update Navigation**: Add links to this root `AGENT.md`

#### **Maintaining Documentation**
1. **Keep Current**: Update docs when code changes
2. **Validate Links**: Ensure cross-references remain valid
3. **Review Regularly**: Periodically review for accuracy
4. **Evolve Standards**: Improve patterns based on experience

#### **Temporary Working Documents**

For complex migrations or multi-step tasks, temporary analysis documents help track progress and decision-making:

**When to Create**:
- Complex architectural changes requiring analysis
- Multi-phase migrations with multiple decision points
- Deep dives into system behavior that inform refactoring
- Working notes that aid task completion but aren't needed long-term

**Required Practices**:
1. **Mark as Temporary**: Add `⚠️ TEMPORARY DOCUMENT` warning in header
2. **Central Tracking**: List in parent planning document (e.g., main migration doc)
3. **Cleanup Task**: Add explicit cleanup step in task completion checklist
4. **Bidirectional Links**: Link from temp doc to parent, and parent to temp doc

**Example Pattern**:
```markdown
# Analysis Document Title

**Date**: October 16, 2025
**Status**: ⚠️ TEMPORARY DOCUMENT - delete after Phase 1B item 4 completion
**Tracked in**: `path/to/main-planning-doc.md` (Temporary Documents section)
```

**Parent Document Section**:
```markdown
## Temporary Documents (For Cleanup)

**Active** (need cleanup):
- `path/to/analysis.md` - Analysis for Phase 1B item 4

**Completed** (already deleted):
- ~~`path/to/old-analysis.md`~~ - Deleted after Phase 1A
```

**Benefits**:
- Encourages thorough analysis during complex work
- Prevents documentation clutter after task completion
- Maintains clear audit trail of temporary vs permanent docs
- Ensures systematic cleanup at task boundaries

**See Example**: The pattern was validated during the WML S3 Storage Migration (October 2025) with 4 consecutive 5-star sessions

#### **"Getting Started" Pattern for Complex Tasks**

For complex migrations, refactorings, or multi-phase projects, include a structured "Getting Started" section that guides AI agents (and human collaborators) through context gathering.

**When to Use**:
- Complex architectural changes spanning multiple subsystems
- Multi-phase migrations with significant context requirements
- Refactorings where understanding existing patterns is critical
- Any task where "just jumping in" would likely miss important context

**Pattern Structure** (7-step template):

1. **Understand Project Foundations**
   - Link to root AGENT.md and related foundational docs
   - Explain WHY each doc matters (not just "read this")
   - Focus on concepts, not just file listings

2. **Read Current Document**
   - Orient within the planning/migration document itself
   - Point to specific sections in recommended order
   - Explain the document's structure and purpose

3. **Understand Core Integration Points**
   - Identify the primary code being modified
   - Explain current vs. future state
   - Show usage patterns and examples

4. **Review Implemented Code**
   - Point to concrete implementations to learn from
   - Show established patterns in the codebase
   - Make abstract concepts concrete

5. **Check Testing Patterns**
   - Link to relevant test files
   - Show conventions through examples
   - Demonstrate quality expectations

6. **Identify Next Task**
   - Explain how to find current task
   - Show progress tracking mechanism (including [`taskPlanning/AGENT.md`](taskPlanning/AGENT.md#recommended-order-checkboxes) checkboxes in the task plan's **Recommended order**)
   - Guide to task prioritization
   - **Closure:** After implementation and verification, update those checkboxes in the task-plan document so the durable record matches shipped work

7. **Run Tests Before Starting**
   - Exact commands to run
   - Expected baseline (test count, pass rate)
   - Verification before making changes

**Key Innovation**: Make reasoning explicit

Instead of:
```markdown
### Getting Started
1. Read AGENT.md
2. Read the code
3. Run tests
```

Do this:
```markdown
### Getting Started
1. **Read AGENT.md**
   - **Why**: Understanding the existing pattern is essential
   - **Focus**: How the current system handles X and Y
   - **Key Insight**: Pay attention to Z pattern
```

**Proven Results** (from WML S3 Storage Migration evaluation):
- ✅ 4/4 sessions with 5-star effectiveness
- ✅ Enabled not just implementation, but design critique and architectural discovery
- ✅ AI agents could identify inconsistencies, propose improvements, discover production issues
- ✅ Progressive sophistication: basic implementation → design refinement → system-wide analysis

**Benefits**:
1. **Reduces orientation time** - Clear path through complex context
2. **Improves quality** - Deep understanding leads to better implementations
3. **Enables critical thinking** - Agents can question assumptions, not just follow orders
4. **Discovers issues** - System-wide understanding reveals cross-cutting problems
5. **Self-documenting** - Forces articulation of WHY each context piece matters

**Template**: See `lambda/wml/s3Storage/AGENT.md` for comprehensive documentation following this pattern

**Recommendation**: Use this pattern for any task with 3+ phases or requiring understanding of multiple subsystems.

**Task plans under `taskPlanning/`**: Also read [`taskPlanning/AGENT.md`](taskPlanning/AGENT.md) so you know what belongs in the task document versus durable docs, and when to retire the plan. Link any subfolder [`AGENT.development.md`](taskPlanning/charcoal-client/AGENT.development.md) (for example under `taskPlanning/charcoal-client/`) from **Getting Started** for exact test commands and pointers to [`charcoal-client/AGENT.testing.md`](charcoal-client/AGENT.testing.md); do not assume Jest-only examples apply to Vitest packages.

#### **AI Assistant Guidelines**
1. **Start Here**: Begin with this root `AGENT.md` for context
2. **Follow Links**: Use cross-references to navigate between systems
3. **Check Integration**: Understand how systems work together
4. **Read Examples**: Study code examples to understand patterns
5. **Ask Questions**: When documentation is unclear, ask for clarification
6. **Look for "Getting Started"**: Complex tasks will have structured onboarding - follow it!

## How to Use This Documentation

### **For AI Assistants**
1. **Begin with Overview**: Read the project overview to understand the system
2. **Follow Navigation**: Use the Quick Navigation section to find relevant docs
3. **Study Patterns**: Pay attention to the documentation standards
4. **Cross-Reference**: Use links to understand system relationships
5. **Check Examples**: Study code examples to understand implementation

### **For Human Collaborators**
1. **Browse Structure**: Use this file to understand the documentation organization
2. **Find Systems**: Use Quick Navigation to locate relevant documentation
3. **Follow Standards**: Use the documentation standards when creating new docs
4. **Maintain Links**: Keep cross-references updated when making changes
5. **Contribute**: Help improve documentation patterns and coverage

### **For New Contributors**
1. **Read This First**: Start here to understand the project structure
2. **Choose Your Path**: Use Quick Navigation to find your area of interest
3. **Study Examples**: Look at existing `AGENT.md` files for patterns
4. **Ask Questions**: Don't hesitate to ask for clarification
5. **Contribute**: Help improve documentation as you learn

## Development Notes

### **Current Documentation Coverage**
- **WML System**: Comprehensive coverage of core concepts and components
- **Interface System**: Complete message contract documentation
- **Ephemera System**: Good coverage of caching and perception systems
- **Client System**: Limited documentation (needs expansion)
- **Lambda Functions**: Partial coverage (needs more detail)

### **Future Improvements**
1. **Expand Coverage**: Document remaining subsystems
2. **Add Examples**: Include more realistic code examples
3. **Improve Navigation**: Better cross-referencing between systems
4. **Update Standards**: Refine documentation patterns based on usage
5. **Add Diagrams**: Include architectural diagrams where helpful

### **Known Issues**
- **Interface Inconsistencies**: Perception system output doesn't match documented interfaces
- **Incomplete Coverage**: Some subsystems lack documentation
- **Link Maintenance**: Cross-references need regular validation
- **Example Quality**: Some examples could be more realistic

### **Current Development Status**
- **Perception System Migration**: Phase 2 (Bridge State Component Updates) in progress
- **✅ Phase 1 Completed**: Interface updates with `PerceptionMessage`, `WMLSchema`, `SchemaComponentUUID`
- **✅ Backend Updates**: Perception system now sends `PerceptionMessage` format for rooms, features, knowledge
- **✅ MessageBus Integration**: Added `PublishPerceptionMessage` type and processing
- **✅ Infrastructure Completed**: WML parsing with fallback strategy, safe cache storage, type safety
- **🔄 Phase 2 In Progress**: Bridge state component updates with gradual migration approach (4/4 components completed, WML structure corrected, resilient typeguards implemented)
- **✅ Component Migration**: `KnowledgeDescription`, `FeatureDescription`, `RoomDescription`, and `RoomHeader` completed with proper WML structure, instanceof checks, StandardRender types, and resilient typeguards
- **Type Safety**: Comprehensive validation with `isPerceptionMessage` function
- **Testing**: Full test coverage with 67 tests passing
- **Documentation**: All relevant AGENT.md files updated with progress status

## Navigation Tips

1. **Start with Overview**: Always read the overview section first
2. **Check Integration Points**: Understand how systems connect
3. **Follow Cross-References**: Use links to explore related systems
4. **Study Examples**: Code examples often clarify concepts
5. **Read Development Notes**: Understand current limitations and future plans 
