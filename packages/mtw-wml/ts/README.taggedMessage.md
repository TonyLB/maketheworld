Tagged Messages
===============

World Markup Language text content is most frequently defined in a format that is
referred to (internally) as Tagged Messages.  The contents of a \<Description\> tag,
for instance, will be parsed into Tagged Message format, so...

```
<Description>
    This is a block of text, with a <Link to=(vista)>vista</Link> that players
    can click to view.
    <Condition {sunrise}>
        At sunrise, the view is particularly spectacular.
    </Condition>
</Description>
```

... would parse into ...

```
[
    { tag: 'String', value: 'This is a block of text, with a '},
    { tag: 'Link', to: 'FEATURE#123456', text: 'vista' },
    { tag: 'String', value: ' that players can click to view. ' },
    { tag: 'If', if: 'sunrise', contents: [
        { tag: 'String', value: 'At sunrise, the view is particularly spectacular.' }
    ]}
]
```

Spacing
=======

Unlike other areas of WML, Tagged Message sections are *not* whitespace invariant:  A
message of `Test<Link to=(test)>hello</Link>.` will render 'Test**hello**.', whereas
a message of `Test <Link to=(test)>hello</Link> .` will render 'Test **hello** .'

Any amount of whitespace (multiple spaces, tabs, new lines) will translate into *one*
space in the output.  Whitespace at the start or end of a surrounding tag is ignored,
so both `<Description>Test</Description>` and `<Description>  Test </Description>` will
result in the string 'Test' with no added whitespace.

Tags
====

Tagged Message format has its own set of tags:
- ***String***: Any text outside of a WML tag structure will be treated as a string.
- ***Line Break***: `<br />` creates a line break. Adjacent `<br />` on merge compact to one; two or more consecutive `<br />` in parse (authoring fields) normalize to ***DoubleBR***.
- ***Space***: `<Space />` tag will create whitespace even up against the edge of a
surrounding tag (where whitespace is usually ignored).  So, `<Description><Space />Test</Description>
returns the string ' Test', with a space added at the beginning. `<Space />` may also appear
immediately before or after `<br />` for paragraph-edge authoring (e.g. `Line one<Space /><br />Line two`).
See [`documentation/README.syntax.md`](../documentation/README.syntax.md) (Whitespace section).
- ***DoubleSpace***: `<DoubleSpace />` holds a mid-line insertion slot (two visible spaces between string/link chunks in authoring). Two or more consecutive `<Space />` between content strings normalize to one `<DoubleSpace />` on parse. Literal multi-space in strings does not round-trip; use the explicit tag.
- ***DoubleBR***: `<DoubleBR />` holds an empty middle paragraph between content strings in authoring. Storage/print uses this atom rather than adjacent `<br />`.
- ***Link***: `<Link to=(test)>text</Link>` creates a named link to either a Feature or
an Action.  Clicking on a Feature link will view the feature.  Clicking on an Action link
will execute the action.
