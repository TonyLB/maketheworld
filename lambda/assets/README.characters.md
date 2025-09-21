---
---

# Character Layer

The Character layer stores character information as components within assets, following the new architecture where characters are no longer stored as separate peer objects.

---

## Needs Addressed

- The system needs to be able to list characters in non-personal zones (Library)
- The system needs to be able to reconstruct personal-zone character-player connections
in the case that the player-layer of data is compromised

---

## Character Storage

*Characters are now stored as components within assets, not as separate records*

Characters are represented as `Character` components within asset StandardForm structures:

```ts
    type CharacterComponent = {
        tag: 'Character';
        key: string;
        universalKey: ComponentUUID;
        shortName: string;
        Name: string;
        fileURL?: string; // URL to image for character portrait
        Pronouns?: string;
        // ... other character-specific fields
    }
```

The character data is stored as part of the asset's component data, with the character's universalKey serving as the unique identifier.
