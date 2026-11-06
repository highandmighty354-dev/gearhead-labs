#!/usr/bin/env bash
# Gearhead Labs: re-verify the third-party action pins in .github/workflows/provision-supabase.yml against the
# UPSTREAM repositories (network; read-only `git ls-remote` and a shallow fetch, no credentials).
# For each pin: the commit exists in the upstream repository, it is a commit object, and the release tag named in
# the workflow comment points to exactly that commit in upstream (so it is not a commit only reachable from a fork).
# Opt-in: not part of run-tests.sh's default run (it needs network). Exit 0 = all pins verified.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; wf="${GH_WORKFLOW:-$here/../../.github/workflows/provision-supabase.yml}"
fail=0; n=0; tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
while IFS= read -r line; do
  if [[ $line =~ uses:\ ([a-z0-9-]+/[a-z0-9-]+)@([0-9a-f]{40})\ \#\ (v[0-9]+\.[0-9]+\.[0-9]+) ]]; then
    repo="${BASH_REMATCH[1]}" sha="${BASH_REMATCH[2]}" tag="${BASH_REMATCH[3]}"
    key="$repo@$sha"; case " ${seen:-} " in *" $key "*) continue ;; esac; seen="${seen:-} $key"; n=$((n + 1))
    refs="$(git ls-remote "https://github.com/$repo.git" "refs/tags/$tag" "refs/tags/$tag^{}" 2>&1)" || { echo "FAIL $repo: ls-remote failed: $refs"; fail=1; continue; }
    target="$(printf '%s\n' "$refs" | awk -v t="refs/tags/$tag^{}" '$2==t{print $1}')"
    [ -n "$target" ] || target="$(printf '%s\n' "$refs" | awk -v t="refs/tags/$tag" '$2==t{print $1}')"
    d="$tmp/${repo//\//_}"; git init -q "$d"
    if ! git -C "$d" fetch -q --depth 1 "https://github.com/$repo.git" "$sha" 2>/dev/null; then echo "FAIL $repo@$sha: commit not fetchable from upstream"; fail=1; continue; fi
    type="$(git -C "$d" cat-file -t "$sha" 2>/dev/null)"
    if [ "$type" = commit ] && [ "$target" = "$sha" ]; then echo "PASS $repo@$sha: commit; upstream tag $tag points to it"
    else echo "FAIL $repo@$sha: type=${type:-none}, upstream $tag -> ${target:-absent}"; fail=1; fi
  elif [[ $line =~ ^[[:space:]]*(-[[:space:]])?uses: ]]; then echo "FAIL not pinned with a release comment: $line"; fail=1
  fi
done < "$wf"
[ "$n" -gt 0 ] || { echo "FAIL no action references found"; fail=1; }
echo "action pins: $n distinct pinned action(s), $([ $fail = 0 ] && echo all verified || echo 'NOT all verified')"
exit $fail
