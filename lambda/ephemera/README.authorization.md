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
- ***availableCharacters***: Provides an immediate and direct checkpoint on the characters
that are available for request in a given asset

---

## Streams

- ***availableCharacterAdded***: A character has been made available (either by being added
in an asset, or by having a prior grant revoked)
- ***availableCharacterRemoved***: A character has been made unavailable (either by being
deleted in an asset, or by having a grant approved for some player)

---
---
