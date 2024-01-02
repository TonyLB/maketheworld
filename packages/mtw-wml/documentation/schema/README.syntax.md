# Syntax

The structure of WML is made up of ***tags***, like `<Room key=(room1) />`.  These tags can either be self-closing (as at left) or can enclose other tags, like `<Room key=(room2)><Name>Lobby</Name></Room>`.

## Context Tags

Tags which have a **key** are independent things in the world space (rooms, features, maps, etc.). When one
of these things is wrapped within another, it is a sign that the things are related, and some of the tags
wrapped in both will exist in the context of the **relationship** between those two things. So, for instance:

```
<Asset key=(testAsset)>
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
<Asset key=(testAsset)>
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
<Asset key=(testAsset)>
    <Message key=(alert)>
        A blaring horn sounds in three quick blats!
        <Room key=(room1) />
        <Room key=(room2) />
    </Message>
</Asset>
```

This defines a message, including its text (see *Content Tags*, below) and its relationship with the two rooms in which it will be emitted.

## Content Tags

Tags *without* keys are generally some manner of content definine the details of things. So, for instance, in
the following:

```
<Asset key=(testAsset)>
    <Room key=(room1)>
        <Name>Lobby</Name>
        <Description>A sterile corporate lobby, brightly lit by fluorescent bulbs.</Description>
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
        <Name>Lobby</Name>
        <Description>A corporate lobby</Description>
        <Name>: at night</Name>
        <Description>, with shadows clinging to the corners.</Description>
    </Room>
```
is the same as:
```
    <Room key=(room1)>
        <Name>Lobby: at night</Name>
        <Description>A corporate lobby, with shadows clinging to the corners.</Description>
    </Room>
```

This aggregating behavior is particularly important when using *Conditional Tags* (see below).

## Conditional Tags

The things in the Make The World spaces react to changes in their underlying variables. The main way they do this is
by making some sections of their names, descriptions, etc., *conditional*. Anything placed withing an `<If>` tag only
appears in the world when that condition is met. So, for instance:
```
<Asset key=(testAsset)>
    <Variable key=(dayTime) default={true} />
    <Room key=(lobby)>
        <Name>Lobby</Name>
        <Description>A corporate lobby<Space /></Description>
    </Room>
    <If (dayTime)>
        <Room key=(lobby)>
            <Description>with sunlight streaming in the windows.</Description>
        </Room>
    </If>
    <Else>
        <Room key=(lobby)>
            <Name>: at night</Name>
            <Description>with shadows crowding the corners.</Description>
        </Room>
    </Else>
</Asset>
```
When the `dayTime` variable is set to true, this will render as if it were the following:
```
<Asset key=(testAsset)>
    <Variable key=(dayTime) default={true} />
    <Room key=(lobby)>
        <Name>Lobby</Name>
        <Description>A corporate lobby<Space /></Description>
    </Room>
    <Room key=(lobby)>
        <Description>with sunlight streaming in the windows.</Description>
    </Room>
</Asset>
```
... and if the `dayTime` variable is not set to true, it will render as the following:
```
<Asset key=(testAsset)>
    <Variable key=(dayTime) default={true} />
    <Room key=(lobby)>
        <Name>Lobby</Name>
        <Description>A corporate lobby<Space /></Description>
    </Room>
    <Room key=(lobby)>
        <Name>: at night</Name>
        <Description>with shadows crowding the corners.</Description>
    </Room>
</Asset>
```
As with other context tags, `If` tags can be reordered in their position in the tree, so the first text could be
rewritten more compactly (and perhaps more readably) as:
```
<Asset key=(testAsset)>
    <Variable key=(dayTime) default={true} />
    <Room key=(lobby)>
        <Name>
            Lobby<If {dayTime}></If><Else>: at night</Else>
        </Name>
        <Description>
            A corporate lobby
            <If {dayTime}>with sunlight streaming in the windows.</If>
            <Else>with shadows crowding the corners.</Else>
        </Description>
    </Room>
</Asset>
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
However, the following two are not the same:
```
<Description>
    Test
    <If {true}>One</If>
</Description>
```
... vs. ...
```
<Description>
    Test<If {true}>One</If>
</Description>
```
The former will render as `Test One` while the latter will render as `TestOne` (since the `<If>` statement
is wrapped directly up against the prior text, with no whitespace).