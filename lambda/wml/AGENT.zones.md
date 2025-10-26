# Asset Zones - Agent Navigation Guide

## Overview

The asset zone system defines the access and visibility boundaries that govern how content is distributed across the Make The World platform. Zones represent different levels of content availability and permission structures, enabling the system to balance universal access with controlled sharing and personal ownership.

### Core Purpose

The zone system addresses fundamental content management needs:
- **Access Control**: Different permission levels for different types of content
- **Content Organization**: Logical grouping of assets based on their intended use
- **Collaboration Boundaries**: Clear separation between personal, shared, and universal content
- **Lifecycle Management**: Pathways for content to move between access levels

### Key Principles

- **Permission-Driven Access**: Zone membership determines what content characters can access
- **Flexible Boundaries**: Assets can transition between zones without structural changes
- **Context-Aware Visibility**: Content visibility depends on character context and permissions
- **Organizational Independence**: Zone concepts are separate from implementation details

## Zone Types and Access Patterns

### Canon Zone
**Purpose**: Universally available content that all characters can access without special permission

**Access Characteristics**:
- Available to all characters by default
- No special authorization required
- Represents core, stable world elements
- Forms the foundational content layer

**Typical Content**:
- Basic world knowledge and lore
- Fundamental game mechanics and rules
- Core locations and features
- Essential character creation elements

**Use Cases**:
- Establishing consistent world foundations
- Providing universal reference material
- Supporting character onboarding
- Maintaining narrative coherence

### Library Zone
**Purpose**: Shared content that is publicly available but requires explicit access or context to be visible

**Access Characteristics**:
- Publicly shared but not universally visible
- Requires special access or story participation
- Can be discovered through asset creation functions
- Becomes visible when associated with active stories

**Typical Content**:
- Community-contributed locations and features
- Shared character templates and assets
- Collaborative world-building elements
- Story-specific content for broader use

**Use Cases**:
- Community content sharing
- Collaborative asset development
- Story-based content distribution
- Quality-controlled community contributions

### Personal Zone
**Purpose**: Content owned by specific players or characters with limited visibility

**Access Characteristics**:
- Visible only to the owning player/character
- Short-term access can be granted through story participation
- Private workspace for content development
- Foundation for content promotion pathways

**Typical Content**:
- Personal character backstories and assets
- Experimental content and works-in-progress
- Private story elements and locations
- Individual creative projects

**Use Cases**:
- Personal content development
- Private storytelling
- Character-specific assets
- Individual creative expression

### Draft Zone
**Purpose**: Temporary workspace for content being actively created or edited

**Access Characteristics**:
- Temporary and ephemeral
- Limited to content creators during development
- Not part of persistent world state
- Excluded from normal access patterns

**Typical Content**:
- Content under active development
- Experimental modifications
- Work-in-progress assets
- Temporary collaborative editing spaces

**Use Cases**:
- Active content creation workflows
- Collaborative editing sessions
- Content testing and iteration
- Development and prototyping

### Archive Zone
**Purpose**: Long-term storage for content that has been removed or deprecated

**Access Characteristics**:
- Content is preserved but not actively accessible
- Maintains reference integrity for existing content
- Supports content lifecycle management
- Enables potential restoration or reference

**Typical Content**:
- Deprecated or outdated assets
- Removed community content
- Historical versions and snapshots
- Reference material for development

**Use Cases**:
- Content lifecycle management
- Historical preservation
- Reference and auditing
- Potential content restoration

**Phase 1 Status**: Archive functionality deferred to Phase 2 (chunk-based architecture). Currently, Archive zone transitions are rejected with an error message.

## Zone Transition Patterns

### Promotion Pathways

#### Personal → Library
- **Purpose**: Share personal content with broader community
- **Requirements**: Content quality meets community standards
- **Process**: Player-initiated promotion workflow
- **Outcome**: Content becomes available to all players through story context

#### Library → Canon
- **Purpose**: Elevate community content to universal status
- **Requirements**: Widespread adoption and community consensus
- **Process**: Community evaluation and formal promotion
- **Outcome**: Content becomes universally available

#### Any Zone → Archive
- **Purpose**: Remove content from active use while preserving references
- **Requirements**: Content deprecation or removal decision
- **Process**: Reference cleanup and archival storage
- **Outcome**: Content preserved but not accessible

### Transition Principles
- **Preserve Integrity**: Zone transitions maintain content structure and relationships
- **Update Permissions**: Access patterns automatically adjust to new zone membership
- **Maintain References**: Existing content references remain valid during transitions
- **Support Rollback**: Transitions can be reversed when appropriate

## Access Control Implementation

### Character-Based Access
- **Canon Content**: Always visible to all characters
- **Library Content**: Visible when characters have story access or explicit permissions
- **Personal Content**: Visible only to owning character and story participants
- **Draft Content**: Visible only to content creators during development
- **Archive Content**: Not visible in normal access patterns

### Story-Based Access
- **Story Participation**: Characters gain access to Library content when participating in relevant stories
- **Temporary Access**: Personal content becomes visible to story participants
- **Context-Aware Visibility**: Content visibility depends on current story context
- **Access Inheritance**: Story access patterns flow to character participants

### Permission Inheritance
- **Zone Membership**: Primary determinant of access permissions
- **Story Context**: Secondary access modifier for Library and Personal content
- **Character Ownership**: Special access rights for Personal zone content
- **Administrative Override**: System-level access for moderation and management

## Integration with System Architecture

### Asset Management
- **Zone Metadata**: Zone information stored as S3 tags (Phase 1: mutable via tag updates)
- **Access Queries**: DynamoDB maintains zone information for efficient querying
- **Transition Processing**: Zone changes are atomic S3 tag updates (Phase 1)
- **Cache Invalidation**: Zone transitions trigger cache updates

### Content Distribution
- **Streaming Systems**: Zone membership determines content distribution patterns
- **Caching Strategy**: Different caching approaches for different zone types
- **Performance Optimization**: Zone-aware content loading and preloading
- **Access Logging**: Zone-based access tracking and analytics

### Collaboration Systems
- **Permission Management**: Zone transitions update collaboration permissions
- **Content Sharing**: Zone membership enables appropriate sharing mechanisms
- **Moderation Tools**: Zone-aware content review and management
- **Community Features**: Zone-based community interaction patterns

## Future Considerations

### Advanced Access Patterns
- **Temporal Access**: Time-based access permissions for content
- **Conditional Visibility**: Context-dependent content visibility rules
- **Dynamic Zones**: Zones that change based on community activity
- **Hierarchical Permissions**: Multi-level access control within zones

### Enhanced Collaboration
- **Faction-Based Zones**: Group ownership and access patterns
- **Collaborative Editing**: Multi-user content development workflows
- **Content Versioning**: Version-aware zone transitions
- **Community Governance**: Community-driven content management

### Storage Evolution
- **Phase 1 (Complete)**: Flat UUID-based storage with Zone as S3 tags
- **Phase 2 (Future)**: Chunk-based storage for improved performance and backup
- **Metadata Enrichment**: Additional metadata for advanced features
- **Cross-Zone References**: Enhanced support for content spanning zones

## Navigation Guide for Developers

### Understanding Zone Behavior

1. **Start with Access Patterns**: Understand how zones control content visibility before diving into implementation
2. **Follow Transition Flows**: Study how content moves between zones to understand the complete lifecycle
3. **Consider Context**: Remember that access patterns depend on both zone membership and character context
4. **Implementation Independence**: Focus on access patterns rather than specific storage or folder structures

## Development Notes

### Current Implementation
- **Zone Storage**: Implemented as S3 object tags (Phase 1)
- **Zone Types**: Canon, Library, Personal, Draft zones are fully implemented
- **Archive Zone**: Deferred to Phase 2 - currently rejects Archive transitions
- **Transition Support**: Zone changes are atomic S3 tag updates (no file moves)
- **Access Control**: Zone-based access filtering is active
- **Cache Integration**: Zone information integrated with caching systems

### Future Enhancements
- **Archive Implementation**: Proper backup/restore with chunk-based storage (Phase 2)
- **Advanced Permissions**: More granular access control within zones
- **Dynamic Zones**: Zones that adapt based on community patterns
- **Enhanced Analytics**: Better tracking of zone-based usage patterns
- **Collaboration Tools**: Improved multi-user content development workflows

### Architectural Considerations
The zone system provides a clean abstraction for content access control that can be implemented using various storage and organizational strategies. The key is maintaining the access patterns and permission boundaries while allowing flexibility in the underlying implementation details.

**Phase 1 Achievement**: Zones are now decoupled from storage structure - zone is metadata (S3 tags), not file location. This enables atomic zone transitions and flexible future architecture evolution.

## Related Documentation

- **[WML Lambda](README.md)**: WML lambda overview and primary zone authority
- **[MoveAsset](dataSource/moveAsset/AGENT.md)**: Zone transition implementation
- **[S3 Storage Architecture](s3Storage/AGENT.md)**: How zones are stored as S3 tags (Phase 1 migration complete)
- **[Publishing Strategy](AGENT.s3storage.publishing.plan.md)**: Draft → Library/Canon workflows

