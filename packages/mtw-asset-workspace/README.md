---
---

# Asset Workspace

Parsed assets are stored in pairs of WML files (in which they are defined) and NDJSON files that translate
the WML file semantics into a quickly-fetchable format handled by the DB internally.  The AssetWorkspace
class creates an object handler for these pairs, loading, updating, or putting them as necessary for
each lambda that might need the data.

For each asset, there will be two pairs:  One, containing content, is at *.wml and *.ndjson.  The second,
containing authorization grants on that content, is at *.auth.wml and *.auth.ndjson. We separate these
two storage planes because they are *very frequently* updated independently, and only very rarely updated
in tandem (basically the only in-tandem update is when a component's key is renamed).

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
- namespaceIdToDB: Record<string, string>
- normal: NormalForm
- wml: string

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

### async ***loadAuthorizationJSON***()

Loads the authorization JSON from the existing S3 object (if any).

### async ***pushJSON***()

Puts the current JSON file to S3, including both normal form and namespace-to-DB mapping.

### async ***pushAuthorizationJSON***()

Puts the current authorization NDJSON file to S3.

### async ***loadWML***()

Loads the WML from the existing S3 object (if any).  If no S3 object exists, or the S3 is not valid WML, loadWML
sets to Error condition

### async ***loadAuthorizationWML***()

Loads the authorization WML from the existing S3 object (if any).

### ***setWML***()

Directly set the WML to a specified string.  If string cannot be parsed, loadWML sets to Error condition.

### async ***pushWML***()

Puts the current WML file to S3.

### async ***pushAuthorizationWML***()

Puts the current authorization WML file to S3.