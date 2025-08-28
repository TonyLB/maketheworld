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
Phase 1: Message Format ✅ COMPLETED
    ↓
Phase 2: Variable/Computed/Action Removal ✅ COMPLETED
    ↓
Phase 3: Asset Caching Migration (3-4 weeks)
    ↓
Phase 4: LLM-Mediated System (6-8 weeks)

Remaining Estimated Duration: 9-12 weeks
```

### **Critical Path**
The phases must be completed in order due to hard dependencies:
- **Phase 1 ✅ COMPLETED**: Consistent message format foundation established
- **Phase 2 → Phase 3**: Asset caching dependencies must be removed before migration
- **Phase 3 → Phase 4**: Clean domain authority needed before implementing new AI-mediated patterns

### **Parallel Work Opportunities**
Some tasks can be done in parallel across phases:
- Documentation updates can happen throughout
- Design work for later phases can begin during earlier phases
- Testing framework improvements can be incremental

## Success Metrics

### **Technical Success**
- [x] **Message Format Standardization**: All perception messages use unified WML/Standard format with strongly-typed metadata ✅ COMPLETED
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

### **Phase 3: Validation and Cleanup** ⏳ **PENDING (0%)**
- [ ] **Comprehensive Testing**: Full system validation after migration
- [ ] **Performance Analysis**: Measure impact of removal on system performance
- [ ] **Documentation Updates**: Update all system documentation to reflect new architecture
