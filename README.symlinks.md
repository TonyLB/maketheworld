# AWS Serverless Application Model and npm symlinks/workspaces

---

Unhappily, **aws sam** does not yet play nicely with symlinks, which means it does not play
nicely with npm workspaces.  See https://github.com/aws/aws-sam-cli/issues/756 for more details
about the known issue.

In order to workaround the problem, in this repository (where files *using* utility packages
change much more frequently than the packages themselves) the system currently assumes
explicit copies of the distribution files for the relevant packages in each lambda.

This has two unfortunate down-sides:
    - All libraries used by the packages need to be explicitly linked with file dependencies,
    rather than treated as first-class packages.
    - Because AWS SAM is not happy with the links npm makes for such dependencies, each
    lambda needs to be explicitly built using **npm run build** (or **build:dev**) in its
    directory, rather than being auto-built as part of the **sam build** process.  A drag,
    but maybe someday the SAM folks will fix it.
