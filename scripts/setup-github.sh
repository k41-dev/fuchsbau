#!/usr/bin/env bash
set -euo pipefail

# One-time setup: point this repo at your GitHub account and verify access.
# Usage: ./scripts/setup-github.sh [github-username]

REPO_NAME="fuchsbau"
GITHUB_USER="${1:-k41-dev}"
REMOTE_URL="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"

cd "$(dirname "$0")/.."

echo "Configuring remote → ${REMOTE_URL}"
git config --local remote.origin.url "${REMOTE_URL}"
git config --local remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"
git config --local branch.main.remote origin
git config --local branch.main.merge refs/heads/main

if ! git ls-remote origin &>/dev/null; then
  echo ""
  echo "Could not reach the remote. Before pushing:"
  echo "  1. Create an empty repo at https://github.com/new"
  echo "     Name: ${REPO_NAME}  (no README, no .gitignore)"
  echo "  2. Authenticate — pick one:"
  echo "     • GitHub CLI:  gh auth login && gh repo create ${REPO_NAME} --private --source=. --remote=origin"
  echo "     • HTTPS token: git push -u origin main  (use a Personal Access Token as password)"
  echo "     • SSH:         git remote set-url origin git@github.com:${GITHUB_USER}/${REPO_NAME}.git"
  echo ""
  exit 1
fi

echo ""
echo "Remote is reachable. First publish:"
echo "  git publish"
echo ""
echo "After that, one-command uploads:"
echo "  git upload \"your commit message\""