# Standard Components - Usage Patterns

## Overview

This document provides practical code examples for working with Standard Components. For conceptual overview, see [`AGENT.md`](./AGENT.md). For implementation details and architectural patterns, see [`AGENT.implementation.md`](./AGENT.implementation.md).

## Creating Components

### From WML String
```typescript
const example = new StandardExample(`
    <Example key=(my-example)>
        <Name>Example Name</Name>
        <Summary>Example Summary</Summary>
        <Description>Example Description</Description>
    </Example>
`)
```

### From JSON Data
```typescript
const example = new StandardExample({
    tag: 'Example',
    key: 'my-example',
    name: ['Example Name'],
    summary: ['Example Summary'],
    description: ['Example Description']
})
```

## Accessing Content Properties

### StandardExample
```typescript
const name = example.name.plainString
const summary = example.summary.plainString
const description = example.description.plainString
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
    examples: ['EXAMPLE#tavernDescription']
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
const json = example.toJSON()

// From JSON for loading
const example = new StandardExample(json)
```

## Related Documentation

- [`AGENT.md`](./AGENT.md) - Conceptual overview and navigation guide
- [`AGENT.implementation.md`](./AGENT.implementation.md) - Component types, architectural patterns, and testing details
- [`dataTypes/AGENT.md`](./dataTypes/AGENT.md) - Serialization vs. Manipulation Types architecture
- [`render/AGENT.md`](../render/AGENT.md) - StandardRender system documentation

