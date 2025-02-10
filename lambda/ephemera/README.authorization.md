---
---

# Ephemera Authorization

The Authorization sub-system of the Ephemera data product handles requests and updates regarding
authorization for players to resources.

---

## Needs Addressed

---

- The application needs to be able to list the characters that a player has permission to play
- The application needs to be able to list characters in a given set of Assets that are _available_
for being adopted (i.e., nobody has current availability to play them)

---

## Outlets

- ***playerCharacters***: Provides an immediate and direct checkpoint on the characters that
the requesting player has authorization to play
- ***fetchEphemera***: Either fetches the state of all current global ephemera (maps
and connected characters) or (if passed a CharacterId) fetches the ephemera information
for one specific character.
- ***fetchImportDefaults***: Fetches default names and appearances for a given Asset
(to help display assets imports in the Library editor)
- ***fetchLibrary***: Fetches the top level table-of-contents for the public library
and the player's personal assets
- ***whoAmI***: Returns player information about the player the connection is registered
to
- ***sync***: Given a targetId and startingAt epoch-milliseconds, sends batches of messages
from messageDelta for everything that has been logged by the system for that target
since that start point
- ***action***: Executes the specified action in the game-space
- ***link***: Returns a description of the specified link (if a Feature or Character) or
executes the associated action (if an Action link)
- ***command***: Parses a character-specified command, and if possible executes it

---

## Streams

- ***characterAuthorizationAdded***: An authorization has been added for a player to
play a specific character
- ***characterAuthorizationRemoved***: An authorization has been removed for a player
to play a specific character

---
---
