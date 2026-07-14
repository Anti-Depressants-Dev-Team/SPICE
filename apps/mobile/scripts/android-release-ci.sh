#!/usr/bin/env bash

set -euo pipefail

MOBILE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_ROOT="$MOBILE_ROOT/android"

required_signing_variables=(
  SPICE_ANDROID_SIGNING_STORE_FILE
  SPICE_ANDROID_SIGNING_STORE_PASSWORD
  SPICE_ANDROID_SIGNING_KEY_ALIAS
  SPICE_ANDROID_SIGNING_KEY_PASSWORD
)

GRADLE_ARGS=(lintRelease testReleaseUnitTest assembleRelease --stacktrace)
missing_signing_variable=''

for variable_name in "${required_signing_variables[@]}"; do
  if [ -z "${!variable_name:-}" ]; then
    missing_signing_variable="$variable_name"
    break
  fi
done

if [ -n "$missing_signing_variable" ]; then
  if [ "${SPICE_ANDROID_ALLOW_EPHEMERAL_SIGNING:-0}" != '1' ]; then
    echo "Android release signing is incomplete: $missing_signing_variable is required." >&2
    exit 1
  fi
  echo "Using ephemeral debug signing for a non-publishing release build check."
  GRADLE_ARGS=("-PspiceAndroidDebugSignRelease=true" "${GRADLE_ARGS[@]}")
elif [ ! -s "$SPICE_ANDROID_SIGNING_STORE_FILE" ]; then
  echo "Android release signing keystore is missing or empty." >&2
  exit 1
fi

pushd "$ANDROID_ROOT"
./gradlew "${GRADLE_ARGS[@]}"

if [ -f "$ANDROID_ROOT/app/build/outputs/apk/release/app-release.apk" ]; then
  echo "Generated signed release APK at app/build/outputs/apk/release/app-release.apk"
else
  echo "Signed release APK not found. Verify the configured release-signing credentials."
  find app/build/outputs -maxdepth 4 -type f -name '*.apk' -print
  exit 1
fi
popd
