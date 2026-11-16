#!/usr/bin/env bash
# Demo 28: Octo says a newer version is there and, on a click, replaces itself with it and starts
# again. The app is packaged twice from these sources, as version 0.1.0 (the one "installed") and
# as 0.2.0 (the one "published"); a publisher on this computer stands for GitHub.
# macOS only: on Windows the same click starts the installer, which this demo does not build.
# TAMPERED=1 publishes a list of checksums that does not match the file: Octo refuses it.
# FORGED=1 signs the list with a key that is not the publisher's; UNSIGNED=1 does not sign it.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root/.tmp/demo-28"
source "$root/demo/lib/project.sh"
OLD=0.1.0
NEW=0.2.0

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Questa demo gira solo su macOS." >&2
  exit 1
fi
arch="$(uname -m | sed 's/x86_64/x64/')"
[[ "$arch" == "arm64" ]] && built="mac-arm64" || built="mac"

cd "$root"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null
make_demo_project "$work"
mkdir -p "$work/Applicazioni" "$work/pubblicati"

package() {
  (cd "$root/apps/desktop" && pnpm exec electron-builder --config electron-builder.yml \
    --publish never --dir --mac "--$arch" "-c.extraMetadata.version=$1" >/dev/null 2>&1)
}
# The Octo that is "installed": version 0.1.0, in a folder that stands for Applications.
package "$OLD"
ditto "$root/apps/desktop/release/$built/Octo.app" "$work/Applicazioni/Octo.app"
# The Octo that is "published": version 0.2.0, zipped as the release workflow does.
package "$NEW"
ditto -c -k --keepParent "$root/apps/desktop/release/$built/Octo.app" \
  "$work/pubblicati/Octo-$NEW-mac-$arch.zip"

mode=""
[[ "${TAMPERED:-0}" == "1" ]] && mode="tampered"
[[ "${FORGED:-0}" == "1" ]] && mode="forged"
[[ "${UNSIGNED:-0}" == "1" ]] && mode="unsigned"
node demo/lib/fake-releases.ts "$work/pubblicati" "$NEW" $mode > "$work/publisher.log" &
publisher=$!
trap 'kill "$publisher" 2>/dev/null || true' EXIT
until [[ "$(wc -l < "$work/publisher.log")" -ge 2 ]]; do sleep 0.1; done

export OCTO_UPDATE_URL="$(sed -n 1p "$work/publisher.log")"
# The key the demo publisher signs with: the real one is built into the app.
export OCTO_UPDATE_KEY="$(sed -n 2p "$work/publisher.log")"
export OCTO_DATA_DIR="$work/dati"
export OCTO_DEMO_IDENTITY="Paola Verdi <pm@example.test>"
export OCTO_DEMO_PLAIN_SECRETS=1
export OCTO_MAIL_ROOT="$work/Mail-assente"
export OCTO_CLAUDE_PATH="$root/demo/lib/fake-claude"

version_of() {
  /usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$work/Applicazioni/Octo.app/Contents/Info.plist"
}
cat <<TXT
Octo installato: $work/Applicazioni/Octo.app (versione $(version_of))
Versione pubblicata: $NEW, da $OCTO_UPDATE_URL
Apro Octo: segui demo/28-aggiornamento/COPIONE.md.
Quando hai finito chiudi Octo e premi Invio qui per fermare la demo.
TXT
"$work/Applicazioni/Octo.app/Contents/MacOS/Octo" >/dev/null 2>&1 || true
read -r _
echo "Octo installato ora: versione $(version_of)"
echo "Richieste arrivate a chi pubblica:"
tail -n +3 "$work/publisher.log"
