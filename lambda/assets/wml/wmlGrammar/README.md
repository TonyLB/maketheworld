The wml.ohm-bundle files are generated:  Only the wml.ohm and wmlQuery.ohm files are original.

To regenerate (e.g. after changing the wml.ohm file), navigate to the assets/wml directory, and
execute this command:  npx ohm generateBundles 'wmlGrammar/*.ohm'

... and then rename the 'ohm-bundle.js' files to 'ohm-bundle.cjs', since the --esm option for
CLI is not released yet, so we can only create CommonJS files, which Lambda needs to be flagged
for.