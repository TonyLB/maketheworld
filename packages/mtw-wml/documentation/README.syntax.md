# Syntax

The structure of WML is made up of ***tags***, like `<Room key=(room1) />`.  These tags can either be self-closing (as at left) or can enclose other tags, like `<Room key=(room2)><Name>Lobby</Name></Room>`.

## Context Tags

Tags which have a **key** are independent things in the world space (rooms, features, maps, etc.). When one
of these things is wrapped within another, it is a sign that the things are related, and some of the tags
wrapped in both will exist in the context of the **relationship** between those two things. So, for instance:

```
<Asset uuid=(testAsset)>
    <Map key=(testMap)>
        <Room key=(room1)>
            <Name>Lobby</Name>
            <Position "0, 100" />
        </Room>
    </Map>
</Asset>
```

The above indicates that both a Map (testMap) and a Room (room1) exist within the context of the testAsset Asset. The room's name (Lobby) is defined for the room (because it is not a property that is effected by being in the context of
a Map), but the **Position** only has meaning in the context of a Room's relationship with a Map. Therefore, this position (0, 100) is relevant only to the relationship between this one room and this one Map.

Because the Map and Room tags are only there to establish context, the **order** in which they appear is semi-arbitray. The same meaning could be conveyed with the following structure:

```
<Asset uuid=(testAsset)>
    <Room key=(room1)>
        <Name>Lobby</Name>
        <Map key=(testMap)>
            <Position "0, 100" />
        </Map>
    </Room>
</Asset>
```

Again, the **Position** tag exists within the context of all the tags needed to define its place in relation to the given map and room, while the **Name** tag is only associated with the Room.

For some relationship, there is nothing associated with the relationship ... the mere fact of a connection is enough. For instance:

```
<Asset uuid=(testAsset)>
    <Message key=(alert)>
        A blaring horn sounds in three quick blats!
        <Room key=(room1) />
        <Room key=(room2) />
    </Message>
</Asset>
```

This defines a message, including its text (see *Content Tags*, below) and its relationship with the two rooms in which it will be emitted.

## Property Values

Tags can have properties that convey information about them. WML supports several syntaxes for property values, each serving different purposes:

### Parentheses `(value)` - Key References
Used for references to components or other keys. The value is treated as a key identifier.

```
<Room key=(mainHall)>
<Exit to=(kitchen)>kitchen</Exit>
```

### Quoted Strings `"value"` - Literal Strings
Used for string values that should be preserved exactly as written.

```
<Position {0, 250} />
```

### Curly Braces `{value}` - Typed and Validated Values
Used for values that conform to a specific data type (such as integers, floats, or other structured data). The value is validated and converted to the appropriate type during parsing. The validation rules and target type are determined by the specific tag and property being used.

```
<Tag count={42} />
<Tag weight={3.14} />
```

The curly brace syntax indicates that the value must match a specific format or type. Invalid values will cause parsing errors, ensuring type safety and data integrity.

## Content Tags

Tags *without* keys are generally some manner of content definine the details of things. So, for instance, in
the following:

```
<Asset uuid=(testAsset)>
    <Room key=(room1)>
        <Example uuid=(room1-example)>
            <Name>Lobby</Name>
            <Description>A sterile corporate lobby, brightly lit by fluorescent bulbs.</Description>
        </Example>
    </Room>
</Asset>
```
The Asset and Room are things being defined, in and of themselves. They have a relationship, but in theory they exist
separately. The Name and Description tag do not have existence outside of the Room they are defined in ... they are
details *of* that room, rather than things that exist on their own.

Wrapped inside content tags is often (but not always) *free-text*. Technically, this is also a bunch of tags
(String tags, and whitespace, and various formatting tags), but it is handled much more like normal text, and
has different rules around what spacing and line breaks mean (see *Whitespace*, below).

Independent property content tags can sort past each other. Successive content tags of the same type will, by default, just add their contents together. So
```
    <Room key=(room1)>
        <Example uuid=(room1-example)>
            <Name>Lobby</Name>
            <Description>A corporate lobby</Description>
            <Name>: at night</Name>
            <Description>, with shadows clinging to the corners.</Description>
        </Example>
    </Room>
```
is the same as:
```
    <Room key=(room1)>
        <Example uuid=(room1-example)>
            <Name>Lobby: at night</Name>
            <Description>A corporate lobby, with shadows clinging to the corners.</Description>
        </Example>
    </Room>
```

## Whitespace

WML has two different approaches to *whitespace*, in different contexts. Between **context tags** (like Room and
Map), whitespace is completely ignored. In that context, there is no concept of "space" between items (since items
are not being rendered directly, and are not in strict sequence).

However, in *free text* (like inside of a Description), spacing does matter. Any whitespace more than one space in a
row will be compressed down to a single space between elements. Any spaces directly before or after new-lines, or
at the beginning or end of an enclosing element, will be ignored. If an enclosing element *should* begin or end
with a space, use the explicit `<Space />` tag.

Therefore, the following three items render exactly the same:
```
<Description>Test One Two Three</Description>
```
... and ...
```
<Description>
    Test
    One
    Two
    Three
</Description>
```
... and ...
```
<Description>Test<Space />One<Space /> <Space /> Two Three</Description>
```