# Make The World - AI Navigation Guide

## Quick Reference (Common Agent Failures)
- **Client testing**: `npm test` (watch) or `npm run test:single` (single run; in `charcoal-client/`)
- **Package testing**: `npm run test` (watch) or `npm run test -- --watchAll=false` (single run)
- **Sandbox working directory**: Assume commands start at repo root; prefer `npm --prefix <path> run <script>` instead of `cd <path> && ...`
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

This project uses `AGENT*.md` files as the primary documentation format for AI assistants and human collaborators. **`AGENT.md` is the entry point** for an area; sibling files hold specific content types so implementation changes do not collapse everything into one drifted file.

**Migrating drifted docs:** Durable runbook [`taskPlanning/AGENT.docTaxonomy.migration-runbook.md`](taskPlanning/AGENT.docTaxonomy.migration-runbook.md). Per-area work: copy [`taskPlanning/AGENT.docMigration.planning.template.md`](taskPlanning/AGENT.docMigration.planning.template.md) into the matching `taskPlanning/` subfolder, rename to `AGENT.<areaSlug>DocMigration.planning.md`, delete the plan when migration merges.

### AGENT documentation taxonomy

**Aspirational standard, uneven adoption.** This taxonomy describes the **target** shape for durable docs. On disk, any given area may be anywhere from *just defined* (single drifted `AGENT.md` holding everything) to *fully aligned* (thin entry file plus the right siblings). Do not assume every path below exists or that every `AGENT.md` follows these rules yet. When **reading**, infer what you can from the files present and treat contradictions as migration debt, not as permission to ignore the taxonomy. When **writing**, move the area you touch toward this structure (see migration runbook above).

Use this section when **writing or updating** docs alongside code. Not every area needs every sibling file --- create only buckets with non-trivial content.

#### File roles

| File | Records | Does not record |
| --- | --- | --- |
| **`AGENT.md`** | Highest-level identity: what this area is for, scope, non-goals, links to siblings | Method tables, file inventories, falsifiable rules, cross-repo link graphs |
| **`AGENT.concepts.md`** | Mental models and vocabulary **originated or anchored** here | "Must / must not" obligations |
| **`AGENT.contract.md`** | Falsifiable rules (internal and external) the system **must** abide by | Code maps, changelog status |
| **`AGENT.navigation.md`** | Dense cross-area link backbone (mostly to **other** areas' doc nodes) | Local source file paths (use implementation) |
| **`AGENT.implementation.md`** | How to **find** behavior in this area's source tree | Full code recapitulation; normative rules without contract link |
| **`AGENT.planning.md`** | Non-normative future work | Steady-state truth (prefer `taskPlanning/` disposable plans) |

**Common optional siblings** (not universal):

| File | When to add |
| --- | --- |
| **`AGENT.testing.md`** | Test harness, async ordering, or runner conventions are non-obvious for this area |
| **`AGENT.usage.md`** | External consumers need a cookbook (library-style APIs) |

Package- or repo-level **`AGENT.development.md`** (exact commands, tooling) may live at root or under `taskPlanning/<area>/` --- see [`taskPlanning/AGENT.md`](taskPlanning/AGENT.md).

#### Decision tree (new content)

```
Normative and falsifiable?              -> AGENT.contract.md
Vocabulary / mental model?              -> AGENT.concepts.md
Where is code in THIS area?             -> AGENT.implementation.md
Where is another system's doc?          -> AGENT.navigation.md
How to test (non-default conventions)?  -> AGENT.testing.md
How to use from outside?                -> AGENT.usage.md
Future or in-flight initiative?         -> taskPlanning/ AGENT.*.planning.md
Identity, scope, entry links?           -> AGENT.md
```

#### Header contract

Each sibling file should open with a short scope line, for example:

> This file records **contracts** only. Mental models: [`AGENT.concepts.md`](./AGENT.concepts.md). Code map: [`AGENT.implementation.md`](./AGENT.implementation.md).

#### Normative authority

Cursor rules, cross-package references, and integration checklists should cite **`AGENT.contract.md`** (when the area has one), not a catch-all `AGENT.md`. If normative text lives only in `AGENT.md`, migration is incomplete.

#### Touch policy (steady-state edits)

When changing code, update **only** the bucket(s) that change affects --- often one, sometimes several (for example a new normative rule in `AGENT.contract.md` and a new module path in `AGENT.implementation.md`). Do not touch unrelated buckets. Default anti-pattern: appending everything to `AGENT.md` because it is the main file.

**Reference shapes:** [`packages/mtw-lambda-patterns/ts/messageBus/`](packages/mtw-lambda-patterns/ts/messageBus/) (pattern + implementation sibling); [`lambda/assets/messageBus/AGENT.md`](lambda/assets/messageBus/AGENT.md) (thin local index).

#### Topic extensions

Large single topics may use `AGENT.<topic>.md` when one concepts or contract file is too large. Declare parent and type in the header (for example: "Concept extension of `AGENT.concepts.md`").

### **Cross-Reference Standards**

#### **Linking between AGENT files**
Use relative paths. Link to the **specific sibling** (contract, implementation, concepts), not always `AGENT.md`:
```markdown
See [`./AGENT.contract.md`](./AGENT.contract.md) for normative gateway wiring.
See [`../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md`](../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md) for publish/settle behavior.
```

#### **Integration and navigation**
- **Dependencies on other systems** --- `AGENT.navigation.md` when the link graph is large; otherwise a short list in `AGENT.md`.
- **How other systems must interact** --- `AGENT.contract.md`.
- **Where to start in code** --- `AGENT.implementation.md`.

### **Code Example Standards**

#### **TypeScript Examples**
- Prefer **`AGENT.usage.md`** or **`AGENT.implementation.md`** for multi-step examples; keep `AGENT.md` examples minimal.
- Use realistic but simple examples; include type annotations where helpful.
- Demonstrate error handling where the example is contract-relevant.

#### **WML Examples**
- Use clear, well-formatted XML
- Include comments explaining structure
- Show both simple and complex cases
- Demonstrate best practices

### **Documentation Hierarchy**

#### **System-Level Documentation**
- **Root `AGENT.md`**: Project overview, taxonomy (this section), and Quick Navigation
- **Package `AGENT.md`**: Area entry point; siblings alongside as needed
- **`AGENT.navigation.md`**: Optional dense hub when Quick Navigation at root is not enough for that subtree

#### **Component-Level Documentation**
- **Directory entry `AGENT.md`**: Scope and links; avoid monolithic technical detail
- **Function Documentation**: Inline code comments
- **Type Definitions**: Interface and type documentation; normative shapes in `AGENT.contract.md` when shared across packages

#### **Task planning (`taskPlanning/`)**
- **[`taskPlanning/AGENT.md`](taskPlanning/AGENT.md)**: Task plans vs durable docs, durability ladder, how to add a planning document.
- **[`taskPlanning/AGENT.docTaxonomy.migration-runbook.md`](taskPlanning/AGENT.docTaxonomy.migration-runbook.md)**: Durable process for reorganizing drifted `AGENT*.md` files.
- **[`taskPlanning/AGENT.docMigration.planning.template.md`](taskPlanning/AGENT.docMigration.planning.template.md)**: Copy to instantiate a per-area doc migration task plan.
- **Area notes**: `AGENT.development.md` under `taskPlanning/<area>/` when tooling is non-obvious (for example [`taskPlanning/charcoal-client/AGENT.development.md`](taskPlanning/charcoal-client/AGENT.development.md)).

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
- **[Component Data](lambda/ephemera/internalCache/componentData.AGENT.md)**: Blueprint component bodies from assetDB (pair-addressed reads)
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

#### **Sandbox Pinned to Repo Root**
- **Default assumption**: In Cursor sandbox, shell commands are hard-pinned to the repository root.
- **Do not rely on `cd`**: Prefer command forms that target a package path explicitly.
- **Use npm prefix**: `npm --prefix <relative/path> run <script> [-- <args>]`.
- **Examples**:
  - `npm --prefix charcoal-client run test:single -- src/components/MyComponent.test.tsx`
  - `npm --prefix lambda/ephemera run test -- --watchAll=false src/dataSource/actions/enrich/acmeOrder/buildPrompt.test.ts`
  - `npm --prefix packages/mtw-lambda-patterns run test -- --watchAll=false`
- **For one-off binaries**: Use `npx --prefix <relative/path> <cmd>` when you need package-local tooling.

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
3. **Respect taxonomy**: Put new content in the correct `AGENT.*.md` sibling; cite `AGENT.contract.md` for normative rules
4. **Cross-Reference**: Use links to understand system relationships
5. **Check Examples**: Study code examples in usage or implementation docs, not only `AGENT.md`

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
2. **Migrate drifted docs**: Apply [doc taxonomy migration runbook](taskPlanning/AGENT.docTaxonomy.migration-runbook.md) to high-authority areas
3. **Improve Navigation**: Better cross-referencing between systems
4. **Add Diagrams**: Include architectural diagrams where helpful

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
