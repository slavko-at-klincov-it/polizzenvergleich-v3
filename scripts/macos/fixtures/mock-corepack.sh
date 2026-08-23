#!/bin/bash
set -euo pipefail

if [ "$(basename "$0")" = "yarn" ]; then
  if [ "${POLICY_MOCK_COREPACK_MODE:-ok}" = "wrong-version" ]; then
    printf '%s\n' '4.9.1'
  else
    printf '%s\n' '1.22.22'
  fi
  exit 0
fi

case "${1:-}" in
  enable)
    [ "${POLICY_MOCK_COREPACK_MODE:-ok}" = "no-shim" ] && exit 0
    install_directory=""
    while [ "$#" -gt 0 ]; do
      if [ "$1" = "--install-directory" ]; then
        shift
        install_directory="${1:-}"
        break
      fi
      shift
    done
    [ -n "$install_directory" ]
    /bin/cp "$0" "$install_directory/yarn"
    /bin/chmod 700 "$install_directory/yarn"
    ;;
  prepare)
    [ "${2:-}" = "yarn@1.22.22" ]
    [ "${3:-}" = "--activate" ]
    ;;
  *)
    exit 1
    ;;
esac
