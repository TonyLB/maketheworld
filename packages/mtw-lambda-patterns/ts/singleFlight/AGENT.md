# DataSource Pattern - Agent Navigation Guide

## Overview

The `SingleFlight` pattern provides a distributed coordination mechanism for preventing duplicate work in AWS serverless environments. This pattern enables multiple concurrent lambda invocations to coordinate around computations that are expensive or unsafe to run concurrently, ensuring that only one instance performs the work while others wait for the result.

## Core Purpose

The SingleFlight pattern addresses three critical needs for distributed coordination in serverless environments:

- **Race Condition Prevention**: Prevent multiple lambda instances from performing computations that could produce incorrect results when run concurrently
- **Duplicate Work Prevention**: Prevent multiple lambda instances from performing the same expensive computation simultaneously
- **Distributed Coordination**: Provide atomic locking mechanisms across lambda instances without requiring external coordination services

### Two Modes of Operation

The SingleFlight pattern supports two distinct coordination modes:

1. **Coalesce Mode (default)**: Multiple concurrent requests for the same computation share a single execution and result. When processes arrive concurrently, only one becomes the leader and performs the computation, while others wait and retrieve the shared result.

2. **Sequential Mode**: Multiple concurrent requests are queued and executed independently in order. Each process runs its own computation but waits for earlier processes to complete first, ensuring serialized execution without result sharing.

## Technical Details

### Core Functionality

#### **Coalesce Mode Behavior**

**1. Instance Creation and Association**
Check for an existing `IN_PROGRESS` instance in the abstract task record. If one exists, associate with that instance and enter Wait-And-Poll mode. If none exists, create a new instance and become the leader. Only one instance should ever be in `IN_PROGRESS` status at a time.

**Purpose**: Ensure only one computation runs at a time while allowing multiple processes to coordinate around the same execution.

**2. Instance-Specific Polling and Self-Promotion**
When a lambda instance associates with an existing instance, it polls that specific instance's status. If the instance exceeds its `expiresAt` timeout, the polling instance can self-promote to take over that specific instance.

**Purpose**: Provide synchronous behavior within each instance while handling leader failures gracefully.

**3. Instance Result Coordination**
The leader performs the computation and updates its specific instance's status to `COMPLETED`, allowing all instances associated with that specific instance UUID to read the result and return synchronously.

**Purpose**: Enable all instances associated with the same run to return the same result while only one performs the actual work.

#### **Sequential Mode Behavior**

**1. Instance Creation**
Each process creates its own instance with a unique UUID and timestamp, regardless of whether other instances exist. All instances are added to the coordination record.

**Purpose**: Track each process independently rather than coalescing around a single execution.

**2. Queue-Based Waiting**
After creating its instance, each process polls the coordination record to check for earlier instances (by `createdAt` timestamp) that are still `IN_PROGRESS`. If any exist, the process waits before proceeding.

**Purpose**: Ensure processes execute in the order they arrived, creating a distributed FIFO queue.

**3. Timeout and Cascading Failure Detection**
When a process finds an earlier instance that has exceeded its `expiresAt` timeout, it performs cascading failure detection:
- If only one instance expired: marks it as `FAILED`
- If enough time has passed for all QUEUED instances to have also failed: marks ALL earlier instances as `FAILED` in one atomic batch operation

**Purpose**: Prevent deadlocks when processes die without marking themselves complete. Without cascading detection, a dead QUEUED instance would block the queue forever.

**4. Independent Execution**
Once no earlier instances are `IN_PROGRESS`, the process executes its computation independently and marks its instance as `COMPLETED` (or `FAILED` on error).

**Purpose**: Allow each process to produce its own result without result sharing.

### Data Storage Strategy

#### **Local DynamoDB Table**
Each singleFlight implementation relies upon a local DynamoDB table for distributed coordination. This means that the Primary Key will be variable
(`AssetId`, `EphemeraId`, and so on), but the general pattern will be that all coordination records have a structure of:

- **Primary Key**: `SINGLEFLIGHT#${category}`
- **DataCategory**: Argument hash to uniquely identify computation runs that should be considered the same
- **Instances**: A List of instance objects, each containing:
  - **UUID**: Unique identifier for this specific instance/run
  - **Status**: Current state of this instance (`IN_PROGRESS`, `COMPLETED`, `FAILED`)
  - **createdAt**: Start epoch-moment for this instance
  - **expiresAt**: Timeout epoch-moment for this instance

## Integration Points

### Dependencies
- **AWS DynamoDB**: Local storage for coordination records and instance tracking
- **MTW Interfaces**: Type-safe message contracts for singleFlight operations
- **MTW Utilities**: Common utilities and helpers for UUID generation and time handling

### Cross-References
- **[DataSource Pattern](../dataSource/AGENT.md)**: Primary current use case for Snapshot generation coordination
- **[Lambda Development Guide](../../../AGENT.development.md)**: General lambda patterns and development practices
- **[Architecture Philosophy](../../../AGENT.architecture.philosophy.md)**: System design principles and cost optimization

## Usage Patterns

### **Coalesce Mode (Default)**
The coalesce mode is ideal for expensive computations where multiple concurrent requests can share the same result:

```typescript
const singleFlight = singleFlightFactory({ 
    optimisticUpdateFunction, 
    getItemFunction, 
    primaryKey,
    timeoutMs: 30000, // 30 second timeout for snapshot generation
    mode: 'coalesce' // Default, can be omitted
})
const result = await singleFlight({
    category: 'snapshot-generation',
    argumentHash: computeArgumentHash(params),
    computation: async () => {
        // Perform expensive computation
        const result = await generateSnapshot(params);
        // Store result in external data store
        await storeSnapshot(result);
        return result;
    },
    retrieval: async () => {
        // Fetch result from external data store
        return await fetchSnapshot(params);
    }
})
```

**Use coalesce mode when:**
- Multiple concurrent requests want the same result
- The computation is expensive and should only run once
- Results are naturally shareable (e.g., snapshot generation, cache warming)
- You need to minimize redundant work

### **Sequential Mode**
The sequential mode ensures operations execute in order, one at a time, without sharing results:

```typescript
const atomicEdit = singleFlightFactory({ 
    optimisticUpdateFunction: assetDB.optimisticUpdate,
    getItemFunction: assetDB.getItem,
    primaryKey: 'AssetId',
    timeoutMs: 5000,
    mode: 'sequential'
})
const result = await atomicEdit({
    category: 'wml-edit',
    argumentHash: AssetId,
    computation: async () => {
        // Apply the edit operation
        const result = await applyEdit(AssetId, editData);
        return result;
    }
    // No retrieval callback needed - each process runs independently
})
```

**Use sequential mode when:**
- Operations must execute one-at-a-time to prevent conflicts
- Each operation produces different results (not shareable)
- Order of execution matters
- You need mutual exclusion / atomic locking behavior
- Operations modify shared state

### **Key Benefits**
- **Automatic Coordination**: Handles all the DynamoDB coordination logic
- **Race Condition Prevention**: Ensures safe concurrent access to shared resources
- **Failure Handling**: Built-in timeout and self-promotion mechanisms
- **Side-Effect Based**: Results stored in external systems, not in coordination records
- **Flexible Modes**: Choose between result sharing (coalesce) or ordered execution (sequential)

## Development Guidelines

### Implementation Requirements
- **Type Safety**: Full TypeScript integration with generic computation and retrieval functions
- **Error Handling**: Graceful degradation and retry logic for DynamoDB operations
- **Performance**: Efficient polling intervals with jitter to prevent thundering herd
- **Timeout Management**: Configurable expiration times based on expected computation duration

### Testing Strategy
- **Unit Tests**: Individual method functionality and edge cases
- **Integration Tests**: DynamoDB coordination and instance management
- **Concurrency Tests**: Multiple processes competing for the same computation
- **Failure Scenarios**: Leader failures, timeout handling, and self-promotion
- **Performance Tests**: Polling efficiency and coordination overhead

### Best Practices
- **Argument Hashing**: Use consistent, collision-resistant hashing for computation identification
- **Timeout Configuration**: Set appropriate expiration times based on computation complexity (in sequential mode, this applies only to actual execution, not queue wait time)
- **Polling Intervals**: Use exponential backoff with jitter to reduce DynamoDB read costs
- **Error Propagation**: Ensure computation errors are properly propagated to waiting processes
- **Cascading Failure Recovery**: Sequential mode automatically detects and recovers from cascading failures where multiple queued processes die, preventing permanent queue deadlock

## Current State

### **Implemented**
The singleFlight pattern is fully implemented and tested with both coalesce and sequential modes:

- **Core singleFlight function**: Generic wrapper with computation and optional retrieval functions
- **DynamoDB coordination**: Instance-based coordination with nested structure
- **TypeScript interfaces**: Type-safe contracts for singleFlight operations
- **Coalesce mode**: Result-sharing coordination for expensive computations (used by dataSource pattern)
- **Sequential mode**: Queue-based execution for atomic operations
- **Instance cleanup**: Opportunistic removal of old COMPLETED/FAILED instances to prevent unbounded growth
- **Comprehensive tests**: Full test coverage for both modes including edge cases

### **Current Usage**
- **DataSource pattern**: Uses coalesce mode for snapshot generation coordination
- **WML edits**: Uses sequential mode for concurrency control

### **Future Enhancements**
- **Enhanced coordination**: Additional coordination patterns and use cases
- **Metrics and monitoring**: Built-in performance tracking and coordination analytics
- **Configuration options**: Additional timeout and polling strategies
- **Error handling improvements**: Enhanced retry logic and failure recovery

## Navigation Tips

### Getting Started
1. **Read This Guide**: Understand the core functionality and coordination mechanisms
2. **Review Usage Patterns**: Study the basic usage pattern with computation and retrieval functions
3. **Check Dependencies**: Ensure required AWS services and MTW packages are available
4. **Start Simple**: Begin with basic singleFlight implementation before adding advanced features

### Key Concepts
- **Request Coalescing** (coalesce mode): Multiple identical requests are merged into a single execution
- **Sequential Execution** (sequential mode): Multiple requests are queued and executed independently in order
- **Instance-Based Coordination**: Each computation run has its own instance with unique UUID
- **Side-Effect Based**: Results stored in external systems, not in coordination records
- **Self-Promotion**: Waiting processes can take over if leader fails or times out
- **Race Condition Prevention**: Ensures computations that could produce incorrect results when run concurrently are properly coordinated
- **Distributed FIFO Queue** (sequential mode): Processes execute in the order they arrived using timestamp-based ordering

## Development Notes

### **Design Philosophy**
This singleFlight pattern was originally designed to address the coordination needs of the dataSource pattern's Snapshot generation, but evolved into a generic distributed coordination primitive that serves two distinct use cases: result sharing (coalesce mode) and mutual exclusion (sequential mode).

### **Key Design Decisions**
- **Instance-Based Coordination**: The nested Instances structure allows multiple runs of the same abstract task to coexist, solving the edge case where Process C starts a new run while Process B is still waiting for Process A's completion
- **Side-Effect Based**: Results are stored in external systems rather than coordination records, enabling the pattern to work with any data storage strategy
- **Self-Promotion**: Built-in failure handling through timeout mechanisms and automatic leader promotion
- **Dual Modes**: Adding sequential mode recognizes that both result-sharing and mutual-exclusion are fundamentally about distributed coordination, using nearly identical DynamoDB primitives

### **Implementation Strategy**
The pattern is designed as a simple wrapper function that handles all the complex DynamoDB coordination logic while allowing callers to focus on their specific computation and (optionally) retrieval logic. Both modes share the same instance management, timeout handling, and self-promotion mechanisms, differing only in how they coordinate execution order and result handling.

### **Future Considerations**
The sequential mode has successfully replaced the atomicLock pattern and Step Function orchestration for WML edits, simplifying the architecture while maintaining the same coordination guarantees. This unification reduces code duplication and provides a single, well-tested coordination primitive for the entire system.
