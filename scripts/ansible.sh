#!/usr/bin/env sh
# Run an Ansible command from the ansible/ directory.
#
# Ansible has no native Windows build, and installing it is optional elsewhere.
#
# Usage: scripts/ansible.sh ansible-playbook -i inventory.yml site.yml
set -eu

cd "$(dirname "$0")/../ansible"

if command -v ansible-playbook >/dev/null 2>&1; then
  exec "$@"
fi

command -v docker >/dev/null 2>&1 || {
  echo "✗ neither ansible-playbook nor docker is available" >&2
  exit 1
}

# The repository's own .ssh is git-ignored and travels with the checkout.
KEY=${KEY:-}
for candidate in "../.ssh/minecraft.key" "$HOME/.ssh/minecraft.key"; do
  [ -n "$KEY" ] && break
  [ -f "$candidate" ] && KEY=$candidate
done
[ -n "$KEY" ] && [ -f "$KEY" ] || {
  echo "✗ no SSH key at .ssh/minecraft.key or ~/.ssh/minecraft.key" >&2
  echo "  Point KEY at yours, e.g. make provision KEY=~/.ssh/id_ed25519" >&2
  exit 1
}
KEY_DIR=$(cd "$(dirname "$KEY")" && pwd)
KEY_NAME=$(basename "$KEY")

# Host key verification stays on, so the entries have to outlive the container
KNOWN=$HOME/.ssh/known_hosts
[ -f "$KNOWN" ] || { mkdir -p "$HOME/.ssh"; : >"$KNOWN"; }

# ansible-vault edit opens $EDITOR and needs a terminal; a pipeline has none
if [ -t 0 ]; then TTY=-it; else TTY=-i; fi

# Git Bash rewrites container-side paths into Windows ones without this
export MSYS_NO_PATHCONV=1

# ANSIBLE_CONFIG is named outright because a bind mount is world-writable, and
# the key is copied to 0600 inside because ssh refuses one anybody can read.
exec docker run --rm $TTY \
  -v "$(pwd):/ansible" \
  -v "$KEY_DIR:/keys:ro" \
  -v "$KNOWN:/root/.ssh/known_hosts" \
  -w /ansible \
  -e ANSIBLE_CONFIG=/ansible/ansible.cfg \
  -e ANSIBLE_PRIVATE_KEY_FILE=/tmp/key \
  -e EDITOR="${EDITOR:-vi}" \
  alpine/ansible \
  sh -c 'install -m600 "/keys/$1" /tmp/key && shift && exec "$@"' _ "$KEY_NAME" "$@"
