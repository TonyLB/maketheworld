# Data Sources

Each *Data Source* in the MTW ecosystem is a service responsible for a particular data domain. A data source must
have clear definitions for:

- A read-once API outlet or outlets that accepts requests for a message giving the current state of some element of
the domain
- An event-stream that continously publishes changes to the domain, as deltas from the previous state
- A writable API outlet or outlets that accepts request to change the state of some element of the domain

Here are the base Data Sources of Make The World:

- Assets
- Connections
- Ephemera
- WML