# Connections Data Source

The connections lambda supports a Data Source for information about websocket sessions that have
registered to maintain ongoing bidirectional contact with the MTW system.

## Dependencies

The connections data source depends upon no other data sources. All changes in its data occur due to calls to its
API outlets.

## API Outlets

Connections data source has four **anonymously available** API outlets:
- signIn: Validates a userName and password against Cognito store and (if valid) returns
an accessToken, idToken and refreshToken
- signUp: Accepts a userName, password, and an inviteCode. If the inviteCode is valid then
it creates a new Cognito user and marks the inviteCode is used
- accessToken: Takes a valid refresh token and returns a new accessToken
- validateInvitation: Validates an inviteCode without using it

Connections data source also has **internal** API outlets accessible only to internal
processes:
- generateInvitation: Generates and logs an invitation code
- dropConnection: Drops a single websocket connection from its associated session
- checkSession: Checks a session and, if it has no active websocket connections,
cleans up its associated data

## Stream outlets

Connections data source publishes a stream under source **mtw.connections**. The stream
has the following detail-types of events:
- Session Connect: Published when a new session is connected
- Session Disconnect: Published when a session is removed
- Player Connect: Published when a player who previously had no sessions connected connects
a first new session
- Player Disconnect: Published when a player who previously had sessions connected disconnects
their last session

## Tightly coupled data

In the interest of performance, the **ephemera** and **subscriptions** data sources each *directly couple*
to the internal structure of the connections data source. Yes, this causes some architectural complexity, but
it also saves a great deal of latency on time-critical user-response paths. The trade-off is judged worth
it in support of clean and responsive UX.
