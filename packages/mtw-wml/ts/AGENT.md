# World Markup Language (WML) - Agent Navigation Guide

## Overview

The World Markup Language (WML) is a custom markup format that serves as both a storage and transmission format for Make The World data. It provides a structured way to represent world assets, rooms, characters, and game state in a human-readable format.

## Core Purpose

- **Data Representation**: Provides a structured format for storing world data
- **Transmission Format**: Enables data exchange between services and components
- **Standardization**: Ensures consistent data structure across the system
- **Extensibility**: Supports custom tags and properties for different content types

## WML Format Structure

### Basic Syntax
WML uses XML-like syntax with custom tags and attributes:

```xml
<Asset uuid=(Dungeon)>
    <Room key=(VORTEX)>
        <Exit to=(cave)>cave</Exit>
        <Example uuid=(example1)>
            <Description>
                Natural rock formations rise in a jagged cliff-face...
            </Description>
            <Name>Cave entrance</Name>
        </Example>
    </Room>
</Asset>
```

### Core Concepts

#### **Tags**: These are XML-style elements like `<Asset>`, `<Room>`, `<Exit>`, or `<Description>`. These can represent
both objects and properties *of* objects (depending upon the tag). Any tag with a **key** (and, more importantly, with a
**uuid**) is a **component**.

#### **Assets**: These are collections of elements, which can be manipulated (themselves) as first-class objects. In
practice, Assets most often group "layers" of information about a setting: For instance, everybody might see the
coffee shop and fountain in a market square, while *only members of the criminal underworld* would need to see the
dark alley that leads to their thieves district. The goal of layering Assets (rather than storing all components in
a single homogenous collection) is to allow the representation of many different views on a shared world, for people
with different access and interest. Assets are also very useful for helping progress chunks of proposed change through
the process of being reviewed, refined, and finally accepted (on some level) into the shared world.

#### **Components**: These are the "things" of the Make the World world semantics: Rooms, Features, Knowledge items,
Messages, etc. They have a semantic weight that influences how they are parsed in the WML hierarchy.

Specifically, it is important to recognize that components can appear at *multiple places* in a WML file, and any
changes to them are considered additive across the entire asset. While it is standard to put all of the information
about a component in one place, and reference it simply at any other appearance, the WML parser does not *require*
that behavior. Part of the process of *standardizing* a WML asset is to transform it into the standard format.

For instance, in the following example:

```xml
<Asset uuid=(MarketSquare)>
    <Feature key=(fountain) uuid=(fountain-123)>
        <Example uuid=(fountain-example-1)>
            <Name>Central Fountain</Name>
            <Description>A beautiful marble fountain with flowing water.</Description>
        </Example>
    </Feature>
    
    <Room key=(cafe) uuid=(cafe-456)>
        <Example uuid=(cafe-example-1)>
            <Name>Cafe</Name>
            <Description>The cafe overlooks the central fountain.</Description>
        </Example>
        <Feature key=(fountain) />
    </Room>
    
</Asset>
```

Both features are known to be the same (since they share the same local key). Therefore, the `Name` added in one
place, and the `Description` added in another are aggregated to the same component. After being transformed to
standard form, the data would be expresed as follows:

```xml
<Asset uuid=(MarketSquare)>
    <Feature key=(fountain) uuid=(fountain-123)>
        <Example uuid=(fountain-example-1)>
            <Name>Central Fountain</Name>
            <Description>A beautiful marble fountain with flowing water.</Description>
        </Example>
    </Feature>
    
    <Room key=(cafe) uuid=(cafe-456)>
        <Example uuid=(cafe-example-1)>
            <Name>Cafe</Name>
            <Description>The cafe overlooks the central fountain.</Description>
        </Example>
        <Feature key=(fountain) />
    </Room>
    
</Asset>
```

For detailed information about all component types and their APIs, see [`standardize/components/AGENT.md`](./standardize/components/AGENT.md).

**⚠️ CRITICAL**: Display content (`name`, `summary`, `description`) is stored in `Example` components, not directly in other components. Feature, Knowledge, and Room components reference Examples via their `examples` property. See [Standard Components documentation](standardize/components/AGENT.md) for details.

#### **Keys and UUIDs**: Any component *can* have a key or UUID (or both) and *must* have one or the other. The
key and UUID specify the component as itself, even when it appears in multiple places. The two serve different
purposes: The UUID is a **global** identifier, which uniquely identifies a given component whatever Asset it is
being referenced in. The key is a **local** identifier, which provides a more human-friendly (and shorter) way
to refer to the component within the scope of a specific asset.

#### **Properties**: In addition to key and uuid, tags can have other properties to convey short snippets of
information about them. WML supports several property value syntaxes:

- **Parentheses `(value)`**: Used for key references to components or other identifiers
- **Quoted Strings `"value"`**: Used for literal string values
- **Curly Braces `{value}`**: Used for typed and validated values (integers, floats, or other structured data types)

For instance, in the following:

```xml
<Map key=(dungeonMap)>
    <Room key=(VORTEX)><Position {0, 250} /></Room>
</Map>
```

... the `Position` tag has `x` and `y` string properties (using quoted string syntax). The `key` and `to` properties use parentheses for key references.

Properties using curly braces `{value}` are validated during parsing and converted to the appropriate data type. The specific validation rules and target type depend on the tag and property definition. Invalid values will result in parsing errors, ensuring type safety.

#### **References**: WML allows components to be connected to each other in several ways. The simplest is
to put a reference to a child component (just the tag) nested inside of a parent component. This can be
without any data (as in a `Message` tag which includes `Room` tags that tell it which rooms the message
should be delivered to when activated) or with data relevant only in the context of the parent tag (as with
the `Map` example above).

There are also **tags** which themselves act as ways to represent *data associated with* a link between two
components. For instance, the `Exit` tag represents a connection from one room to another that includes a
name for that connection. Similarly, a `Link` tag represents a connection to another component which is
used to style text in a description.

#### **Content**: In addition to tags nested in tags, WML also allows free text that associates content with
a parent tag (usually `Description` or `Name` or the like). As mentioned above (in **References**), that free
text can *itself* include tags within it, when the tags are used for styling.

For detailed information about how rich text content is processed and standardized, see
[`standardize/render/AGENT.md`](./standardize/render/AGENT.md).

#### **Edit Tags**: WML includes special tags for recording changes to be merged into existing content. These
edit tags allow the language to be used for both storage and transmission of modifications:

- **`<Replace>`**: Specifies content to be replaced, paired with a `<With>` tag containing the new content
- **`<Remove>`**: Marks content to be removed from the asset

**Important Note for Schema Tree Work**: When working with schema trees (the internal `GenericTree<SchemaTag>` representation), 
the structure mostly parallels WML syntax, but differs in some particulars:
- **WML syntax**: `<Replace>oldcontent</Replace><With>newcontent</With>` (siblings)
- **Schema tree**: A `Replace` node contains `ReplaceMatch` and `ReplacePayload` as children:
  - `ReplaceMatch` contains the old content (from `<Replace>`)
  - `ReplacePayload` contains the new content (from `<With>`)
- When serializing back to WML, the schema structure becomes `<Replace>...</Replace><With>...</With>` as siblings

This transformation happens automatically during parsing and serialization, but when working directly with schema trees
(which most of the codebase does), you'll encounter `ReplaceMatch` and `ReplacePayload` as children of `Replace` nodes.

Edit tags are processed by the standardization system to merge changes into the base content. For example:

```xml
<Asset uuid=(Test)>
    <Room key=(testRoom)>
        <Example uuid=(testRoom-example)>
            <Replace><Description>bare and spindly trees.</Description></Replace>
            <With><Description>cherry trees lushly in bloom.</Description></With>
        </Example>
    </Room>
    <Remove><Room key=(unwantedRoom) /></Remove>
</Asset>
```

The edit system supports merging multiple edits together and can detect conflicts when incompatible changes are
attempted. For instance, merging the above changes into the following:

```xml
<Asset uuid=(Test)>
    <Room key=(testRoom)>
        <Example uuid=(testRoom-example)>
            <Description>A walkway by a canal, winding through bare and spindly trees.</Description>
        </Example>
    </Room>
    <Room key=(unwantedRoom) />
</Asset>
```

... would result in the following:

```xml
<Asset uuid=(Test)>
    <Room key=(testRoom)>
        <Example uuid=(testRoom-example)>
            <Description>A walkway by a canal, winding through cherry trees lushly in bloom.</Description>
        </Example>
    </Room>
    <Room key=(unwantedRoom) />
</Asset>
```

## Library Architecture

### Core Components

#### 1. **Parser** (`parser/`)
- **Tokenizer** (`parser/tokenizer/`): Breaks WML text into tokens
  - `baseClasses.ts`: Token type definitions
  - `index.ts`: Main tokenizer logic
  - Individual tokenizers for different elements
- **Simple Parser** (`simpleParser/`): Converts tokens to parse tree

#### 2. **Schema** (`schema/`)
- **Converters** (`schema/converters/`): Converts between WML and internal formats
- **Tree Manipulation** (`schema/treeManipulation/`): Operations on WML trees
- **Selectors** (`schema/selectors/`): Query and selection utilities
- **Utils** (`schema/utils/`): Helper functions

#### 3. **Standardize** (`standardize/`)
- Normalization and standardization of WML content, as well as the data manipulators
for every component type
- **Edit Processing** (`standardize/components/edits.ts`): Handles `<Replace>`, `<Remove>`, and other edit tags
- **Component Standardization**: Each component type has its own standardizer (Room, Feature, etc.)
- **Merge Operations**: Combines multiple edits and detects conflicts
- **`standardizeMode`**: Asset vs ephemera wire payload vocabulary, optional **`StandardFormConstructionOptions`** on **`StandardForm`** and generated **`Standard*`** constructors (WML/schema paths), and threading through **`fromSchema`** --- see [`standardize/AGENT.md`](./standardize/AGENT.md) (section **Payload vocabulary vs semantic mode (`standardizeMode`)**). Component-level concepts also link from [`standardize/components/AGENT.md`](./standardize/components/AGENT.md).

## Usage Patterns

### Parsing WML
```typescript
import { Schema } from './schema'
const schema = new Schema()
schema.loadWML(wmlString)
```

The example above takes a string and converts it into a Schema object. The `schema.schema` property
will contain the `GenericTree` representation of the schema.


### Converting back to WML
```typescript
import { schemaToWML } from './schema'
const wmlString = schemaToWML(tree)
```

## Token Types

The tokenizer recognizes these token types:
- **TagOpenBegin**: Opening tags like `<Asset>`
- **TagClose**: Closing tags like `</Asset>`
- **TagOpenEnd**: Self-closing tags like `<Image />`
- **Property**: Attributes like `key=(value)`
- **Description**: Text content within tags
- **Whitespace**: Spaces, tabs, newlines
- **Comment**: WML comments
- **LiteralValue**: Quoted string values like `"text"`
- **KeyValue**: Key references like `(roomKey)`
- **ExpressionValue**: Typed and validated values like `{42}` or `{3.14}` (used for integers, floats, and other structured data types)

## Integration Points

- **Lambda Functions**: WML is used in `lambda/wml/` for asset management
- **Frontend**: WML content is rendered in the React client
- **Shared Libraries**: Uses `@tonylb/mtw-base` for tree structures
- **Event System**: WML changes trigger events via the ExternalBus
- **Standard Components**: See [`standardize/components/AGENT.md`](./standardize/components/AGENT.md) for component processing
- **Rich Text Processing**: See [`standardize/render/AGENT.md`](./standardize/render/AGENT.md) for content handling

## Usage Patterns

### Parsing WML
```typescript
import { Schema } from './schema'
const schema = new Schema()
schema.loadWML(wmlString)
```

The example above takes a string and converts it into a Schema object. The `schema.schema` property
will contain the `GenericTree` representation of the schema.

### Converting back to WML
```typescript
import { schemaToWML } from './schema'
const wmlString = schemaToWML(tree)
```

## Navigation Tips

1. **Start with Examples**: Look at `dungeon.wml` to understand the format
2. **Follow the Pipeline**: Tokenizer → Parser → Schema → Tree
3. **Check Tests**: Each component has comprehensive test coverage
4. **Use TypeScript**: All components are strongly typed
5. **Review Schema**: The schema system handles validation and conversion

## Development Notes

### Current State
- **Parser**: Fully functional tokenizer and simple parser
- **Schema**: Complete conversion between WML and internal formats
- **Standardization**: Component processing and edit handling implemented
- **Validation**: Schema validation ensures WML correctness

### Future Plans
- **Performance**: Optimize parsing for large WML files
- **Validation**: Enhanced schema validation with better error messages
- **Extensions**: Support for additional tag types and properties

### Technical Debt
- **Error Handling**: Improve error messages for malformed WML
- **Documentation**: Add more examples for complex WML structures
- **Testing**: Expand test coverage for edge cases 