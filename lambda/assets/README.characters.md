---
---

# Character Layer

The Character layer stores registry information connecting character WML files and the
global IDs with which they are associated.

---

## Needs Addressed

- The system needs to be able to list characters in non-personal zones (Library)
- The system needs to be able to reconstruct personal-zone character-player connections
in the case that the player-layer of data is compromised

---

## Character Storage

*Each character is represented by a record in the assets table*

```ts
    type CharacterAssetRow = {
        AssetId: `CHARACTER#${CharacterID}`;
        DataCategory: 'Meta::Character';
        address: AssetWorkspaceAddress;
        Name: string;
        fileURL: string; // URL to image for character portrait
        scopedId: string;
    }
```
