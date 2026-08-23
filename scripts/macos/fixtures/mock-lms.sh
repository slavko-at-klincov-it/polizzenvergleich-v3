#!/bin/bash
set -e
chat_identifier="${POLICY_MOCK_LMS_CHAT_IDENTIFIER:-qwen/qwen3.8-27b}"
chat_model_key="${POLICY_MOCK_LMS_CHAT_MODEL_KEY:-qwen/qwen3.8-27b}"
case "$1 $2" in
  "daemon up") exit 0 ;;
  "server status") printf '%s\n' 'Server is running on port 1234'; exit 0 ;;
  "ps --json")
    printf '%s\n' "[{\"type\":\"llm\",\"modelKey\":\"$chat_model_key\",\"identifier\":\"$chat_identifier\",\"contextLength\":${POLICY_MOCK_LMS_CONTEXT:-42496},\"parallel\":${POLICY_MOCK_LMS_PARALLEL:-1}},{\"type\":\"embedding\",\"modelKey\":\"text-embedding-dinghy-law-4b-v1\",\"indexedModelIdentifier\":\"Hanno-Labs/dinghy-law-4b-v1-gguf/dinghy-law-4b-v1-Q6_K.gguf\",\"identifier\":\"dinghy-embed\",\"contextLength\":8192}]"
    exit 0
    ;;
  "ls --json")
    printf '%s\n' '[{"type":"llm","modelKey":"qwen/qwen3.8-27b","indexedModelIdentifier":"qwen/qwen3.8-27b@4bit","path":"qwen/qwen3.8-27b@4bit"},{"type":"llm","modelKey":"google/gemma-4-26b-a4b","indexedModelIdentifier":"google/gemma-4-26b-a4b","path":"google/gemma-4-26b-a4b"},{"type":"embedding","modelKey":"text-embedding-dinghy-law-4b-v1","indexedModelIdentifier":"Hanno-Labs/dinghy-law-4b-v1-gguf/dinghy-law-4b-v1-Q6_K.gguf","path":"Hanno-Labs/dinghy-law-4b-v1-gguf/dinghy-law-4b-v1-Q6_K.gguf"}]'
    exit 0
    ;;
  *) printf 'unexpected mock lms call: %s\n' "$*" >&2; exit 1 ;;
esac
