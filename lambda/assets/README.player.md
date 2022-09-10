---
---

# Player Layer

The Player layer stores quick-fetch denormalizations for each Player of which characters they
are currently authorized to play (i.e. which character files are in their Personal directory)

---

## Needs Addressed

- The system needs to be able to quickly show a player which characters they have the option
of playing
- The system needs to update player assignments as files are moved in the S3 system

---

## Player Storage

*Each player is represented by a record in the assets table*

```ts
    type PlayerAssetCharacter = {
        fileName: string;
        Name: string;
        scopedId: string;
    }

    type PlayerAssetRow = {
        AssetId: `PLAYER#${PlayerID}`;
        DataCategory: 'Meta::Player';
        Characters: Record<string, PlayerAssetCharacter>; // Key is the global ID of the character
    }
```
