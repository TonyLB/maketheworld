# Schema package

This package parses WML into schema trees and prints schema back to WML. It lives alongside the **Standardize** layer, which turns schema into `StandardComponent` instances.

## Division of responsibility (Schema vs Standardize)

- **Schema (this package)** is responsible for **syntactic correctness** and **property-level validation** (e.g. attributes, content models for tags like Exit, Parent, Key, Description). It does not enforce per-component child-tag whitelists; children are passed through to Standardize.
- **Standardize** (component payloads and their `fromSchema` pipelines) is responsible for **semantic correctness of child structures**: which tags are accepted under a given parent, in what combinations. That is enforced by the process-and-remainder pipeline and the unconsumed-remainder check.

When adding or changing validation, add rules for *which child tags are allowed where* in the Standardize layer (see [AGENT.implementation.md](../standardize/components/AGENT.implementation.md) Division of responsibility), not in schema converters.
