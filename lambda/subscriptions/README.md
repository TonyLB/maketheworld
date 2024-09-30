# Subscriptions data connector

The subscriptions lambda provides a configurable data connector from EventBridge streams to websocket
connections.

## Dependencies

The subscriptions data connector is directly coupled to the underlying data representation in
the connections data source (for performance purposes).

The connector also subscribes to the following data sources:
- Assets

## Websockets

The data connector relays subscribed messages to their subscribing Websocket sessions. That's its job.
It has no other data outlets.

## API Outlets

The data connector has the following outlets for controlling subscription and filtering:
- subscribe
- unsubscribe

## Internal format

Subscriptions are stored in the `connections` DynamoDB table. A subscription of `SESSION#ABC` to
a stream `X` filtering on detail element `Y` is represented by an object with:

> ConnectionId: `STREAM#X::Y`
>
> DataCategory: `SESSION#ABC`