# AWS Serverless Application Model and npm symlinks/workspaces

---

Unhappily, **aws sam** does not yet play nicely with symlinks, which means it does not play
nicely with npm workspaces.  See https://github.com/aws/aws-sam-cli/issues/756 for more details
about the known issue.

In order to workaround the problem, in this repository (where files *using* utility packages
change much more frequently than the packages themselves) the system currently assumes
explicit copies of the distribution files for the relevant packages in each lambda.

This has two extremely unfortunate down-sides:
    - All libraries used by the packages need to be explicitly also installed in the
    calling lambdas. This leaves a lot of (particularly) aws-sdk dependencies in the
    lambdas themselves, where they're not directly needed.
    - Each time a package is rebuilt, the distributions need to be manually copied again.
    This is toil.  Toil stinks.

TODO: Figure out a way to simplify and automate this setup. Perhaps using **claudia pack**?