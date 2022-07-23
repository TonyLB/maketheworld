----
----

# SourceStream utility

The SourceStream utility class helps the parse tokenizer to quickly maintain its context within a large string

----

## Needs Addressed

----

- Tokenizer must be able to look ahead to see whether the next N characters match a certain pattern
(in order to start tokenizing in the right pattern)
- Tokenizer must be able to consume characters, claiming them as part of the token it is constructing
- Tokenizer must be able to know the current position in the source (to position-mark tokens)

----

## Usage

```ts
    const sourceStream = new SourceStream(source)

    if (sourceStream.lookAhead('<Room')) {
        sourceStream.consume('<Room')
    }
    console.log(sourceStream.position)
```
