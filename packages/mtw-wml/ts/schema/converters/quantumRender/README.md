# Quantum Rendering

## High level reasoning

The engine the renders pretty-prints of WML from Schemas borrow metaphors from quantum mechanics (particularly
Schroedinger):  Operations can be conducted on a waveform of multiple *possible* renders, changing that waveform
into a different set of possibilities, without (necessarily) needing to collapse the field of possible renders
into a single, chosen, render.

Since we're not running on a massive quantum computer, we brute-force this by manipulating lists of possible
renders, and systematically operating upon them.

### But why?

Quantum rendering adds a challenging amount of complexity to the render process. Why is it worth it?
The main driver is the rules of adjacency and whitespace in free text (such as that in Descriptions).
Consider a simple schema of this form:
```
    <If {var1}>TestOne</If><If {var2}>TestTwo</If>
```
Inside of a description tag, rendering this on two lines would be flatly *wrong*.  The line break
would imply whitespace between the two conditionals where none exists. If both variables were true,
the result would be `TestOne TestTwo` rather than `TestOneTestTwo` (as it should be).

Therefore, the end of one conditional must be kept adjacent to the beginning of the next. When the
entire tags fit on the same line that is easy, but if their contents are large it is possible that
*each* tag (individually) would be small enough to render on an unwrapped line, but the *entangled
group* is too large.

### How the wave-form addresses entangled groups

To address this problem smoothly, each individual tag renders out with *multiple possibilities*:
```
<If {var1}>TestOne</If>
```
... and also ...
```
<If {var1}>
    TestOne
</If>
```
... **and also** ...
```
<If
    {var1}
>
    TestOne
</If>
```
These are referred to as the *naive* (single-line) render, the *nested* (multi-line) render, and
the *property nested* render (with contents shown on multiple lines, and the opening tag itself ALSO
rendered on multiple lines so that properties can take up space separately).

### Why not collapse sequentially?

A simple way to minimize the impact of this on the programming would be to collapse to a single
render before ever combining or altering data. But the results are ugly and counter-intuitive for
programmers. It leads to lines like this:
```
<If {var1}>First description</If><If {var2}>
    Second description on its own line purely by chance
</If><If {var3}>Third description</If>
```
It is much more readable to keep all items in an entangled group render at the same level of
nesting, so that you get something like this:
```
<If {var1}>
    First description
</If><If {var2}>
    Second description
</If><If {var3}>
    Third description
</If>
```

### But you only need one render per level (max of three), right?

Sorry, but no. Things get even *more* complicated when one considers wrapped tag-groups (like Conditionals).
Consider a schema like this:
```
<If {var1}>First description (true)</If><Else>First description(false)</Else><If {var2}>Second description</If>
```
While the If and Else items are (technically) a single conditional statement with multiple tag pairs included
in it, those tag-pairs *themselves* can be rendered at different levels of nesting. So one could consider two
different "nested" version of the above:
```
<If {var1}>First description (true)</If>
<Else>First description(false)</Else><If {var2}>Second description</If>
```
... and ...
```
<If {var1}>
    First description (true)
</If>
<Else>
    First description(false)
</Else><If {var2}>
    Second description
</If>
```
The first is more compact, *if there is room* to print it without exceeding line limits, while the second
wraps more effectively. Either could be useful, so both must be saved.

Ergo, quantum rendering needs to deal with up to (1) naive render, any number of nested renders, and
any number of property nested renders.

### Do you EVER collapse the possibilities?

Yes, actually! There are two very common situations in which you can immediately collapse possible renders:
- Contents inside of a tag can be collapsed before rendering the surrounding tag: Either the contents fit
on a single line (and will be rendered on a single line whether the surrounding tag needs to nest or not),
or they do not (and the surrounding tag *must* nest)
- Tags that are not adjacent can be collapsed sequentially: They may need to know how much of the line the
*previous* tag took up, to see whether they can (if in free-text) fit on that same line or must be rendered
on the next, but they will never need to retroactively change how any previous lines were rendered.

## Implementation

### Base renders

Functions that render base elements (i.e., the PrintMap entries in converter files) create a list of one or
more PrintMapResult data types, which include:
    - printMode (naive, nested, propertyNested)
    - output (single string, with one or more lines embedded in it)

### combine

Combine accepts arguments which are each a list of PrintMapResults (as per the output of base renders),
and combines them into one aggregate list of PrintMapResults that combines the output at each level
of nesting.

### collapse

To-be-documented
