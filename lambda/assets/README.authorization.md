---
---

# Asset Authorization

The Authorization sub-system of the Asset data product handles requests and updates regarding
authorization for players to resources.

---

## Needs Addressed

---

- Other data products (Ephemera) need to subscribe to these events:
    - characterAdded
    - characterChanged
    - characterRemoved
    - characterAuthorizationGranted
    - characterAuthorizationRevoked

---

## Outlets

- ***assetAuthorizations***: Provides an immediate and direct checkpoint on the authorizations
granted on a given asset
- ***grantCharacterAuthorization***: Accepts a player name and grants authorization to the
character
- ***revokeCharacterAuthorization***

---

## Streams

- ***characterAuthorizationGranted***: An authorization has been added for a player to
play a specific character
- ***characterAuthorizationRevoked***: An authorization has been removed for a player
to play a specific character

---
---
