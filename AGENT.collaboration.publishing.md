# Asset Publishing - Agent Navigation Guide

**Last Updated**: November 16, 2025

## Overview

The Asset Publishing system transforms individual creative work into community-accessible content by managing visibility and access across different levels of the world hierarchy. Publishing serves as the bridge between personal creative expression and community-driven world evolution, enabling structured pathways for content to reach broader audiences while maintaining appropriate quality and community consensus.

**Note**: This document has been updated to align with the multi-draft system. Authors can maintain multiple draft assets and publish from any of them. The multi-draft system core implementation is complete with zone-based draft identification.

### Purpose

Publishing addresses the fundamental tension between **Universal Creative Access** and **Narrative Stability** that defines collaborative world-building. The system must enable every participant to contribute creatively while ensuring that core story areas remain stable for character development. By providing structured pathways for content to move from personal drafts to community-accessible levels, publishing creates the mechanism for balancing creative freedom with narrative coherence, allowing the community to collectively decide how to evolve the world while preserving its essential character.

### Context

This system operates within the broader collaboration framework described in [`AGENT.collaboration.md`](AGENT.collaboration.md), with different publishing strategies and tools appropriate to each collaboration phase. During **Bootstrapping**, the system supports rapid content creation with a bias toward publishing, while later phases will require more sophisticated community evaluation and consensus-building mechanisms.

### Key Concepts

#### Access Level Hierarchy
The visibility spectrum that determines who can see and interact with content, from most to least visible:

- **Canon**: Shows up in the world for everyone - the core shared reality
- **Event Access**: Special time-limited status where Library, Personal, or Faction assets show up in the world for everyone for a specific duration
- **Faction**: Shows up in the world for every character associated with the relevant character faction
- **Story Access**: Library, Personal, or Faction assets associated with a story show up for every character who participates in that story
- **Library Access**: Available for characters to opt into on an individual basis - shows up for everyone who has opted in
- **Personal Access**: Draft assets or other Personal status assets show up only for the player who created them

#### Publishing Types
Different approaches to content publication that reflect different author intentions and community needs:

- **Suggestion**: An asset bundled to be applied as an edit to an existing asset (possibly at another access level). When applied, it is merged into the target asset as an edit. No new asset is created in this publishing path.
- **New**: An asset bundled to stand alone as a layer of content, provisionally published targeting the access level it aspires to reach.
- **Choice**: Several assets bundled as multiple-choice options for the community to consider, with various means of judging which ones succeed.

#### Two-Stage Publishing Process
Publishing is frequently a two-stage process that enables community evaluation and refinement:

1. **Provisional Publishing**: The asset is published provisionally and goes through a process of evaluation or refinement
2. **Applied Publishing**: The refined asset is applied to the access level it was aspiring to reach

This process allows the system and collaborators to guide things collectively, providing leverage for balancing Universal Creative Access with Organic Growth and Balanced Innovation.

#### Bias Toward Publishing
The principle that encourages content creation and sharing, particularly during early collaboration phases. In the Bootstrapping phase, there are very few (possibly only one) authors adding to the system, making it possible to encourage direct, unvetted contributions while establishing rollback capabilities for contributions that need further refinement. This bias toward publishing is appropriate for early phases but cannot be maintained in later phases that require more sophisticated community evaluation.

#### Community Consensus
The collective decision-making process that determines which content becomes part of the shared world, enabled by the two-stage publishing process and community evaluation mechanisms.

### Core Goals

- **Universal Creative Access**: Provide every participant with clear pathways to contribute their creative work to the community
- **Narrative Stability**: Ensure that core story areas remain stable for character development while allowing appropriate evolution
- **Quality Recognition**: Reward creators who engage and delight others through reputation systems and community feedback
- **Moderation Support**: Provide moderation tools without creating bottlenecks or dependency on specific individuals
- **Organic Growth**: Enable systems to naturally evolve based on community feedback and engagement patterns

### Key Principles

- **Access Level Flexibility**: Content can be published to appropriate access levels based on community needs and collaboration phase, with the ability to move content between visibility levels as community consensus develops
- **Author Intent Recognition**: Publishing types reflect different creative intentions and organizational approaches - whether content should modify existing assets (Suggestion), stand alone (New), or provide community choice (Choice)
- **Community-Guided Evolution**: The system and community collectively guide content through the publishing process, with the two-stage provisional → applied workflow enabling community evaluation and refinement
- **Phase-Appropriate Tools**: Publishing mechanisms adapt to different collaboration phases - Bootstrapping can have a bias toward publishing with simple rollback, while later phases require more sophisticated community evaluation
- **Provisional Evaluation**: Community feedback is gathered before content becomes permanently part of the shared world, allowing for collective decision-making about world evolution
- **Content Extraction Support**: Publishing frequently requires extracting part of an asset to apply elsewhere, with intelligent filtering to identify and present only publishable content

### Success Metrics

- **Universal Access Achievement**: Every participant can find appropriate spaces for their stories without disruptive overlap
- **Stability Maintenance**: Core story areas remain stable for character development while allowing appropriate evolution
- **Quality Recognition**: Quality content naturally rises to prominence through community feedback and engagement
- **Moderation Effectiveness**: Moderation remains effective even with limited human oversight and without creating bottlenecks
- **Organic Evolution**: System adapts to changing player patterns and preferences through community-driven feedback
- **Creative Participation**: Community members actively create and publish content with clear contribution pathways
- **Narrative Coherence**: The shared world maintains consistency and believability as new content is added
- **Community Ownership**: The community feels collective ownership and investment in the published world content

## User Roles

### Author UI

The Author UI enables community members to transform their draft work into published content through structured publishing workflows. This interface builds upon the existing draft editing capabilities in the frontend client, extending them with publishing-specific functionality.

#### Core Publishing Workflow
- **Draft Selection**: Authors can publish from any of their draft assets (multi-draft system supports multiple concurrent drafts per player)
- **Draft Creation**: Authors work in existing draft editing interface to create and refine content across multiple drafts
- **Publishing Type Selection**: Choose between Suggestion (modify existing asset), New (standalone content), or Choice (multiple alternatives)
- **Target Selection**: For suggestions, select the specific existing asset to modify; for new content, choose appropriate access level
- **Content Extraction**: System intelligently presents only content that can be published based on target constraints from the selected draft
- **Import Validation**: System prevents suggestions that would introduce new imports or circular dependencies
- **Provisional Publishing**: Content becomes available in author mode for community feedback before final application

#### Publishing Interface Features
- **Smart Content Filtering**: Automatically identifies and presents only publishable content from drafts
- **Constraint Visualization**: Clearly shows what content can be published and why certain elements are excluded
- **Access Level Guidance**: Helps authors understand appropriate target levels for their content
- **Publishing History**: Track status of published content and community feedback

#### Integration with Existing Systems
- **Draft Editor Integration**: Seamless transition from draft editing to publishing workflow - publishing actions available from within any draft editor
- **Multi-Draft Support**: Publishing workflow works with any draft asset; authors can publish from the currently open draft or select a draft from their draft list
- **WML/Standard Format**: All published content uses existing format standards
- **Asset Management**: Leverages existing asset creation and management capabilities
- **Event System**: Publishes events for content status changes and community notifications

### Reviewer UI

The Reviewer UI enables community members to evaluate and provide feedback on provisionally published content. This interface is currently speculative and will be designed based on practical experience with the author publishing workflow.

#### Anticipated Review Workflow
- **Content Discovery**: Reviewers can browse provisionally published content in author mode
- **Evaluation Interface**: Tools for reviewing content quality, consistency, and community value
- **Feedback Mechanisms**: Structured ways to provide constructive feedback to authors
- **Community Discussion**: Spaces for community members to discuss proposed content
- **Decision Making**: Tools for community consensus-building about content approval

#### Future Review Features
- **Quality Assessment**: Frameworks for evaluating content against community standards
- **Consistency Checking**: Tools to verify content aligns with established world elements
- **Community Voting**: Mechanisms for collective decision-making about content approval
- **Feedback Integration**: Ways for authors to incorporate community feedback into revisions
- **Approval Workflows**: Structured processes for moving content from provisional to applied status
- **Rollback Capability**: During Bootstrapping phase, simple rollback for infrastructure operators to handle problematic content

#### Integration Considerations
- **Author Mode Context**: Review interface operates within existing author mode framework
- **Community Notification**: Integration with notification systems to alert relevant community members
- **Reputation Systems**: Future integration with community reputation and trust mechanisms
- **Moderation Tools**: Support for community moderation without creating bottlenecks

## What tech needs to be developed

### Core Publishing Infrastructure

#### Publishing Workflow Engine
- **Publishing Type Handler**: System to process Suggestion, New, and Choice publishing types with appropriate validation
- **Draft Selection**: Support for publishing from any draft asset (multi-draft system) - identify draft by AssetId
- **Content Extraction Logic**: Intelligent filtering to identify and present only publishable content from the selected draft document
- **Import Validation System**: Prevents suggestions that would introduce new imports or create circular dependencies
- **Access Level Management**: Tools to move content between different visibility levels (Draft → Personal → Library → Canon, etc.)
- **Provisional Publishing State**: Temporary storage and visibility system for content awaiting community feedback

#### Asset Management Extensions
- **Publishing Metadata**: Track publishing status, target assets, and community feedback on published content
- **Content Relationship Mapping**: Maintain connections between draft content, published suggestions, and target assets
- **Publishing History**: Audit trail of publishing actions, approvals, and rollbacks
- **Asset Versioning**: Support for content evolution through the publishing process

### Author UI Components

#### Publishing Interface
- **Publishing Type Selector**: UI for choosing between Suggestion, New, and Choice publishing approaches
- **Target Asset Selector**: Interface for selecting existing assets to modify (for suggestions)
- **Content Extraction UI**: Visual presentation of publishable content with constraint explanations
- **Access Level Selector**: Interface for choosing appropriate visibility levels for new content
- **Publishing Status Dashboard**: Track status of published content and community feedback

#### Integration Components
- **Draft Editor Extensions**: Seamless transition from existing draft editing to publishing workflow - publish button/action available in draft editor for the currently open draft
- **Draft Selection**: For bulk publishing workflows, ability to select which draft(s) to publish from draft management interface
- **Constraint Visualization**: Clear indication of what content can be published and why elements are excluded
- **Publishing History View**: Author-facing interface to track their publishing activity and community responses

### Backend Services

#### Publishing API
- **Publishing Endpoints**: RESTful APIs for creating, updating, and managing published content
- **Content Validation Services**: Server-side validation of publishing constraints and import dependencies
- **Access Level Management**: APIs for moving content between different visibility levels
- **Event Publishing**: Integration with existing event system for publishing status changes

#### Asset Processing
- **Content Extraction Engine**: Server-side logic for identifying publishable content from complex draft documents (works with any draft AssetId)
- **Import Analysis**: Automated detection of import dependencies and circular reference prevention
- **Publishing State Management**: Database schema and services for tracking provisional and applied publishing states
- **Multi-Draft Support**: Publishing operations accept draft AssetId as parameter, supporting publishing from any of a player's draft assets

### Future Review System (Speculative)

#### Review Interface Components
- **Content Discovery**: Browse and search provisionally published content
- **Evaluation Tools**: Interface for reviewing content quality, consistency, and community value
- **Feedback System**: Structured mechanisms for providing constructive feedback to authors
- **Community Discussion**: Spaces for community members to discuss proposed content
- **Decision Making Tools**: Interface for community consensus-building and approval workflows

#### Review Backend Services
- **Review Management**: APIs for managing review processes and community feedback
- **Approval Workflows**: Server-side logic for moving content from provisional to applied status
- **Community Notification**: Integration with notification systems for review requests and updates
- **Moderation Tools**: Infrastructure for rollback capabilities and content management

### Integration Requirements

#### Existing System Integration
- **WML/Standard Format**: All publishing must work with existing WML/Standard format infrastructure
- **Asset Management**: Leverage existing asset creation, storage, and management capabilities
- **Event System**: Integration with existing event publishing for status changes and notifications
- **Domain-Authoritative Event Mesh**: Publishing events must respect existing domain boundaries

#### Database Schema Extensions
- **Publishing Tables**: New database tables for tracking publishing status, targets, and community feedback
- **Asset Relationship Tables**: Extensions to existing asset schema for publishing relationships
- **Access Level Management**: Database support for different visibility levels and access controls

### Development Priorities

#### Phase 1: Core Publishing (Bootstrapping Focus)
- Basic publishing workflow for Suggestion and New content types
- Content extraction and import validation
- Simple provisional publishing with author-mode visibility
- Basic rollback capability for infrastructure operators

#### Phase 2: Enhanced Author Experience
- Improved content extraction UI with constraint visualization
- Publishing history and status tracking
- Enhanced integration with existing draft editing workflow

#### Phase 3: Community Review (Future)
- Review interface for community evaluation
- Feedback mechanisms and community discussion tools
- Approval workflows and consensus-building features
- Advanced moderation and rollback capabilities