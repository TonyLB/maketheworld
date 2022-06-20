As of June 2022, Serverless Application Model cannot, as part of its build stage, reference anything
outside of the specific directory passed in a Lambda's CodeURI.  That means, specifically, that
it cannot reference:
- Common shared libraries
- npm workspaces
- Most of the scaffolding that would go into making a monorepo

This is a sadness.

In order to simulate (as best I can) the **right** structure for a monorepo of this
scale, in the hopes that SAM will eventually catch up and let us have robust local
dependencies, I have taken the following steps:
- Packaged functional libraries as npm workspaces (e.g. mtw-utilities) rather
than Lambda layers.  Because they are workspaces, they can be built all at once
at the top level of the project
- Manually copy the dist directories every time I change them (what a pain ... but
Powershell and Linux are so utterly unable to agree with each other that there's
really no way to automate any file-system work without locking in to one OS)
- Created a locally namespaced package name under which to import these libraries
(e.g. '@tonylb/mtw-utilities/'), and aliased it in the dependencies of the
package.json file for each lambda.
- Added the external dependencies of the library into the direct dependencies of
the lambda package

When, eventually, sam build becomes capable of negotiating workspaces, it should
be relatively straightforward to get to a better place:
- Remove the unnecessary direct dependencies
- Make each lambda handler into a workspace of its own
- Replace file-local dependencies for the libraries with named dependencies
on the locally namespaced package name
- Remove the copied dist directories
