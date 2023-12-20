Sequence Tools
==============

This sub-directory contains tools that operate quickly upon sequences of items, comparing them to each
other and revealing structural similarities.

One "sequence" of items that these tools are often applied against is a sequence of tree locations, parsing
up, down, and across the tree in depth-first-search order.  Comparing sequences derived from two trees
(and, particularly, deriving the merge or diff of those sequences) is equivalent to comparing the merge
or diff of the trees themselves:  So these sequence tools are leveraged to create smooth and minimal
merges and change-sets between different trees (particularly of WML Schemata).

The tools are unfinished:  Right now, they are used (rather minimally) in WML rendering of Map schema.
Over time, they should be extended to do more:
    * Write maintainable code to smoothly render more complicated schema
    * Create tree-diff procedures to derive the changes between Tree A and Tree B, and express those
    in a language of change-tags that could extend the static WML language into an edit language
