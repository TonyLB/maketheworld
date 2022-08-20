---
---

# Asset JSON File

Parsed assets are stored in JSON files that parallel the original WML files from which they are derived.  These
asset JSON files are the basic elements that lambda functions pull from in order to populate their respective
databases.

---

## Needs Addressed

---

***Communication between lambdas***
- Lambda functions must be able to communicate with each other through light-weight EventBridge messages,
while being able to share a common understanding of assets.  The asset JSON files are the grounding of that
common understanding:  A lambda function receiving a message that refers to an asset by file name can pull
the assets parsed and ready information from S3.

***Mapping of namespaced IDs to DB unique IDs***
- WML files must be able to be defined using human-readable IDs unique only to the namespace of the
individual file in question (e.g. `key=(welcomeRoom)`)
- WML files must be able to import and refer to IDs from other namespaces, remapping them as necessary
in the process of import
- Lambda functions must be able to fetch the information for a specific element from an asset by
using a *globally unique* key that has the same meaning across any asset in which the element is
referenced
- The system must be able to create multiple independent instances of a given asset, creating an entirely
new set of global DB keys for the elements, so that multiple instances of an asset may be used independently
by different groups of players without interference
- The mappings stored within asset files form the grounding of this functionality, allowing persistence
of namespace-to-DB mappings even when data is decached or lost from the active database

***Caching and decaching***
- The lambda functions must be able to use the asset JSON file to create all database structures needed
to fulfill their functions related to that asset.
- The lambda functinos must be able to clearly remove all database structures related to a given asset,
when doing so may increase table performance by storing only the most used data

***Update cascades***
- The lambda functions must be able to use an updated asset JSON file to update all database structures
needed to fulfill their functions related to that asset, and to be able to calculate whether any updates
need to be published to those subscribed to that content.

---

## File Format

---

Each asset file is a JSON file with the same base fileName as that assigned to the .wml file.  The JSON
contains the following properties:
- namespaceToDBId:  A mapping from internal namespaced IDs to the DB ID assigned to that same entry.
- importTree: A nested-recursive tree of imports
- normal: A NormalForm representation of the WML asset, per WML

---
---