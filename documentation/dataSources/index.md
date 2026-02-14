# Data Sources

Each *Data Source* in the MTW ecosystem is a service responsible for a particular data domain. A data source must
have clear definitions for:

- A read-only API outlet or outlets that accepts requests for a message giving the current state of some element of
the domain
- An event-stream that continously publishes changes to the domain, as deltas from the previous state
- A writable API outlet or outlets that accepts request to change the state of some element of the domain

Here are the base Data Sources of Make The World:

- [Players](players/index.md)
- [Assets](assets/index.md)
- [Connections](connections/index.md)
- [Ephemera](ephemera/index.md)
- [Messages](messages/index.md)
- [WML](wml/index.md)
- [Diagnostics](diagnostics/index.md)

To discover all DataSource implementations (serializers, envelope unions, lambda and frontend slices), use the search patterns documented in the [EventBridge](../../packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md#discovering-implementations) and [DataSource](../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) implementation guides.