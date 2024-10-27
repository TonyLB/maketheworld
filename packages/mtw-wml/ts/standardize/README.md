---
---

# WML Standard Form

---

## Needs Addressed

---

- In order to internally interact with the semantic meaning that the World Markup Language
**represents** developers need a lightweight representation of those data types
- To support development velocity, the abstraction that the representation presents should
be as high-level as can be achieved ... code written with the abstraction should be able
to treat the objects as first class citizens without worrying about the details of
representation that are abstracted away

---

## Components

---

TBD

---

## Object vs. Data

---

Make The World has several areas in which components need to be serialized into plain Javascript objects:

- Best practices for the *Redux store* require objects in the store to be immutable plain javasript objects.
- Storage in the Ephemera DynamoDB table require plain javascript objects
- Storage in the `ndjson` file objects in S3 requires conversion to a serializable JSON format

To support this, each component, and the StandardForm object generally, has a corresponding `Data` format
defined as a Typescript type constraint. In all cases, the following methods are relevant:

- The corresponding class object will have a `toJSON` method which outputs the `Data` JSON format (so a
`StandardRoom` object will have a `toJSON` method that outputs `StandardRoomData` type-constrained
javascript objects)
- Each class constructor will accept the `Data` JSON format as one of its possible arguments
- There is a utility function `standardComponentFromJSON` which will take an object of the
`StandardComponentData` union class, distinguish which type of data it is more specifically, and create
the appropriate sub-class

---