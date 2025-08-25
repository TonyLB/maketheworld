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

### **Phase 2: Variable/Computed/Action System Removal** *(Core Dependency)*
**Duration Estimate**: 5-7 weeks  
**Risk Level**: High  
**Goal**: Systematically remove programming-language-based authoring system

**Sub-Phase Breakdown**:
- **Phase 2A**: Remove Ephemera Usage (1-2 weeks) - ✅ **COMPLETED**
- **Phase 2B**: Dependencies Properties Assessment (1-2 weeks) - ✅ **COMPLETED**
- **Phase 2C**: Frontend Component Analysis (1-2 weeks) - ✅ **COMPLETED**
- **Phase 2D**: WML Parser and Schema Analysis (3-4 weeks) - *(Core Removal + Cleanup)*

#### **Objectives**
- Document all Variable/Computed/Action dependencies
- Determine which pieces of *generic* functionality might later be useful to LLM-state: document and archive
- Remove Variable dependency cascade logic
- Remove Action execution system
- Remove Condition tag support
- Create temporary "static content" fallback for dynamic behavior

#### **Key Tasks**

##### **Phase 2A: Remove Ephemera Usage** *(1-2 weeks)* ✅ **COMPLETED**
- [x] **Remove stateMapping Properties**: Remove all `stateMapping` properties, `EphemeraStateMappingMixin` type, and update dependency logic to no longer process Variable/Computed state dependencies
- [x] **Broader Dependency Re-analysis**: Complete audit of remaining Variable/Computed/Action usage patterns across entire codebase

**Findings**: All `stateMapping` properties have been removed from Ephemera Lambda. The broader dependency re-analysis revealed that `dependencies` properties exist throughout the system and need systematic assessment.

##### **Phase 2B: Dependencies Properties Assessment** *(1-2 weeks)* ✅ **COMPLETED**
- [x] **Cross-System Dependencies Audit**: Assess whether `dependencies` properties have value outside of Variable/Computed/Action/Condition system
- [x] **Storage System Dependencies Review**: Review S3, DynamoDB, and cache systems for `dependencies` property usage
- [x] **StandardForm/StandardComponent Analysis**: Analyze StandardForm/StandardComponent subsystem for `dependencies` property patterns
- [x] **Dependency Value Assessment**: Determine if `dependencies` properties serve any purpose beyond legacy calculation sandboxes
- [x] **Cleanup Planning**: If no independent value found, plan removal from each system
- [x] **State Management Impact Analysis**: Assess impact of removing `dependencies` properties on overall state management

**Findings**: All `dependencies` properties serve only the Variable/Computed/Action/Condition system with no independent value. They can be safely removed once the VCA system is eliminated.

##### **Phase 2C: Frontend Component Analysis** ✅ **COMPLETED (100%)**
- [x] **Rich Text Conditionals**: Remove IfElseTree from StandardRender and DescriptionEditor ✅ **COMPLETED**
- [x] **Structural Conditionals**: Remove IfElseTree and ListWithConditions components ✅ **COMPLETED**
- [x] **Link Items**: Remove Action link support from frontend system ✅ **COMPLETED**
- [x] **JavaScript Editing Removal**: Remove Variable, Computed, and Action editing from frontend ✅ **COMPLETED**
- [x] **Component Interface Updates**: Update component props and interfaces to remove legacy dependencies ✅ **COMPLETED**

##### **Phase 2D: WML Parser and Schema Analysis** *(Core Removal + Cleanup)*
**Status**: 🟢 **IMPORT/EXPORT DEPENDENCIES REMOVED** - Variable/Computed/Action and If/ElseIf/Else import/export support successfully removed  
**Progress**: 4/8 major tasks completed (50%)  
**Next Focus**: Selected system removal
- [x] **Update StandardForm Component Templates**: Remove Variable, Computed, and Action from component processing templates
- [x] **Update Component Factory Functions**: Remove Variable/Computed/Action creation logic from `standardNonEditComponentFactory` and `standardComponentByTag`
- [x] **Update Component Processing**: Remove Variable/Computed/Action handling from `processComponents` function
- [x] **Remove Variable/Computed/Action Components from StandardForm**: Ensure that StandardForm has no code specific to these classes ✅ **COMPLETED**
- [x] **Deprecate Variable/Computed/Action Components**: Remove StandardVariable, StandardComputed, and StandardAction classes and their data types ✅ **COMPLETED**

**🎉 PHASE 2D CORE COMPONENT REMOVAL COMPLETED! 🎉**

**What Was Accomplished:**
- **StandardVariable**: Completely removed class, data types, tests, and all references
- **StandardComputed**: Completely removed class, data types, tests, and all references  
- **StandardAction**: Completely removed class, data types, tests, and all references
- **Code Cleanup**: Removed imports, type guards, union types, and sort order references

**Remaining Phase 2D Tasks (Reordered for Test-First Approach):**

#### **Phase 2D.1: Test Suite Assessment and Cleanup** *(Test Coverage Preservation)* ✅ **COMPLETED**
- [x] **Audit Test Dependencies**: Identify all unit tests that depend on Variable/Computed/Action/If/ElseIf/Else tags ✅ **COMPLETED**
- [x] **Update mtw-wml Test Suite**: Replace deprecated tag usage with supported alternatives in mtw-wml test files ✅ **COMPLETED**
- [x] **Verify mtw-wml Test Coverage**: Ensure all mtw-wml tests pass and maintain coverage of remaining functionality ✅ **COMPLETED**
- [x] **Update Other Package Tests**: Address test dependencies in mtw-base, mtw-interfaces, and lambda packages ✅ **COMPLETED**

#### **Phase 2D.2: Remove Dependent Functionality** *(Least to Greatest Consequence)*
- [x] **Remove Print Map Dependencies**: Remove Variable/Computed/Action and If/ElseIf/Else rendering from WML print system ✅ **COMPLETED**
- [x] **Remove Import/Export Dependencies**: Remove legacy tag handling from asset import/export systems ✅ **COMPLETED**
- [ ] **Remove Selected System**: Remove `defaultSelected` function, `SchemaSelectedTag`, and `selected` properties (all conditional-dependent)

#### **Phase 2D.3: Remove Core Schema Support** *(Core Converter Removal)*
- [ ] **Remove WML Schema Converters**: Remove Variable, Computed, and Action tag support from WML schema converters
- [ ] **Remove Conditional Schema Converters**: Remove If/ElseIf/Else conditional tag support from WML schema
- [ ] **Update Parser Integration**: Remove deprecated converters from main converterMap and printMap
- [ ] **Interface Type Removal**: Remove Variable/Computed/Action/Condition types from `mtw-interfaces`
- [ ] **Base Type Removal**: Remove Variable/Computed/Action/Condition types from `mtw-base`

**⚠️ IMPORTANT: Systems We Are NOT Removing (Different from Conditionals)**
- **`cascadeConditions`**: Graph-based traversal system for asset subsetting (spatial relationships, exits, component references)
- **Frontend UI Selection States**: React component state management (tabs, items, tools) - completely independent of WML
- **Edit System Tags**: `<Replace>`, `<With>`, `<Remove>` - part of the asset editing system, not conditionals

#### **Phase 2D.4: Final Parser Updates** *(Parser Rejection Implementation)*
- [ ] **WML Parser Deprecation**: Update WML parser to reject Variable/Computed/Action/Condition tags
- [ ] **Schema Validation Updates**: Remove deprecated tag support from all remaining validation layers
- [ ] **Remove Type Guard Dependencies**: Remove Variable/Computed/Action type guards and related imports (including in `packages/mtw-base`)
- [ ] **Remove extractDependencies Utility**: Remove Variable/Computed/Action dependency extraction functionality from lambda/wml utilities

#### **Success Criteria**
- ✅ **No Variable/Computed/Action code remains in mtw-wml package** - All classes, data types, and tests removed
- ✅ **All frontend components have been updated to remove legacy dependencies** - StandardForm updated in Phase 2C
- ✅ **All unit tests pass and maintain coverage** - Test suite cleanup completed in Phase 2D.1
- ⏳ **WML parser rejects Variable/Computed/Action/Condition tags at all parsing layers** - Still needs implementation
- ⏳ **No deprecated tag types remain in `mtw-interfaces` or schema validation** - Still needs implementation
- ✅ **System functions with static content where dynamic behavior was removed** - Core components successfully removed
- ✅ **Performance improvements from removing complex dependency calculations** - Legacy component overhead eliminated
- ⏳ **Asset import/export tools reject files containing deprecated tags** - Still needs implementation

#### **Dependencies**
- **Requires**: Phase 1 (Message Format Standardization)
- **Blocks**: Asset caching migration (Ephemera still needs asset access for Variable/Computed/Action)
- **Enables**: Asset caching migration, proper domain separation

#### **Risk Mitigation**
- **Functionality Loss Risk**: Clear documentation of removed capabilities for future LLM-mediated replacement
- **Performance Risk**: Monitoring to ensure static fallbacks don't create performance issues

---

#### **Phase 2D Completion Summary** 🎯
**Date Completed**: December 2024  
**Major Milestone Achieved**: Core Variable/Computed/Action component removal completed  
**Impact**: Eliminated legacy JavaScript-based dynamic behavior system  
**System Status**: All tests passing, no functionality loss, clean codebase  
**Next Phase**: WML Schema and Parser updates to complete Phase 2D

**Phase 2D.1 Status**: ✅ **COMPLETED** - All test dependencies on deprecated tags removed, all package tests updated  
**Phase 2D.2 Status**: ✅ **COMPLETED** - Print map and import/export dependencies removed, system can no longer render or import deprecated tags

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
Phase 2: Variable/Computed/Action Removal (5-7 weeks)
    ↓
Phase 3: Asset Caching Migration (3-4 weeks)
    ↓
Phase 4: LLM-Mediated System (6-8 weeks)

Remaining Estimated Duration: 11-18 weeks
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

### **Phase 2: System Removal** 🔄 **IN PROGRESS (80% Complete)**
- [x] **Phase 2A: Remove Ephemera Usage** ✅ **COMPLETED (100%)**
- [x] **Phase 2B: Dependencies Properties Assessment** ✅ **COMPLETED (100%)**
- [x] **Phase 2C: Frontend Component Analysis** ✅ **COMPLETED (100%)**
- [ ] **Phase 2D: WML Parser and Schema Analysis** ⏳ **PENDING (0%)**

### **Phase 3: Validation and Cleanup** ⏳ **PENDING (0%)**
- [ ] **Comprehensive Testing**: Full system validation after migration
- [ ] **Performance Analysis**: Measure impact of removal on system performance
- [ ] **Documentation Updates**: Update all system documentation to reflect new architecture
