# Contributing

First make sure that the `dev-lib` submodule has been cloned via `git submodule update --init`, then install the `pre-commit` hook via `./dev-lib/install-pre-commit-hook.sh`. Then after doing `npm install` you can start Webpack to watch for changes with a dev configuration via:

```bash
npm run dev
```

Open pull requests to the `master` branch. Code will be checked against PHP_CodeSniffer and ESLint according to their respective WordPress standards.

A production build of the JavaScript sources can be generated via:

```bash
npm run build-dist
```

To build the WordPress plugin, run:

```bash
npm run build-wp-plugin-zip
```

To deploy a new version of the plugin to WordPress.org, do the following:

1. Update the versions in the `package.json`, `composer.json`, `wp-plugin.php`, `readme.txt`.
2. Add changelog entry to `readme.txt`.
3. Merge changes into `master`. 
4. Run `npm run deploy-wp-plugin`.
5. [Create new release](https://github.com/westonruter/spoken-word/releases/new) on GitHub targeting `master`, with the new plugin version as the tag and release title. Attaching the `spoken-word.zip` build to the release. Publish.
