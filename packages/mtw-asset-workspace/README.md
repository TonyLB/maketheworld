---
---

# Asset Workspace

Parsed assets are stored in pairs of WML files (in which they are defined) and JSON files that translate
the WML file semantics into a quickly-fetchable format handled by the DB internally.  The AssetWorkspace
class creates an object handler for these pairs, loading, updating, or putting them as necessary for
each lambda that might need the data

---

## Needs Addressed
- Developers need to code lambdas that can deal with the data stored in the underlying asset file pairs,
at an abstracted level.

---

## AssetWorksapce class properties

- fileName: string
- zone: 'Canon' | 'Library' | 'Personal'
- subFolder?: string
- player?: string
- status: 'Initial' | 'Clean' | 'Dirty' | 'Error'
- error?: string

---

## AssetWorkspace class methods

### ***constructor***(args: AssetWorkspaceConstructorArguments)

```ts
type AssetWorkspaceConstructorBase = {
    fileName: string;
    subFolder?: string;
}

type AssetWorkspaceConstructorCanon = {
    zone: 'Canon';
} & AssetWorkspaceConstructorBase

type AssetWorkspaceConstructorLibrary = {
    zone: 'Library';
} & AssetWorkspaceConstructorBase

type AssetWorkspaceConstructorPersonal = {
    zone: 'Personal';
    player: string;
} & AssetWorkspaceConstructorBase
```

Builds initial AssetWorkspace reference.  Initial status is 'Initial'

### async ***loadJSON***()

Loads the JSON from the existing S3 object (if any).  If no S3 object exists, loadJSON returns an empty JS object.

### async ***putJSON***()

Puts the current JSON file to S3, including both normal form and namespace-to-DB mapping.

### async ***loadWML***()

Loads the WML from the existing S3 object (if any).  If no S3 object exists, or the S3 is not valid WML, loadWML
sets to Error condition

### ***setWML***()

Directly set the WML to a specified string.  If string cannot be parsed, loadWML sets to Error condition.

### async ***putWML***()

Puts the current WML file to S3.
