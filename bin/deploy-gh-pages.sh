#!/bin/bash

set -e
cd "$(dirname "$0")/.."

git checkout gh-pages
git merge --no-ff master
npm run build-dist
git add -f dist
git commit --amend
git push
git checkout -
echo "Deployed to https://westonruter.github.io/spoken-word/test/example.html"
