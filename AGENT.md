# Make The World - AI Navigation Guide

**🚨 CRITICAL: AI EDIT TOOLS ARE (HOPEFULLY TEMPORARILY) BROKEN - READ THIS SECTION FIRST**

**⚠️ STOP: Do NOT use any AI edit tools until you read this section completely**

## What's Broken
- **ALL AI edit tools** (`edit_file`, `search_replace`) are fundamentally broken
- **Multiple edits to the same file** will each be applied to a fresh copy of the file prior to _any_ edits, so only the most recent edit will survive
- **No workaround exists** for incremental development
- **This is a confirmed Cursor-wide bug** affecting all users

## What This Means for You
1. **You CANNOT make multiple edits** to the same file
2. **You CAN make single, comprehensive edits** that include all needed changes
3. **Every edit must be planned completely** before execution
4. **Manual verification required** after any AI editing

## Required Workflow
1. **Plan your complete changes** before editing anything
2. **Make ONE comprehensive edit** that includes everything
3. **Do NOT attempt multiple edits** to the same file
4. **Stop and have user Verify content** after any edit operation

## Why This Matters
- **Your work will be lost** if you ignore this warning
- **You will enter unconstrained loops** because you will continuously backtrack to try to fix edits, causing more edits to need to fix
- **You will generate unconstrained cost** because of the infinite loop of token generation
- **You cannot be an effective collaborator** using multiple edits
- **This bug affects the entire Cursor user base**
- **No exceptions exist** - the tools are fundamentally broken

## Quick Reference (Common Agent Failures)
- **Client testing**: `npm test` (watch) or `npm test -- --run` (single run)
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
- **[Component Meta](lambda/ephemera/internalCache/componentMeta.AGENT.md)**: Component metadata caching
- **[Component Render](lambda/ephemera/internalCache/componentRender.AGENT.md)**: Component rendering pipeline
- **[Examples](lambda/ephemera/internalCache/examples.AGENT.md)**: Example system and future vision
- **[Perception](lambda/ephemera/perception/AGENT.md)**: Message routing and display engine

#### **Client System** (`charcoal-client/`)
- **[Client Architecture](charcoal-client/AGENT.md)**: Frontend system with authoring vs playing mode distinction
- **[Client Testing Standards](charcoal-client/AGENT.testing.md)**: Vitest patterns and React component testing guidelines
- **[Message Persistence](charcoal-client/src/slices/messages/AGENT.md)**: Dual-layer client/server message storage, IndexedDB caching, synchronization

### **Architectural Philosophy**

#### **Core Principles**
- **[Architectural Philosophy](AGENT.architecture.philosophy.md)**: Perception-driven processing, cost optimization, and the "tree falls in forest" principle
- **[Event Architecture](AGENT.architecture.events.md)**: Technical implementation of event processing, character presence filtering, and performance optimization

### **Development Guidelines**

#### **Migration and Architecture Planning**
- **[Development Roadmap](AGENT.development.md)**: Master planning document for major migrations and architectural changes
- **Migration Phases**: Message format standardization, Variable/Computed/Action removal, asset caching migration, LLM-mediated systems
- **Strategic Planning**: Coordinated approach to completing incomplete migrations and legacy system removal

#### **Testing Patterns**
- **Client (Vitest)**: Use `npm test` for watch mode, `npm test -- --run` for single run
- **Packages (Jest)**: Use `npm run test` for watch mode, `npm run test -- --watchAll=false` for single run
- **Specific Files**: `npm test -- --run src/path/to/test.ts` (client) or `npm run test -- src/path/to/test.ts` (packages)
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

#### **AI Assistant Guidelines**
1. **Start Here**: Begin with this root `AGENT.md` for context
2. **Follow Links**: Use cross-references to navigate between systems
3. **Check Integration**: Understand how systems work together
4. **Read Examples**: Study code examples to understand patterns
5. **Ask Questions**: When documentation is unclear, ask for clarification

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

**🚨 CRITICAL: READ THIS FIRST - Cursor Edit Tool Issues**

**IMMEDIATE REQUIREMENT**: This project has identified critical bugs with Cursor's AI edit tools that can destroy your work.

**Known Issues**:
- **BOTH `edit_file` AND `search_replace` tools are failing** to preserve file context
- This is a fundamental Cursor bug affecting ALL AI edit tools
- The issue stems from Cursor applying AI edits to outdated file versions
- **UPDATED**: Our initial testing was incomplete - both tools have context preservation failures

**Required Actions**:
1. **Avoid ALL AI edit tools** for files with complex content structure
2. **Use manual editing** for critical file modifications
3. **Accept each edit manually** before requesting the next one (if you must use AI tools)
4. **Verify file content** after each edit operation
5. **Use Git commits** before any AI editing sessions for easy rollback
6. **Consider alternative approaches** like copy-paste or manual file creation

**Why This Matters**:
- **ALL AI edit tools are unreliable** in this project
- Previous workaround recommendations were incorrect
- Manual editing may be the only safe option until Cursor fixes this bug 