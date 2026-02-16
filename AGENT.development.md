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

### **Phase 1: Message Format Standardization** *(Foundation)* ✅ **COMPLETED**
**Duration**: 2-3 weeks  
**Risk Level**: Low  
**Goal**: Complete the transition to unified WML/Standard message format

#### **✅ ACCOMPLISHED**
- **Unified PerceptionMessage Format**: All frontend components and server-side generation now use `PerceptionMessage` with WML content and strongly-typed `metaData` discriminated unions
- **Legacy Type Elimination**: Removed all legacy message types (`RoomDescription`, `RoomHeader`, `FeatureDescription`, `KnowledgeDescription`, `CharacterDescription`) from interfaces and handlers
- **Component Interface Modernization**: Refactored components to accept clean `parsedWML + metaData` interfaces instead of redundant message wrappers
- **Type Safety Enhancement**: Implemented component-specific metadata types with proper type guards for elegant validation and routing

#### **Success Criteria**
- All perception messages use WML/Standard format
- No legacy format handling code remains in frontend
- All tests pass with new format
- Documentation reflects single format standard

#### **Dependencies**
- **Blocks**: Variable/Computed/Action removal (needs consistent message format)
- **Enables**: Cleaner migration planning for subsequent phases

---

### **Phase 2: Variable/Computed/Action System Removal** *(Core Dependency)* ✅ **COMPLETED**
**Duration**: 5-7 weeks  
**Risk Level**: High  
**Goal**: Systematically remove programming-language-based authoring system

#### **✅ ACCOMPLISHED**
- **Complete System Removal**: Eliminated all Variable, Computed, Action, and Condition tag support from WML schema, parsers, and frontend components
- **Frontend Component Cleanup**: Removed IfElseTree, ListWithConditions, Action links, and JavaScript editing capabilities from all UI components
- **Schema and Parser Updates**: Updated WML schema converters, removed deprecated type guards, and implemented parser rejection for legacy tags
- **Test Suite Restoration**: Fixed all unit tests across mtw-wml, mtw-base, mtw-interfaces, and lambda packages to work without deprecated functionality
- **Dependency Property Cleanup**: Removed all `dependencies` and `stateMapping` properties that served only the legacy system
- **Import/Export System Updates**: Modified asset import/export tools to reject files containing deprecated tags
- **Performance Improvements**: Eliminated complex dependency calculations and legacy component overhead

#### **Success Criteria**
- ✅ **No Variable/Computed/Action code remains in any package** - All classes, data types, and tests removed
- ✅ **All frontend components updated** - StandardForm and related components no longer have legacy dependencies
- ✅ **All unit tests pass** - Test suite cleanup completed with full coverage maintained
- ✅ **WML parser rejects deprecated tags** - Parser naturally rejects Variable/Computed/Action/Condition tags
- ✅ **Schema validation updated** - No deprecated tag types remain in interfaces or base packages
- ✅ **Asset tools reject legacy content** - Import/export systems no longer recognize deprecated tags
- ✅ **System functions with static fallbacks** - Dynamic behavior replaced with static content where needed

#### **Dependencies**
- **Requires**: Phase 1 (Message Format Standardization) ✅ **COMPLETED**
- **Enables**: Asset caching migration, proper domain separation ✅ **READY TO PROCEED**

#### **Risk Mitigation**
- **Functionality Loss Risk**: Clear documentation of removed capabilities for future LLM-mediated replacement
- **Performance Risk**: Monitoring to ensure static fallbacks don't create performance issues

---

### **Phase 3: Asset Caching Migration Completion** *(Domain Authority)* ⏳ **IN PROGRESS (90% Complete)**
**Duration Estimate**: 3-4 weeks  
**Risk Level**: Medium  
**Goal**: Complete migration of asset caching from Ephemera to Assets Lambda

#### **✅ ACCOMPLISHED (Assets Lambda Side)**
- **Assets Lambda Event Subscription**: ✅ **COMPLETED** - EventBridge subscription to WML `Content Update` and `Content Removed` events configured and operational
- **Assets Lambda Event Publishing**: ✅ **COMPLETED** - Publishes `Component Updated`, `Component Removed`, `Asset Cached`, `Asset Decached`, `Asset Removed`, and `Canon Updated` events via EventBridge
- **Event Serialization System**: ✅ **COMPLETED** - Full `AssetsEventSerializer` implementation with WML conversion for external consumption
- **Domain Authority Establishment**: ✅ **COMPLETED** - Assets Lambda has complete authority over component-level materialized views
- **Character Event Integration**: ✅ **COMPLETED** - Characters data source processes component events for character-specific caching
- **Event Flow Implementation**: ✅ **COMPLETED** - Proper WML → Assets event processing with deserialization and component-level events

#### **✅ ACCOMPLISHED (Ephemera Lambda Side)**
- **Ephemera Event Subscription Migration**: ✅ **COMPLETED** - Ephemera lambda now subscribes to `mtw.assets` events via `AssetsEventSerializer`
- **Event Deserialization System**: ✅ **COMPLETED** - Full deserialization of assets events to internal message bus format
- **DataSource Integration**: ✅ **COMPLETED** - Ephemera lambda processes assets events through DataSource pattern
- **Domain Authority Ceding**: ✅ **COMPLETED** - Ephemera lambda no longer performs asset caching, defers to Assets Lambda

#### **⏳ REMAINING WORK (Migration Cleanup)**
- **Remove Legacy WML Event Handling**: Clean up `mtw.wml` event subscription code in ephemera lambda
- **Remove Legacy CacheAsset References**: Clean up remaining `cacheAsset` documentation/comments
- **Remove Direct WML → Ephemera Flow**: Eliminate legacy event handling in favor of WML → Assets → Ephemera flow

#### **Key Tasks**
- [x] **Assets Lambda Event Subscription**: ✅ **COMPLETED** - EventBridge subscription to WML `Content Update` events
- [x] **Assets Lambda Event Publishing**: ✅ **COMPLETED** - Publish `Component Updated` and `Component Removed` events after processing
- [x] **Ephemera Event Subscription Migration**: ✅ **COMPLETED** - Now subscribes to `mtw.assets` events
- [x] **Remove Ephemera Asset Caching**: ✅ **COMPLETED** - Core functionality removed, defers to Assets Lambda
- [x] **Update InternalCache Integration**: ✅ **COMPLETED** - Modified to consume from Assets Lambda events
- [ ] **Remove Legacy WML Event Handling**: Clean up `mtw.wml` event subscription code
- [ ] **Remove Legacy CacheAsset References**: Clean up remaining documentation/comments
- [ ] **Performance Optimization**: Ensure new event flow doesn't introduce latency
- [ ] **Monitoring and Logging**: Add metrics for new event flow performance

#### **Success Criteria**
- [x] Assets Lambda is sole recipient of WML `Content Update` events ✅ **COMPLETED**
- [x] Assets Lambda publishes `Component Updated` and `Component Removed` events ✅ **COMPLETED**
- [x] Event serialization system converts StandardComponent objects to WML for external consumption ✅ **COMPLETED**
- [x] All component data queries flow through Assets Lambda authority ✅ **COMPLETED**
- [x] **Ephemera Lambda receives `Component Updated`/`Component Removed` events from Assets Lambda** ✅ **COMPLETED**
- [x] **No asset caching logic remains in Ephemera Lambda** ✅ **COMPLETED** (core functionality removed, only references remain)
- [ ] **Legacy WML event subscription removed** ⏳ **PENDING**
- [ ] **Event flow performance meets or exceeds previous implementation** ⏳ **PENDING**

#### **Dependencies**
- **Requires**: Phase 2 (Variable/Computed/Action removal eliminates complex asset dependencies) ✅ **COMPLETED**
- **Blocks**: LLM-mediated system implementation
- **Enables**: Clean domain separation, proper Domain-Authoritative Event Mesh ⏳ **90% ACHIEVED** (Core migration complete, cleanup pending)

#### **Risk Mitigation**
- **Event Ordering Risk**: ✅ **MITIGATED** - EventBridge infrastructure provides reliable event ordering
- **Performance Risk**: ✅ **MITIGATED** - EventBridge and Lambda infrastructure scales automatically
- **Data Consistency Risk**: ✅ **MITIGATED** - Event serialization system ensures consistent data format

---

### **Phase 3.5: Migration Cleanup** *(Final Cleanup)*
**Duration Estimate**: 1-2 weeks  
**Risk Level**: Low  
**Goal**: Remove legacy code and complete migration documentation

#### **Key Tasks**
- [ ] **Remove Legacy WML Event Handling**: Clean up `mtw.wml` event subscription in ephemera lambda
- [ ] **Remove Legacy CacheAsset References**: Clean up remaining documentation and comments
- [ ] **Update Documentation**: Ensure all documentation reflects new event flow patterns
- [ ] **Performance Validation**: Confirm new event flow performance meets requirements

#### **Success Criteria**
- [ ] No legacy WML event handling remains in ephemera lambda
- [ ] All documentation reflects WML → Assets → Ephemera event flow
- [ ] Performance benchmarks confirm no regression
- [ ] Clean separation of concerns between lambdas

#### **Dependencies**
- **Requires**: Phase 3 (core migration complete)
- **Enables**: Clean transition to Phase 4 (LLM-mediated system)

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

## Future Development Considerations

### Multi-Draft System Enhancements

**Context**: The multi-draft system core implementation is complete (Phases 1, 3, 3.5). The following items are future enhancements to consider based on user feedback and usage patterns.

#### Permissions Model
**Status**: Open question for future consideration

**Current Behavior**: 
- Drafts are private to the creating player (only visible via player-asset listing)
- No sharing mechanism exists
- No explicit permissions model documented

**Future Considerations**:
- Can drafts be shared for collaboration?
- How do permissions change when promoting to published? (Likely inherits target zone permissions)
- Should there be draft-level access controls?

**Recommendation**: Document current private behavior, defer sharing/collaboration to future phase if needed based on user demand.

#### Draft Management Enhancements
**Status**: Future enhancements (not blocking)

**Questions for Future Consideration**:
1. **Draft Limits**: Should there be a maximum number of drafts per player?
2. **Draft Size**: Should drafts have size limitations different from published assets?
3. **Draft Sharing**: Collaborative drafts (related to Permissions Model above)
4. **Auto-save Frequency**: How frequently should draft changes persist? (Currently 5 seconds)
5. **Draft Templates**: Would pre-configured draft templates be useful?

**Recommendation**: Address as needed based on user feedback and usage patterns. No immediate action required.

#### Optional Performance Optimizations
**Status**: Optional (not blocking)

**Items**:
- **Optional Filtered Listing Endpoint**: `GET /player/assets?zone=Draft` server-side filtered endpoint
  - Current: Client-side filtering works via `getMyDraftAssets` selector
  - Impact: Minor performance optimization for large asset lists
  - Recommendation: Defer unless performance issues arise

#### Hierarchical Component Organization
**Status**: Future enhancement (not blocking)

**Goal**: Allow Features and Knowledges to contain references to their own type for hierarchical organization

**Current Behavior**:
- `StandardFeature` only allows `Example` children (not `Feature` children)
- `StandardKnowledge` only allows `Example` children (not `Knowledge` children)
- This prevents hierarchical organization of Features and Knowledges

**Future Considerations**:
- Allow `Feature` components to contain other `Feature` components as children
- Allow `Knowledge` components to contain other `Knowledge` components as children
- This would enable hierarchical organization (e.g., "Combat Features" containing "Melee Combat" and "Ranged Combat")
- Would enable cycle detection testing in component graphs
- Would require updates to:
  - `StandardFeature.withChild()` to accept `Feature` children
  - `StandardKnowledge.withChild()` to accept `Knowledge` children
  - WML schema validation
  - Component rendering logic

**Recommendation**: Address as needed based on content organization requirements. No immediate action required.

#### Asset address (`.address`) usage
**Status**: Future evaluation

**Context**: Zone changes are now stored in their own structure (e.g. zone metadata in DynamoDB, S3 tags) rather than by moving objects between different zone directories. The legacy direct-invocation `metaData` handler that returned asset addresses was removed from the assets lambda.

**Future consideration**: It may make sense to evaluate whether we still use `.address` for assets at all. If zone is fully expressed in metadata and no longer implied by directory layout, code that relies on `assetWorkspace.address` or similar may be redundant or simplifiable.

#### Coordination events: remove mtw.coordination EventBridge, localize API handling
**Status**: Future task (not part of current serialization refactor)

**Context**: Coordination commands (Apply Edit, Move Asset, Purge Asset, Canonize/Decanonize Asset, Create Snapshot) are today sent in-process via the messageBus with `dataSourceKey: 'internal'`. Nothing publishes `mtw.coordination` events to EventBridge; the EventBridge serializer and Assets' subscription to `mtw.coordination` (e.g. Remove Asset) are legacy from an earlier pattern.

**Future option worth pursuing**: Remove `mtw.coordination` from EventBridge entirely and treat coordination as purely internal API handling. Each lambda would be explicitly responsible for the structure of its own API handling; no shared EventBridge coordination channel. This would mean removing the CoordinationEventSerializer registration for EventBridge, removing Assets' subscription to `mtw.coordination` (or repurposing Remove Asset if needed), and keeping coordination types and handling local to the lambdas that use them.

**Recommendation**: Documented here as a possible future shift. Not part of the current DataSource serialization boundary refactor (see `packages/mtw-lambda-patterns/ts/dataSource/AGENT.serializationRefactor.planning.md`). Revisit when prioritizing cleanup of unused EventBridge paths or when redefining lambda API boundaries.

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
Phase 1: Message Format ✅ COMPLETED
    ↓
Phase 2: Variable/Computed/Action Removal ✅ COMPLETED
    ↓
Phase 3: Asset Caching Migration ⏳ IN PROGRESS (90% - Core Migration Complete)
    ↓
Phase 3.5: Migration Cleanup (1-2 weeks)
    ↓
Phase 4: LLM-Mediated System (6-8 weeks)

Remaining Estimated Duration: 7-10 weeks
```

### **Critical Path**
The phases must be completed in order due to hard dependencies:
- **Phase 1 ✅ COMPLETED**: Consistent message format foundation established
- **Phase 2 → Phase 3**: Asset caching dependencies must be removed before migration ✅ **COMPLETED**
- **Phase 3 → Phase 3.5**: Core migration complete, cleanup needed ⏳ **IN PROGRESS** (90% Complete)
- **Phase 3.5 → Phase 4**: Clean domain authority needed before implementing new AI-mediated patterns ⏳ **PENDING** (Cleanup Required)

### **Parallel Work Opportunities**
Some tasks can be done in parallel across phases:
- Documentation updates can happen throughout
- Design work for later phases can begin during earlier phases
- Testing framework improvements can be incremental

## Success Metrics

### **Technical Success**
- [x] **Message Format Standardization**: All perception messages use unified WML/Standard format with strongly-typed metadata ✅ COMPLETED
- [x] **Domain-Authoritative Event Mesh**: Core event flow implemented with Assets Lambda authority ⏳ **90% COMPLETE** (Core migration complete, cleanup pending)
- [x] No legacy Variable/Computed/Action code remains ✅ COMPLETED
- [x] **Assets Lambda Authority**: Complete authority over component materialized views ✅ COMPLETED
- [x] **Ephemera Lambda Event Integration**: Now receives assets events and defers to Assets Lambda authority ✅ COMPLETED
- [x] **Event Flow Domain Boundaries**: WML → Assets → Ephemera event chain respects domain boundaries ✅ COMPLETED
- [ ] **Legacy Code Cleanup**: Remove remaining WML event handling and cacheAsset references ⏳ **PENDING**

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

---

*This document serves as the master coordination point for the major architectural migration work. It should be updated regularly as planning progresses and work begins.*

## **Migration Status Overview**

### **Phase 1: Foundation Analysis** ✅ **COMPLETED (100%)**
- [x] **WML Schema Analysis**: Complete audit of WML tag usage and dependencies ✅ **COMPLETED**
- [x] **Component Dependency Mapping**: Full dependency graph of all system components ✅ **COMPLETED**
- [x] **Migration Strategy Development**: Comprehensive plan for systematic removal ✅ **COMPLETED**

### **Phase 2: System Removal** ✅ **COMPLETED (100%)**
- [x] **Phase 2A: Remove Ephemera Usage** ✅ **COMPLETED (100%)**
- [x] **Phase 2B: Dependencies Properties Assessment** ✅ **COMPLETED (100%)**
- [x] **Phase 2C: Frontend Component Analysis** ✅ **COMPLETED (100%)**
- [x] **Phase 2D: WML Parser and Schema Analysis** ✅ **COMPLETED (100%)**

### **Phase 3: Asset Caching Migration** ⏳ **IN PROGRESS (90%)**
- [x] **Assets Lambda Event Subscription**: EventBridge subscription to WML events ✅ COMPLETED
- [x] **Assets Lambda Event Publishing**: Component Updated/Removed events ✅ COMPLETED
- [x] **Event Serialization System**: Full WML conversion for external consumption ✅ COMPLETED
- [x] **Domain Authority Establishment**: Assets Lambda authority over component views ✅ COMPLETED
- [x] **Ephemera Migration**: Complete migration from WML to Assets events ✅ COMPLETED
- [x] **Ephemera Asset Caching Removal**: Core functionality removed, defers to Assets Lambda ✅ COMPLETED
- [ ] **Legacy Code Cleanup**: Remove remaining WML event handling and references
- [ ] **Performance Optimization**: Ensure new event flow performance
- [ ] **Comprehensive Testing**: Full system validation after migration
