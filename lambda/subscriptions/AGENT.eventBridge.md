# EventBridge Configuration for Initialize Subscription Events

## Overview

This document describes the EventBridge configuration required for the enhanced Subscribe API to work with replayable DataSources. The subscriptions lambda publishes Initialize Subscription events that must be routed to the appropriate DataSource lambdas.

## Event Structure

### Initialize Subscription Event Format

```typescript
{
    Source: 'mtw.subscriptions',
    DetailType: 'Initialize Subscription - mtw.assets.contentHeaders',
    Detail: {
        streamKey: 'ASSET#123',
        sessionId: 'SESSION#abc123',
        requestId: 'uuid-for-tracking'
    }
}
```

## EventBridge Rules Configuration

### Rule for mtw.assets.contentHeaders

```yaml
EventBridge Rule:
  Name: InitializeSubscription-mtw-assets-contentHeaders
  EventPattern:
    source:
      - mtw.subscriptions
    detail-type:
      - Initialize Subscription - mtw.assets.contentHeaders
  Target:
    Type: Lambda
    Arn: arn:aws:lambda:region:account:function:mtw-assets-contentHeaders-lambda
```

### Rule for mtw.wml

The WML lambda handles Initialize Subscription for mtw.wml (sidecar snapshot on subscribe). Route the event to the WML lambda, not the assets lambda.

```yaml
EventBridge Rule:
  Name: InitializeSubscription-mtw-wml
  EventPattern:
    source:
      - mtw.subscriptions
    detail-type:
      - Initialize Subscription - mtw.wml
  Target:
    Type: Lambda
    Arn: arn:aws:lambda:region:account:function:mtw-wml-lambda
```

### Rule for mtw.ephemera.thinking.scheduling

```yaml
# EphemeraFunction (template.yaml InitializeThinkingScheduling)
EventBridge Rule:
  EventPattern:
    source:
      - mtw.subscriptions
    detail-type:
      - Initialize Subscription - mtw.ephemera.thinking.scheduling
  Target:
    Type: Lambda
    Arn: EphemeraFunction

# SubscriptionsFunction (template.yaml ThinkingSchedulingJobCompleted)
EventBridge Rule:
  EventPattern:
    source:
      - mtw.ephemera.thinking.scheduling
    detail-type:
      - Job Completed
  Target:
    Type: Lambda
    Arn: SubscriptionsFunction
```

Clients subscribe with `dataSourceKey: mtw.ephemera.thinking.scheduling`, `streamKeys: ['global']`.

## DataSource Integration Pattern

### Lambda Handler Implementation

Each DataSource lambda must handle Initialize Subscription events:

```typescript
// In DataSource lambda (e.g., assets/contentHeaders)
export const handler = async (event: any) => {
    // Handle Initialize Subscription events
    if (event.source === 'mtw.subscriptions' && 
        event['detail-type'] === 'Initialize Subscription - mtw.assets.contentHeaders') {
        
        const { streamKey, sessionId, requestId } = event.detail
        
        // Call DataSource initializeSubscription method
        await contentHeadersDataSource.initializeSubscription({
            sessionId,
            streamKey
        })
        
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                message: 'Initialize Subscription processed',
                requestId,
                streamKey,
                sessionId
            })
        }
    }
    
    // Handle other EventBridge events (existing functionality)
    // ... rest of lambda handler
}
```

### Cycle Prevention

**Critical**: DataSources must NOT subscribe to their own event streams for Initialize Subscription events. This prevents event cycles.

**Safe Pattern**:
- ✅ DataSource receives Initialize events from `mtw.subscriptions`
- ✅ DataSource processes Initialize events and calls `initializeSubscription()`
- ✅ DataSource publishes regular events to EventBridge (not Initialize events)

**Dangerous Pattern** (AVOID):
- ❌ DataSource subscribes to its own event stream
- ❌ DataSource publishes Initialize events back to EventBridge
- ❌ This creates infinite loops

## Deployment Configuration

### SAM Template Example

```yaml
# In template.yaml for each DataSource lambda
InitializeSubscriptionRule:
  Type: AWS::Events::Rule
  Properties:
    Name: InitializeSubscription-${DataSourceName}
    EventPattern:
      source:
        - mtw.subscriptions
      detail-type:
        - Initialize Subscription - ${DataSourceName}
    Targets:
      - Arn: !GetAtt ${DataSourceLambda}.Arn
        Id: InitializeSubscriptionTarget

InitializeSubscriptionPermission:
  Type: AWS::Lambda::Permission
  Properties:
    FunctionName: !Ref ${DataSourceLambda}
    Action: lambda:InvokeFunction
    Principal: events.amazonaws.com
    SourceArn: !GetAtt InitializeSubscriptionRule.Arn
```

## Testing Configuration

### Local Testing

For local testing, you can mock the EventBridge events:

```typescript
// Test event for DataSource lambda
const initializeEvent = {
    source: 'mtw.subscriptions',
    'detail-type': 'Initialize Subscription - mtw.assets.contentHeaders',
    detail: {
        streamKey: 'ASSET#test-123',
        sessionId: 'SESSION#test-session',
        requestId: 'test-request-id'
    }
}
```

### Integration Testing

1. **Subscribe API Test**: Send Subscribe message to subscriptions lambda
2. **EventBridge Verification**: Verify Initialize Subscription event is published
3. **DataSource Processing**: Verify DataSource lambda receives and processes the event
4. **SNS Delivery**: Verify snapshot data is delivered via SNS Feedback

## Monitoring and Troubleshooting

### CloudWatch Logs

Monitor these log patterns:

```
# Subscriptions lambda
"Triggering snapshot initialization for replayable DataSource: mtw.assets.contentHeaders"

# DataSource lambda
"Initialize Subscription processed"

# Error patterns
"Failed to process Initialize Subscription"
"No DataSource found for streamKey"
```

### Metrics to Monitor

- EventBridge rule invocations
- Lambda execution duration for Initialize events
- SNS delivery success rates
- WebSocket message delivery rates

## Security Considerations

- **Source Restriction**: Only `mtw.subscriptions` can publish Initialize Subscription events
- **Target Validation**: EventBridge rules ensure events only go to intended targets
- **Session Isolation**: Each Initialize request is tied to a specific session
- **Request Tracking**: Each request has a unique `requestId` for tracing

## Future Enhancements

- **Batch Processing**: Support multiple stream initialization in single request
- **Priority Queuing**: Prioritize Initialize requests based on client needs
- **Retry Logic**: Automatic retry for failed Initialize requests
- **Cross-Region Support**: Support Initialize requests across AWS regions
