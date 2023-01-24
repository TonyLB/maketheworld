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
- ***Line Break***: `<br />` will create a line break in the text.
- ***Space***: `<Space />` tag will create whitespace even up against the edge of a
surrounding tag (where whitespace is usually ignored).  So, `<Description><Space />Test</Description>
returns the string ' Test', with a space added at the beginning.
- ***Link***: `<Link to=(test)>text</Link>` creates a named link to either a Feature or
an Action.  Clicking on a Feature link will view the feature.  Clicking on an Action link
will execute the action.
- ***Bookmark***: `<Bookmark key=(test) />` will insert the contents of a defined Bookmark
object.  Bookmarks can be defined once and then displayed in many places.
