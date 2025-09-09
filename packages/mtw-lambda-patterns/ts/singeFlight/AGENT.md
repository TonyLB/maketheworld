# Stream of consciousness

Here are some responses from ChatGPT from my early design attempts:

| Yes — what you’re describing is a “single-flight” or “request coalescing” problem: multiple callers want the same computation, but you want to run it once and then fan the result back to all the waiting requestors.
| 
| In AWS’s serverless ecosystem there isn’t a single out-of-the-box service that does this, but you can build it with a combination of primitives.

... and ...

| Usage Notes for DynamoDB-based SingleFlight
|
| This implementation is designed for short-running computations where collisions are infrequent.
|
| Best fit conditions:
|
| Expected computation duration: <1 second (low-seconds at most).
|
| Probability of multiple concurrent requests for the same job: low.
|
| Callers require synchronous responses (e.g., API Gateway → Lambda → client).
|
| The cost of occasional polling loops (extra DynamoDB reads + brief Lambda execution time) is acceptable.
|
| Not recommended if:
|
| Computations may take several seconds or more.
|
| High collision rates are expected (e.g., hot keys or bursty workloads).
|
| Asynchronous fan-out or “notify when complete” semantics are acceptable.
|
| In those cases, prefer an async orchestration approach (e.g., DynamoDB Streams + SNS/SQS, Step Functions, or WebSockets).
|
| Summary of solution:
|
| Each request checks DynamoDB for an existing in-progress job keyed by the computation parameters.
|
| If no job exists, the caller creates the record with a conditional write and performs the computation.
|
| Other callers detecting the in-progress record enter a short polling loop (100–300 ms with jitter) until the result field is populated.
|
| Once the leader writes the result, all waiting callers read it and return synchronously.

That said, the `singleFlight` that ChatGPT is envisioning assumes that the results of the execution will be stored alongside
the control record, but I think that most of the patterns in Make The World would lend themselves to a singleFlight that simply
returns true or false, which *side-effects* other distributed data (e.g. Dynamo) in ways that the polling instances could
all read out of the shared store when they receive a successful response.

# DataSource Pattern - Agent Navigation Guide

## Overview

The `SingleFlight` pattern provides a distributed coordination mechanism for preventing duplicate work in AWS serverless environments. This pattern enables multiple concurrent lambda invocations to coordinate around computations that are expensive or unsafe to run concurrently, ensuring that only one instance performs the work while others wait for the result.

## Core Purpose

The SingleFlight pattern addresses three critical needs for distributed coordination in serverless environments:

- **Race Condition Prevention**: Prevent multiple lambda instances from performing computations that could produce incorrect results when run concurrently
- **Duplicate Work Prevention**: Prevent multiple lambda instances from performing the same expensive computation simultaneously
- **Distributed Coordination**: Provide atomic locking mechanisms across lambda instances without requiring external coordination services

## Technical Details

### Core Functionality

#### **1. Instance Creation and Association**
Check for an existing `IN_PROGRESS` instance in the abstract task record. If one exists, associate with that instance and enter Wait-And-Poll mode. If none exists, create a new instance and become the leader. Only one instance should ever be in `IN_PROGRESS` status at a time.

**Purpose**: Ensure only one computation runs at a time while allowing multiple processes to coordinate around the same execution.

#### **2. Instance-Specific Polling and Self-Promotion**
When a lambda instance associates with an existing instance, it polls that specific instance's status. If the instance exceeds its `expiresAt` timeout, the polling instance can self-promote to take over that specific instance.

**Purpose**: Provide synchronous behavior within each instance while handling leader failures gracefully.

#### **3. Instance Result Coordination**
The leader performs the computation and updates its specific instance's status to `COMPLETED`, allowing all instances associated with that specific instance UUID to read the result and return synchronously.

**Purpose**: Enable all instances associated with the same run to return the same result while only one performs the actual work.

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

### **Basic Usage Pattern**
The singleFlight pattern provides a straightforward wrapper that takes two functions as parameters:

1. **Computation Function**: The expensive computation to perform and store the result
2. **Retrieval Function**: How to fetch the stored result if you're not the lead process

```typescript
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
});
```

### **Key Benefits**
- **Automatic Coordination**: Handles all the DynamoDB coordination logic
- **Race Condition Prevention**: Ensures only one process performs the computation
- **Failure Handling**: Built-in timeout and self-promotion mechanisms
- **Side-Effect Based**: Results stored in external systems, not in coordination records

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
- **Timeout Configuration**: Set appropriate expiration times based on computation complexity
- **Polling Intervals**: Use exponential backoff with jitter to reduce DynamoDB read costs
- **Error Propagation**: Ensure computation errors are properly propagated to waiting processes

## Current State

### **Design Phase**
This initial implementation is currently in the design phase with only the `AGENT.md` documentation completed. The pattern has been designed to address the specific need for Snapshot generation coordination in the dataSource pattern.

### **Planned Implementation**
- **Core singleFlight function**: Generic wrapper with computation and retrieval functions
- **DynamoDB coordination**: Instance-based coordination with nested structure
- **TypeScript interfaces**: Type-safe contracts for singleFlight operations
- **Integration with dataSource**: Snapshot generation coordination

### **Future Enhancements**
- **Metrics and monitoring**: Built-in performance tracking and coordination analytics
- **Configuration options**: Flexible timeout and polling strategies
- **Error handling improvements**: Enhanced retry logic and failure recovery

## Navigation Tips

### Getting Started
1. **Read This Guide**: Understand the core functionality and coordination mechanisms
2. **Review Usage Patterns**: Study the basic usage pattern with computation and retrieval functions
3. **Check Dependencies**: Ensure required AWS services and MTW packages are available
4. **Start Simple**: Begin with basic singleFlight implementation before adding advanced features

### Key Concepts
- **Request Coalescing**: Multiple identical requests are merged into a single execution
- **Instance-Based Coordination**: Each computation run has its own instance with unique UUID
- **Side-Effect Based**: Results stored in external systems, not in coordination records
- **Self-Promotion**: Waiting processes can take over if leader fails or times out
- **Race Condition Prevention**: Ensures computations that could produce incorrect results when run concurrently are properly coordinated

## Development Notes

### **Design Philosophy**
This singleFlight pattern was designed specifically to address the coordination needs of the dataSource pattern's Snapshot generation, but with a generic implementation that can be reused across Make The World's serverless architecture.

### **Key Design Decisions**
- **Instance-Based Coordination**: The nested Instances structure allows multiple runs of the same abstract task to coexist, solving the edge case where Process C starts a new run while Process B is still waiting for Process A's completion
- **Side-Effect Based**: Results are stored in external systems rather than coordination records, enabling the pattern to work with any data storage strategy
- **Self-Promotion**: Built-in failure handling through timeout mechanisms and automatic leader promotion

### **Implementation Strategy**
The pattern is designed as a simple wrapper function that handles all the complex DynamoDB coordination logic while allowing callers to focus on their specific computation and retrieval logic. This approach maximizes reusability while minimizing implementation complexity.

### **Future Considerations**
As the pattern matures, consider adding configuration options for different use cases, enhanced monitoring capabilities, and integration with other Make The World patterns beyond dataSource.
