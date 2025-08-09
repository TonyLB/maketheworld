# Development Roadmap - Migration and Architecture Evolution

**Status: ACTIVE PLANNING DOCUMENT**

This document serves as the master planning workspace for coordinating the major migrations and architectural changes needed to complete the Make The World system evolution from legacy programming-based authoring to example-driven content creation.

## Overview

The system is currently in a transitional state with several incomplete migrations that need to be completed in a specific sequence. These migrations were paused due to complex interdependencies, and this document provides the roadmap for systematic completion.

## Current System State

### **Legacy Patterns Still Active**
- **Variable/Computed/Action System**: Programming-language-based authoring model with complex dependency cascades
- **Condition Tags**: Conditional logic system that depends on Variable/Computed/Action infrastructure
- **Ephemera Asset Caching**: Asset blueprint caching in Ephemera Lambda (should be in Assets Lambda)
- **Direct WML → Ephemera Events**: EventBridge subscription bypassing Assets Lambda domain authority
- **Mixed Message Formats**: Frontend supports both new WML/Standard format and legacy formats

### **Target Architecture**
- **Example-Driven Content**: AI-inferred behavior from content examples instead of programmatic logic
- **Assets Lambda Authority**: Complete domain authority over component-level materialized views
- **Proper Event Flow**: WML → Assets → Ephemera event chain respecting domain boundaries
- **Ephemera Real-Time Focus**: Responsible only for character state, presence, and LLM-mediated interactions
- **Unified Message Format**: Single WML/Standard format across all perception messages

## Migration Sequence Plan

The following migrations must be completed in this specific order due to dependencies:

### **Phase 1: Message Format Standardization** *(Foundation)*
**Duration Estimate**: 2-3 weeks  
**Risk Level**: Low  
**Goal**: Complete the transition to unified WML/Standard message format

#### **Objectives**
- Remove legacy message format support from frontend
- Ensure all Ephemera perception messages use WML/Standard format
- Clean up bridge-state code in `RoomDescription` and related components

#### **Key Tasks**
- [x] **Audit Legacy Format Usage**: ✅ COMPLETED - Identified specific remaining legacy patterns
- [x] **🚨 URGENT: Fix PerceptionMessage Room Differentiation**: ✅ COMPLETED - Implemented `metaData` field with discriminated union based on `componentUUID` type patterns
- [x] **Update Ephemera Room Message Generation**: ✅ COMPLETED - Include metaData with displayMode for room PerceptionMessages  
- [x] **Update Frontend Room Message Routing**: ✅ COMPLETED - Use metaData with type guards for enhanced routing
- [x] **Test MetaData System**: ✅ COMPLETED - Comprehensive tests pass for RoomDescription vs RoomHeader differentiation
- [ ] **Update Ephemera CharacterDescription**: Migrate CharacterDescription messages to use PerceptionMessage format with WML content
- [ ] **Remove Frontend Bridge Code**: Clean up legacy format fallback support in ComponentDescription component
- [ ] **Remove Legacy Message Types**: Clean up unused type definitions and handlers in Ephemera messageBus
- [ ] **Update Tests**: Ensure all tests use new format expectations including metaData field

#### **Audit Results Summary**
**Legacy Formats Found**:
- **CharacterDescription**: Only remaining Ephemera message using legacy format (lines 174-181 in perception/index.ts)
- **Frontend Bridge Logic**: ComponentDescription still supports legacy FeatureDescription/KnowledgeDescription formats (lines 70-76)
- **Type Definitions**: Legacy message types still defined in messageBus/baseClasses.ts but unused

**Already Migrated** ✅:
- Room messages (RoomDescription/RoomHeader) → PerceptionMessage format
- Feature messages → PerceptionMessage format  
- Knowledge messages → PerceptionMessage format

**Scope Reduction**: Most migration work was already completed - only character descriptions and cleanup remain.

**🚨 CRITICAL ISSUE IDENTIFIED**: PerceptionMessage format cannot differentiate between RoomDescription and RoomHeader display modes. The backend sends `{ header: payload.header }` to ComponentRender, but this information is lost in the `PerceptionMessage` format since it only has `DisplayProtocol: 'PerceptionMessage'` without display mode indication.

**💡 ARCHITECTURAL SOLUTION**: Instead of adding ad hoc fields, implement a `metaData` field with strongly-typed discriminated union based on `componentUUID` patterns:

```typescript
// Base interface
type PerceptionMessageMetaDataBase = {
  componentUUID: ComponentUUID;
}

// Discriminated union based on componentUUID type
type PerceptionRoomMetaData = PerceptionMessageMetaDataBase & {
  componentUUID: `ROOM#${string}`;
  displayMode: 'header' | 'full';
}

type PerceptionFeatureMetaData = PerceptionMessageMetaDataBase & {
  componentUUID: `FEATURE#${string}`;
  // Room-specific metadata not applicable
}

// Union type
type PerceptionMessageMetaData = PerceptionRoomMetaData | PerceptionFeatureMetaData | PerceptionKnowledgeMetaData | PerceptionCharacterMetaData | PerceptionAssetMetaData;

// Updated PerceptionMessage
export type PerceptionMessage = {
    DisplayProtocol: 'PerceptionMessage';
    wmlContent: WMLSchema;
    metaData: PerceptionMessageMetaData;  // Replaces standalone componentUUID
} & MessageAddressing
```

This approach:
- ✅ Prevents ad hoc field accumulation
- ✅ Provides type safety based on component type
- ✅ Allows component-specific metadata without polluting base message
- ✅ Maintains backward compatibility (can migrate `componentUUID` to `metaData.componentUUID`)
- ✅ Extensible for future component-specific needs

**✅ IMPLEMENTATION COMPLETED** - Phase 1 Migration:
- **Interface Definition**: Added discriminated union metadata types and updated PerceptionMessage interface with optional `metaData` field
- **Backend Generation**: Updated Ephemera perception system to generate `metaData` for Room, Feature, and Knowledge messages
- **Frontend Routing**: Updated Message router to use metaData with type guards, providing proper RoomDescription vs RoomHeader differentiation
- **Backward Compatibility**: Maintained `componentUUID` field and fallback logic during migration period
- **Cache Compatibility**: Updated perceptionCache slice to work with both metaData and legacy componentUUID
- **Clear Naming**: Renamed all types and type guards with 'Perception' prefix (e.g., `PerceptionRoomMetaData`, `isPerceptionRoomMetaData`) to avoid naming confusion
- **Backend Message Bus**: Updated `PublishPerceptionMessage` type in Ephemera to include optional `metaData` field
- **Comprehensive Testing**: 91 total tests pass including 18 new metadata system tests verifying type safety and routing logic

#### **Success Criteria**
- All perception messages use WML/Standard format
- No legacy format handling code remains in frontend
- All tests pass with new format
- Documentation reflects single format standard

#### **Dependencies**
- **Blocks**: Variable/Computed/Action removal (needs consistent message format)
- **Enables**: Cleaner migration planning for subsequent phases

---

### **Phase 2: Variable/Computed/Action System Removal** *(Core Dependency)*
**Duration Estimate**: 4-6 weeks  
**Risk Level**: High  
**Goal**: Systematically remove programming-language-based authoring system

#### **Objectives**
- Document all Variable/Computed/Action dependencies
- Determine which pieces of *generic* functionality might later be useful to LLM-state: document and archive
- Remove Variable dependency cascade logic
- Remove Action execution system
- Remove Condition tag support
- Create temporary "static content" fallback for dynamic behavior

#### **Key Tasks**

##### **Phase 2A: Remove Ephemera Usage**
- [ ] **Dependency Mapping**: Complete audit of Variable/Computed/Action usage patterns
- [ ] **Asset Content Analysis**: Identify all assets using Variable/Computed/Action/Condition tags
- [ ] **Migration Strategy**: Develop approach for converting existing dynamic content to static/example-driven
- [ ] **Remove Dependency Cascade**: Delete `dependencyCascade.ts` and related logic
- [ ] **Remove Action Execution**: Delete `executeAction/` module and EventBridge triggers
- [ ] **Static Content Fallback**: Implement temporary system for previously-dynamic behavior
- [ ] **Test Suite Updates**: Remove Ephemera tests for deprecated functionality

##### **Phase 2B: Deprecate Tags from Storage Systems**
- [ ] **WML Parser Deprecation**: Update WML parser to reject Variable/Computed/Action/Condition tags
- [ ] **Asset Migration Tools**: Build tools to remove deprecated tags from existing assets
- [ ] **Asset Content Cleanup**: Run migration tools to strip deprecated tags from all stored assets
- [ ] **Schema Validation Updates**: Remove deprecated tag support from all schema validation layers
- [ ] **Interface Type Removal**: Remove Variable/Computed/Action/Condition types from `mtw-interfaces`
- [ ] **Storage Format Cleanup**: Ensure no deprecated tags remain in S3, DynamoDB, or cached representations
- [ ] **Import/Export Updates**: Update asset import/export to reject files containing deprecated tags
- [ ] **Backup Deprecated Content**: Archive final state of assets containing deprecated tags before cleanup

#### **Success Criteria**
- No Variable/Computed/Action code remains in Ephemera Lambda
- WML parser rejects Variable/Computed/Action/Condition tags at all parsing layers
- All existing assets have been cleaned of deprecated tags
- No deprecated tag types remain in `mtw-interfaces` or schema validation
- Storage systems (S3, DynamoDB, caches) contain no deprecated tag representations
- System functions with static content where dynamic behavior was removed
- Performance improvements from removing complex dependency calculations
- Asset import/export tools reject files containing deprecated tags

#### **Dependencies**
- **Requires**: Phase 1 (Message Format Standardization)
- **Blocks**: Asset caching migration (Ephemera still needs asset access for Variable/Computed/Action)
- **Enables**: Asset caching migration, proper domain separation

#### **Risk Mitigation**
- **Content Loss Risk**: Comprehensive asset backup before migration
- **Functionality Loss Risk**: Clear documentation of removed capabilities for future LLM-mediated replacement
- **Performance Risk**: Monitoring to ensure static fallbacks don't create performance issues

---

### **Phase 3: Asset Caching Migration Completion** *(Domain Authority)*
**Duration Estimate**: 3-4 weeks  
**Risk Level**: Medium  
**Goal**: Complete migration of asset caching from Ephemera to Assets Lambda

#### **Objectives**
- Move all asset blueprint caching to Assets Lambda
- Remove asset caching logic from Ephemera Lambda
- Implement proper WML → Assets → Ephemera event flow
- Establish Assets Lambda as sole authority over component-level materialized views

#### **Key Tasks**
- [ ] **Assets Lambda Event Subscription**: Add EventBridge subscription to WML `Content Update` events
- [ ] **Assets Lambda Event Publishing**: Publish `Asset Cache Updated` events after processing
- [ ] **Ephemera Event Subscription Migration**: Switch from WML events to Assets events
- [ ] **Remove Ephemera Asset Caching**: Delete `cacheAsset` functionality from Ephemera Lambda
- [ ] **Update InternalCache Integration**: Modify Ephemera to consume from Assets Lambda APIs
- [ ] **Performance Optimization**: Ensure new event flow doesn't introduce latency
- [ ] **Monitoring and Logging**: Add metrics for new event flow performance
- [ ] **Rollback Plan**: Prepare rollback strategy in case of issues

#### **Success Criteria**
- Assets Lambda is sole recipient of WML `Content Update` events
- Ephemera Lambda receives `Asset Cache Updated` events from Assets Lambda
- No asset caching logic remains in Ephemera Lambda
- All component data queries flow through Assets Lambda authority
- Event flow performance meets or exceeds previous implementation

#### **Dependencies**
- **Requires**: Phase 2 (Variable/Computed/Action removal eliminates complex asset dependencies)
- **Blocks**: LLM-mediated system implementation
- **Enables**: Clean domain separation, proper Domain-Authoritative Event Mesh

#### **Risk Mitigation**
- **Event Ordering Risk**: Comprehensive testing of event sequence and timing
- **Performance Risk**: Load testing to ensure Assets Lambda can handle the event volume
- **Data Consistency Risk**: Verification that Ephemera gets complete asset data from Assets

---

### **Phase 4: LLM-Mediated State System Design** *(Future Architecture)*
**Duration Estimate**: 6-8 weeks  
**Risk Level**: High  
**Goal**: Design and implement example-driven, AI-inferred world behavior

#### **Objectives**
- Design example-driven content model
- Implement LLM integration for dynamic behavior inference
- Create new event patterns for AI-mediated state changes
- Establish testing framework for non-deterministic behavior

#### **Key Tasks**
- [ ] **Example Content Model Design**: Define how examples will drive behavior
- [ ] **LLM Integration Architecture**: Design AI integration patterns for real-time inference
- [ ] **Dynamic Behavior Patterns**: Define how AI will infer state changes from examples
- [ ] **Event Flow Design**: Create event patterns for AI-mediated world updates
- [ ] **Testing Strategy**: Develop approaches for testing non-deterministic AI behavior
- [ ] **Performance Framework**: Ensure AI calls don't impact real-time experience
- [ ] **Fallback Systems**: Design graceful degradation when AI is unavailable
- [ ] **Content Migration Tools**: Build tools to convert static content to example-driven format

#### **Success Criteria**
- Example-driven content model is fully defined and documented
- LLM integration provides responsive dynamic behavior
- New system matches or exceeds capabilities of removed Variable/Computed/Action system
- Performance is acceptable for real-time gameplay
- Content migration tools enable systematic conversion of existing content

#### **Dependencies**
- **Requires**: Phase 3 (clean domain separation with proper event flows)
- **Enables**: Full example-driven content creation

#### **Risk Mitigation**
- **AI Reliability Risk**: Robust fallback systems and caching strategies
- **Performance Risk**: Careful AI call optimization and batching
- **Content Complexity Risk**: Incremental rollout starting with simple dynamic behaviors
- **Cost Risk**: Monitoring and optimization of AI usage costs

---

## Cross-Phase Considerations

### **Documentation Updates**
Throughout all phases, maintain comprehensive documentation updates:
- [ ] Update architectural philosophy documents as patterns change
- [ ] Revise event flow documentation to reflect new patterns
- [ ] Update component documentation to reflect format changes
- [ ] Maintain migration progress documentation

### **Testing Strategy**
Each phase requires comprehensive testing:
- [ ] **Unit Tests**: Update tests to reflect new patterns
- [ ] **Integration Tests**: Ensure event flows work across lambda boundaries
- [ ] **Performance Tests**: Verify new patterns don't introduce performance regressions
- [ ] **Migration Tests**: Validate that content migrates correctly between phases

### **Monitoring and Metrics**
Establish monitoring for migration progress:
- [ ] **Event Flow Metrics**: Monitor event processing times and success rates
- [ ] **Performance Metrics**: Track system performance through transitions
- [ ] **Error Monitoring**: Catch issues early in migration process
- [ ] **User Experience Metrics**: Ensure migrations don't impact user experience

### **Risk Management**
Comprehensive risk mitigation across all phases:
- [ ] **Rollback Plans**: Each phase must have clear rollback procedures
- [ ] **Backup Strategies**: Comprehensive backups before major changes
- [ ] **Incremental Deployment**: Phase deployment in stages with validation points
- [ ] **Communication Plan**: Clear communication about functionality changes during migration

## Phase Dependencies and Timeline

```
Phase 1: Message Format (2-3 weeks)
    ↓
Phase 2: Variable/Computed/Action Removal (4-6 weeks)
    ↓
Phase 3: Asset Caching Migration (3-4 weeks)
    ↓
Phase 4: LLM-Mediated System (6-8 weeks)

Total Estimated Duration: 15-21 weeks
```

### **Critical Path**
The phases must be completed in order due to hard dependencies:
- **Phase 1 → Phase 2**: Consistent message format needed for clean Variable/Computed/Action removal
- **Phase 2 → Phase 3**: Asset caching dependencies must be removed before migration
- **Phase 3 → Phase 4**: Clean domain authority needed before implementing new AI-mediated patterns

### **Parallel Work Opportunities**
Some tasks can be done in parallel across phases:
- Documentation updates can happen throughout
- Design work for later phases can begin during earlier phases
- Testing framework improvements can be incremental

## Success Metrics

### **Technical Success**
- [ ] Domain-Authoritative Event Mesh fully implemented
- [ ] No legacy Variable/Computed/Action code remains
- [ ] Assets Lambda has complete authority over component materialized views
- [ ] Ephemera Lambda focused solely on real-time character state and AI interactions
- [ ] Event flows respect proper domain boundaries

### **Functional Success**
- [ ] System maintains all current functionality during migration
- [ ] New LLM-mediated system provides equal or better dynamic behavior
- [ ] Performance meets or exceeds current system performance
- [ ] Content creation workflow is improved through example-driven model

### **Architectural Success**
- [ ] Clear domain separation between lambdas
- [ ] Consistent event flow patterns
- [ ] Simplified maintenance and development
- [ ] Foundation for future AI-enhanced features

## Risk Assessment

### **High-Risk Areas**
- **Variable/Computed/Action Removal**: Risk of functionality loss
- **LLM Integration**: New technology with unknown performance characteristics
- **Event Flow Migration**: Risk of data consistency issues

### **Medium-Risk Areas**
- **Asset Caching Migration**: Well-understood pattern but complex implementation
- **Message Format Migration**: Broad impact but straightforward changes

### **Low-Risk Areas**
- **Documentation Updates**: Time-consuming but low technical risk
- **Testing Updates**: Necessary work with clear success criteria

## Navigation

This document is part of the project's comprehensive documentation system:

- **[Main Project Documentation](AGENT.md)**: Complete project overview, architecture guides, and navigation to all system documentation
- **[Architectural Philosophy](AGENT.architecture.philosophy.md)**: Core principles driving this migration work
- **[Event Architecture](AGENT.architecture.events.md)**: Technical details of current event flows being migrated

## Next Steps

### **Immediate Actions**
1. **Validate Migration Sequence**: Review this plan with key stakeholders
2. **Detailed Phase 1 Planning**: Break down message format standardization into specific tasks
3. **Dependency Analysis**: Verify no additional dependencies have been missed
4. **Resource Planning**: Ensure development capacity for estimated timeline

### **Planning Refinements**
1. **Task Breakdown**: Each phase needs detailed task breakdowns with estimates
2. **Risk Mitigation Plans**: Develop specific mitigation strategies for identified risks
3. **Testing Strategies**: Define comprehensive testing approaches for each phase
4. **Success Criteria**: Refine success criteria with specific, measurable outcomes

---

*This document serves as the master coordination point for the major architectural migration work. It should be updated regularly as planning progresses and work begins.*
