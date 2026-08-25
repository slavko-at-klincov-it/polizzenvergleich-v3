import { useCallback, useSyncExternalStore } from "react";
import chatSessionStore from "@/utils/chat/chatSessionStore.cjs";

export default function useChatSession(sessionKey, initialHistory = []) {
  chatSessionStore.ensureSession(sessionKey, initialHistory);
  const snapshot = useSyncExternalStore(
    useCallback(
      (listener) => chatSessionStore.subscribe(sessionKey, listener),
      [sessionKey]
    ),
    useCallback(() => chatSessionStore.getSnapshot(sessionKey), [sessionKey]),
    useCallback(() => chatSessionStore.getSnapshot(sessionKey), [sessionKey])
  );
  const setLoadingResponse = useCallback(
    (value) =>
      chatSessionStore.setExistingField(sessionKey, "loadingResponse", value),
    [sessionKey]
  );
  const setChatHistory = useCallback(
    (value) => chatSessionStore.setExistingField(sessionKey, "history", value),
    [sessionKey]
  );
  return { ...snapshot, setLoadingResponse, setChatHistory };
}
