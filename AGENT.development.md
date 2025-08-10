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
**Duration Estimate**: 6-8 weeks  
**Risk Level**: High  
**Goal**: Systematically remove programming-language-based authoring system

**Sub-Phase Breakdown**:
- **Phase 2A**: Remove Ephemera Usage (1-2 weeks) - ✅ **COMPLETED**
- **Phase 2B**: Dependencies Properties Assessment (1-2 weeks) - *(To be determined)*
- **Phase 2C**: Frontend Component Analysis (1-2 weeks) - ✅ **TASKS DEFINED**
- **Phase 2D**: WML Parser and Schema Analysis (1-2 weeks) - *(To be determined)*  
- **Phase 2E**: Asset Content and Storage Analysis (1-2 weeks) - *(To be determined)*
- **Phase 2F**: Deprecate Tags from Storage Systems (2-3 weeks) - *(To be determined)*

#### **Objectives**
- Document all Variable/Computed/Action dependencies
- Determine which pieces of *generic* functionality might later be useful to LLM-state: document and archive
- Remove Variable dependency cascade logic
- Remove Action execution system
- Remove Condition tag support
- Create temporary "static content" fallback for dynamic behavior

#### **Key Tasks**

##### **Phase 2A: Remove Ephemera Usage** *(1-2 weeks)*
- [x] **Remove stateMapping Properties**: Remove all `stateMapping` properties, `EphemeraStateMappingMixin` type, and update dependency logic to no longer process Variable/Computed state dependencies ✅ **COMPLETED**
- [x] **Broader Dependency Re-analysis**: Complete audit of remaining Variable/Computed/Action usage patterns across entire codebase ✅ **COMPLETED**

##### **Phase 2B: Dependencies Properties Assessment** *(1-2 weeks)*
- [ ] **Cross-System Dependencies Audit**: Assess whether `dependencies` properties have value outside of Variable/Computed/Action/Condition system
- [ ] **Storage System Dependencies Review**: Review S3, DynamoDB, and cache systems for `dependencies` property usage
- [ ] **StandardForm/StandardComponent Analysis**: Analyze StandardForm/StandardComponent subsystem for `dependencies` property patterns
- [ ] **Dependency Value Assessment**: Determine if `dependencies` properties serve any purpose beyond legacy calculation sandboxes
- [ ] **Removal Planning**: If not valuable, identify clean removal points in each affected system
- [ ] **State Management Impact Analysis**: Assess impact of removing `dependencies` properties on overall state management

##### **Phase 2C: Frontend Component Analysis** *(1-2 weeks)*
**Context**: Frontend components contain varying levels of dynamic information handling and legacy Variable/Computed/Action system integration.

**High-Priority Components Identified**:
- **Static Content Components**: Messages and in-play communications (generally static, minimal changes needed)
- **Dynamic Content Components**: Authorship components and communications (frequent dynamic information handling)
- **Conditional Rendering Components**: `ListWithConditions`, `IfElseTree` (explicit condition handling)
- **Authoring Tools**: `Library/Edit` directory components (Variable/Computed/Action authoring tools)
- **JavaScript Editing Components**: `JSEdit`, `JSHeader` (to be removed entirely)
- **Complex Layer Components**: `components/Maps` directory (complicated layer handling with Conditions)

**Key Analysis Areas**:
- [ ] **RenderTree/StandardRender Analysis**: Audit `link` elements referencing Action components and remove special handling
- [ ] **Authorship Component Audit**: Identify and document all dynamic information handling patterns
- [ ] **Conditional Component Analysis**: Analyze `ListWithConditions`, `IfElseTree` for condition-specific logic
- [ ] **Library/Edit System Review**: Document authoring tools for Variable/Computed/Action components
- [ ] **Maps Component Documentation**: Full documentation of Maps subdirectory to understand condition entanglement
- [ ] **JavaScript Editing Removal**: Remove `JSEdit` and `JSHeader` components entirely
- [ ] **Component Interface Updates**: Update component props and interfaces to remove legacy dependencies
- [ ] **Frontend Test Updates**: Update frontend test suites to reflect new component interfaces
- [ ] **UI Behavior Migration**: Convert dynamic UI behaviors to static or example-driven patterns

##### **Phase 2D: WML Parser and Schema Analysis** *(To be determined)*
- [ ] **WML Parser Dependency Audit**: Review WML parser for Variable/Computed/Action tag handling
- [ ] **Schema Validation Review**: Analyze all schema validation layers for deprecated tag support
- [ ] **Import/Export System Review**: Review asset import/export systems for legacy tag handling
- [ ] **WML Processing Pipeline**: Audit WML processing pipeline for Variable/Computed/Action dependencies
- [ ] **Parser Test Suite Updates**: Update WML parser tests to reflect new tag restrictions

##### **Phase 2E: Asset Content and Storage Analysis** *(To be determined)*
- [ ] **Asset Content Analysis**: Identify all assets using Variable/Computed/Action/Condition tags
- [ ] **Storage System Audit**: Review S3, DynamoDB, and cache systems for deprecated tag representations
- [ ] **Migration Strategy Development**: Develop approach for converting existing dynamic content to static/example-driven
- [ ] **Content Backup Planning**: Plan comprehensive backup strategy for assets containing deprecated tags
- [ ] **Migration Tool Design**: Design tools to remove deprecated tags from existing assets

##### **Phase 2F: Deprecate Tags from Storage Systems**
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
- All frontend components have been updated to remove legacy dependencies
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

#### **Task Management and Progress Tracking**
- **Phase 2B Tasks**: Create detailed tasks for dependencies properties assessment once Phase 2A dependency re-analysis is complete
- **Phase 2C Tasks**: ✅ **COMPLETED** - Detailed frontend component analysis tasks defined with specific component priorities
- **Phase 2D Tasks**: Create detailed tasks for WML parser analysis after understanding scope of frontend dependencies
- **Phase 2E Tasks**: Create detailed tasks for asset content analysis after understanding scope of parser dependencies
- **Progressive Refinement**: Each sub-phase should refine the task list for subsequent sub-phases based on actual findings
- **Dependency Discovery**: Use each sub-phase to identify additional dependencies that may affect later phases

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
Phase 2: Variable/Computed/Action Removal (6-8 weeks)
    ↓
Phase 3: Asset Caching Migration (3-4 weeks)
    ↓
Phase 4: LLM-Mediated System (6-8 weeks)

Remaining Estimated Duration: 13-20 weeks
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

## Next Steps

### **Immediate Actions**
1. **Phase 2A ✅ COMPLETED**: Broader dependency re-analysis completed, revealing need for Phase 2B dependencies properties assessment
2. **Create Phase 2B Tasks**: Based on dependency analysis, create detailed tasks for dependencies properties assessment
3. **Validate Migration Sequence**: Review this plan with key stakeholders
4. **Resource Planning**: Ensure development capacity for estimated timeline

### **Next Steps for Phase 2B-2F**
1. **Progressive Task Creation**: Create detailed task lists for each sub-phase as dependencies become clear
2. **Dependency Discovery**: Use each completed sub-phase to inform planning for subsequent phases
3. **Task Refinement**: Continuously refine task lists based on actual findings during implementation
4. **Risk Assessment Updates**: Update risk assessments as new dependencies are discovered

### **Planning Refinements**
1. **Task Breakdown**: Each phase needs detailed task breakdowns with estimates
2. **Risk Mitigation Plans**: Develop specific mitigation strategies for identified risks
3. **Testing Strategies**: Define comprehensive testing approaches for each phase
4. **Success Criteria**: Refine success criteria with specific, measurable outcomes

---

## **Future Architectural Improvements**
*Post-Migration Technical Debt*

### **Component UUID Type System Refactor**
**Context**: Current type guards like `isEphemeraKnowledgeId` perpetuate legacy assumption that `ComponentUUID` records are Ephemera-specific. Modern architecture has `ComponentUUID` records created across multiple system boundaries, requiring more generic type validation approaches.

**Future Tasks**:
- [ ] **Relocate Ephemera Type Guards**: Move `isEphemera*` type guards to more generic locations
- [ ] **Refactor Legacy Assumptions**: Remove assumption that `ComponentUUID` records originate specifically from Ephemera operations  
- [ ] **Generic Type Guard System**: Create component-agnostic type guards that work across all system boundaries
- [ ] **Update Import Patterns**: Refactor imports to reflect new, more generic type guard locations

**Impact**: Currently low-impact technical debt, but will become more important as other services (Assets, WML, client-side) create more `ComponentUUID` records outside of Ephemera context.

---

*This document serves as the master coordination point for the major architectural migration work. It should be updated regularly as planning progresses and work begins.*
