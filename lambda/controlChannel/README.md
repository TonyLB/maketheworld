---
---

# Control Channel

The Control Channel lambda handles direct communication with players, routing all other function to
and from the websocket connection

---

## Needs Addressed

---

- The application needs to authenticate users before giving them access
- The application needs to record which player is assigned to a specific websocket connection
- The application needs to update the game world when a websocket connection is disconnected
(since it means characters may disconnect from in-play status)
- The application needs to be able to route messages for a character to the connections that
are subscribing to that character

---

## Outlets

- ***$connect***: Authenticates an incoming connection
- ***$disconnect***: Updates the world on a socket disconnect
- ***registercharacter***: Notifies the system that this socket is connecting to one
of the characters the player has permission to play
- ***fetchEphemera***: Either fetches the state of all current global ephemera (maps
and connected characters) or (if passed a CharacterId) fetches the ephemera information
for one specific character.
- ***fetchImportDefaults***: Fetches default names and appearances for a given Asset
(to help display assets imports in the Library editor)
- ***fetchLibrary***: Fetches the top level table-of-contents for the public library
and the player's personal assets
- ***subscribe***: Subscribes the connection to the library
- ***whoAmI***: Returns player information about the player the connection is registered
to
- ***sync***: Given a targetId and startingAt epoch-milliseconds, sends batches of messages
from messageDelta for everything that has been logged by the system for that target
since that start point
- ***directMessage***: Deprecated direct message outlet
- ***action***: Executes the specified action in the game-space
- ***link***: Returns a description of the specified link (if a Feature or Character) or
executes the associated action (if an Action link)
- ***command***: Parses a character-specified command, and if possible executes it
- ***upload***: Returns a pre-signed URL for upload of an asset
- ***uploadImage***: Returns a pre-signed URL for upload of an image
- ***fetch*** Returns a pre-signed URL for download of an asset
- ***checkin***: Moves a personal asset to the Library zone
- ***checkout***: Moves a Library asset to the personal zone

---
