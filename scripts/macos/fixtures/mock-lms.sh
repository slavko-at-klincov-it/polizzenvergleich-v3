#!/bin/bash
set -e
case "$1 $2" in
  "daemon up") exit 0 ;;
  "server status") printf '%s\n' 'Server is running on port 1234'; exit 0 ;;
  "ps --json")
    printf '%s\n' '[{"type":"llm","modelKey":"gemma-4-26b-a4b-it","indexedModelIdentifier":"mlx-community/gemma-4-26b-a4b-it-4bit","identifier":"policy-chat","contextLength":32768},{"type":"embedding","modelKey":"text-embedding-dinghy-law-4b-v1","indexedModelIdentifier":"Hanno-Labs/dinghy-law-4b-v1-gguf/dinghy-law-4b-v1-Q6_K.gguf","identifier":"dinghy-law","contextLength":8192}]'
    exit 0
    ;;
  *) printf 'unexpected mock lms call: %s\n' "$*" >&2; exit 1 ;;
esac
