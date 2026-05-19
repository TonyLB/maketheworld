# Standard Components - Usage Patterns

## Overview

This document provides practical code examples for working with Standard Components. For conceptual overview, see [`AGENT.md`](./AGENT.md). For implementation details and architectural patterns, see [`AGENT.implementation.md`](./AGENT.implementation.md).

## Creating Components

### From WML String
```typescript
const room = new StandardRoom(`
    <Room key=(tavern)>
        <Situation uuid=(DEFAULT)>
            <DisplayName>The Tavern</DisplayName>
            <Description>A cozy inn with a roaring fireplace.</Description>
        </Situation>
    </Room>
`)
```

### From JSON Data
```typescript
const feature = new StandardFeature({
    tag: 'Feature',
    key: 'fountain',
    universalKey: 'FEATURE#fountain-1',
    situations: [{
        reference: { universalKey: 'SITUATION#DEFAULT', tag: 'Situation' },
        payload: {
            displayName: 'Central Fountain',
            description: ['A beautiful marble fountain.']
        }
    }]
})
```

## Accessing Content Properties

### Situation facet prose (Room / Feature / Knowledge)
```typescript
const firstFacet = room.situations.items[0]
const displayName = firstFacet?.payload._displayName?.plainString
const description = firstFacet?.payload._description?.plainString
```

### StandardCharacter
```typescript
const name = character.name.plainString  // Returns StandardRender
const image = character.image?.data?.fileURL || ''  // Handles EditWrappedStandardNode
```

## Character Reference Patterns

### Creating a Room with Character References
```typescript
const roomData: StandardRoomData = {
    tag: 'Room',
    universalKey: 'ROOM#tavern',
    characters: ['CHARACTER#innkeeper', 'CHARACTER#bard'],
    exits: [],
    situations: [{
        reference: { universalKey: 'SITUATION#DEFAULT', tag: 'Situation' },
        payload: { description: ['A busy tavern.'] }
    }]
}
const room = new StandardRoom(roomData)
```

### Accessing Characters in a Room
```typescript
const characterRefs = room.characters.payload
characterRefs.forEach(ref => {
    console.log(`Character: ${ref.universalKey}`)
})
```

### In Lambda: Creating Character Components for StandardForm
```typescript
const characterComponents: StandardCharacterData[] = roomCharacterList.map(char => ({
    tag: 'Character',
    universalKey: char.EphemeraId,  // No local key needed!
    name: char.Name ? [char.Name] : undefined
}))
```

### Client: Accessing Characters in RoomDescription
```typescript
characters.forEach(character => {
    const name = character.name?.plainString || 'Unknown Character'
    const characterId = character.universalKey || character.key
})
```

## Serialization

### Basic Serialization
```typescript
// To JSON for storage
const json = room.toJSON()

// From JSON for loading
const room = new StandardRoom(json)
```

## Related Documentation

- [`AGENT.md`](./AGENT.md) - Conceptual overview and navigation guide
- [`AGENT.implementation.md`](./AGENT.implementation.md) - Component types, architectural patterns, and testing details
- [`dataTypes/AGENT.md`](./dataTypes/AGENT.md) - Serialization vs. Manipulation Types architecture
- [`render/AGENT.md`](../render/AGENT.md) - StandardRender system documentation
