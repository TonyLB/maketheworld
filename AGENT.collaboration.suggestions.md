# Asset Suggestions - Agent Navigation Guide

## Overview

The Asset Suggestions system is a specific publishing mode within the broader publishing framework that enables community members to propose improvements to existing world content. As one of three publishing types (Suggestion, New, Choice), suggestions address the unique challenge of collaborative refinement on assets where the community feels shared ownership and investment.

### Purpose

Suggestions solve a critical community challenge: how to enable collaborative improvement of established world content without disrupting the narrative stability that makes shared fictional worlds compelling. Unlike creating entirely new content, suggestions require the community to collectively decide how to evolve existing elements that players have already invested in and built stories around.

The system transforms the potentially contentious process of "changing someone else's work" into a structured community dialogue about "how can we make this better together." By requiring proposals rather than direct modifications, suggestions create space for discussion, refinement, and collective decision-making about the world's evolution.

This mode directly supports the core collaboration goals defined in [`AGENT.collaboration.md`](AGENT.collaboration.md): it expands **Universal Creative Access** by giving everyone clear pathways to propose improvements, while protecting **Narrative Stability** by coordinating changes to established assets through phase-appropriate evaluation.

### Context

This system operates within the broader publishing framework described in [`AGENT.collaboration.publishing.md`](AGENT.collaboration.publishing.md), specifically implementing the **Suggestion** publishing type. It supports the **Bootstrapping** and **Collaborative Storming** phases where rapid content iteration and community evaluation are essential, but focuses on the refinement of existing content rather than the creation of new content. The Suggestion process is **phase-aware**: in Bootstrapping, the system may allow direct application to maintain momentum; in later phases, it shifts toward proposal-and-evaluation before application. These behaviors operationalize the balance between **Universal Creative Access** and **Narrative Stability** documented in [`AGENT.collaboration.md`](AGENT.collaboration.md).

### Key Concepts

- **Suggestion**: A proposed modification to an existing asset, stored as a separate edit-mode asset that can be applied using the existing `applyWML` functionality
- **Target Asset**: The specific existing asset that a suggestion aims to modify or enhance
- **Single-Asset Constraint**: Technical limitation ensuring suggestions only modify one target asset to prevent deadlock risks and simplify review processes
- **Content Extraction**: The process of identifying and selecting specific changes from a larger draft document to create a focused suggestion
- **Import Safety**: Suggestions may introduce new import dependencies but should be clearly flagged for special attention; the only hard prevention is against introducing circular dependencies
- **Community Refinement**: The collaborative process of improving existing content through community discussion and consensus

### Core Goals

- **Enable Collaborative Refinement**: Provide structured pathways for community members to improve existing world content
- **Build Shared Ownership**: Create opportunities for the community to collectively invest in and improve established elements
- **Preserve Narrative Continuity**: Ensure that improvements to existing content maintain the coherence and continuity that players depend on
- **Facilitate Community Dialogue**: Create spaces for discussion and consensus-building about how to evolve shared world elements
- **Support Incremental Improvement**: Allow the community to make thoughtful, considered improvements to existing content over time
- **Phase-Appropriate Evaluation**: Adapt the level of evaluation required based on collaboration phase (e.g., lighter in Bootstrapping, stronger in later phases)

### Key Principles

- **Respect for Existing Investment**: Suggestions acknowledge that existing content represents community investment and should be improved rather than replaced
- **Single-Asset Focus**: Each suggestion targets exactly one existing asset to maintain system stability and simplify community evaluation
- **Phase-Appropriate Application**: During Bootstrapping, direct application of changes may be allowed to maintain momentum; in later phases, modifications should be proposed and evaluated before application
- **Community Consensus**: The community collectively decides which suggestions enhance the world and preserve its essential character
- **Incremental Evolution**: Encourage thoughtful, community-considered improvements that build upon rather than disrupt established foundations

### Success Metrics

- **Phase Fit**: Suggestion workflows adapt correctly to the current collaboration phase (Bootstrapping vs later phases)
- **Momentum Preservation**: In Bootstrapping, direct application enables rapid iteration without blocking progress
- **Quality Assurance**: In later phases, proposal-and-evaluation improves content quality and community trust
- **Shared Ownership**: Community participation in refinement increases perceived ownership of established assets
- **Continuity Protection**: Changes preserve narrative continuity for players invested in existing content
- **Constructive Dialogue**: Suggestions drive healthy discussion leading to consensual improvements

## User Roles

### Author UI

- **Phase-Aware Controls**: UI reflects whether direct application is allowed (Bootstrapping) or proposal submission is required (later phases)
- **Guided Extraction**: Tools help authors select focused changes appropriate for suggestions
- **Import Signals**: Clearly flag new imports for special attention and prevent circular dependencies
 - **Diff Preview**: Human-readable before/after view scoped to the target asset
 - **Status Lifecycle**: Clear states (Draft → Submitted → Under Review → Approved/Applied → Deferred) with surfaceable history

### Reviewer UI

- **Phase-Aware Workflows**: In Bootstrapping, lightweight visibility/rollback; in later phases, proposal review and approval flows
- **Continuity Checks**: Support evaluation for impact on established assets and storylines
- **Consensus Tools**: Mechanisms for discussion and decision-making appropriate to the phase
 - **Audit Trail**: Persistent record of diffs, decisions, rationale, and applied changes for transparency

## What tech needs to be developed

### Core Suggestion Infrastructure

#### Suggestion Creation and Targeting
- **Target Asset Selector**: Choose the single target asset for refinement
- **Draft Diff Engine**: Compute diffs between draft and target to isolate relevant changes
- **Guided Extraction Logic**: Identify publishable changes; show exclusions with reasons
- **Import Analysis**: Detect new imports, flag for attention, prevent circular dependencies

#### Suggestion Lifecycle Management
- **Phase-Aware State Machine**: Configure per-phase flows (e.g., direct apply in Bootstrapping; proposal-review-apply later)
- **Status Tracking**: States and transitions (Draft → Submitted → Under Review → Approved/Applied → Deferred → Withdrawn)
- **Audit Trail Storage**: Persist diffs, rationale, decisions, and applied changes

### Author UI Components
- **Create Suggestion Panel**: From draft editor, select changes and target asset
- **Diff Preview**: Human-readable before/after comparison scoped to target asset
- **Phase Indicator**: Clear messaging for direct apply vs proposal submission
- **Import Warnings**: Prominent flags for new imports; link to impacted references
- **Submission Workflow**: Single-asset submission with status feedback

### Reviewer UI Components (Phase-Dependent)
- **Queue/Inbox**: List of pending suggestions with priority and impact hints
- **Contextual Diff View**: Compare suggestion against current asset with references
- **Continuity Prompts**: Checklists for story/faction/knowledge impact
- **Decision Actions**: Approve, Request Changes, Defer, Rollback (Bootstrapping)
- **Discussion Threads**: Threaded comments tied to diff hunks
- **Audit Trail Viewer**: Full history of decisions and applied changes

### Backend Services
- **Suggestions API**: Create/update/read suggestion records and lifecycles
- **Diff/Extraction Service**: Server-side computation for robust, consistent diffs
- **Import Graph Service**: Analyze dependencies and detect cycles
- **Apply Engine Integration**: Integrate with `applyWML` to apply approved suggestions
- **Event Publishing**: Emit events for lifecycle transitions for notifications/analytics

### Data Model Extensions
- **Suggestion Entity**: Target asset, author, diff payload, imports introduced, phase at creation
- **Decision Records**: Reviewer, decision, rationale, timestamps, applied change references
- **Status Timeline**: Immutable sequence of state transitions

### Integration Requirements
- **WML/Standard Compliance**: Ensure diffs and application respect existing format
- **Domain Boundaries**: Respect WML → Assets → Ephemera domain authority and event flow
- **Notifications**: Hooks for notifying interested authors/reviewers on status changes

### Phase Configuration
- **Bootstrapping Profile**: Direct apply permitted, lightweight acknowledge, rollback available
- **Later Phases Profile**: Proposal submission, review gates, stronger consensus tools
- **Feature Flags**: Toggle behaviors per environment/community maturity