---
---

# Character Layer

---

## Needs Addressed

- Needs to be able to fetch all information needed to render a character, organized
by the conditionals that could change whether each piece of information is (or isn't) relevant
at the moment
- Needs to be able to fetch the state/attributes of a character
- Needs to be able to fetch a list of all characters a player can play
- Needs to be able to quickly fetch a list of all connections that should subscribe to events
perceived by this character

---

## <Character\> meta-records

*For any Character a record will be stored for the given EphemeraID, storing both the description of*
*the character and any state information*

### *Key Data*

```ts
    type CharacterEphemeraPronouns = {
        subject: string;
        object: string;
        possessive: string;
        adjective: string;
        reflexive: string;
    }

    type CharacterEphemeraRow = {
        EphemeraId: string; // `CHARACTER#${CharacterDBId}
        DataCategory: 'Meta::Character';
        address: AssetWorkspaceAddress;
        Name: string;
        Pronouns: CharacterEphemeraPronouns;
        FirstImpression: string;
        OneCoolThing: string;
        Outfit: string;
        Color: 'blue' | 'purple' | 'green' | 'pink';
        fileURL: string; // URL to cached icon image
        Connected: boolean;
        ConnectionIds: string[];
        RoomId: string;
    }
```

---
---