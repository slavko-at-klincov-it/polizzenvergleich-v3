import { ABORT_STREAM_EVENT } from "@/utils/chat";
import chatSessionStore from "@/utils/chat/chatSessionStore.cjs";
import conversationScope from "@/utils/chat/conversationScope.cjs";
import conversationLifecycleCore from "@/utils/chat/conversationLifecycleCore.cjs";

const lifecycle = conversationLifecycleCore.createConversationLifecycle({
  chatSessionStore,
  conversationScope,
  eventTarget: window,
  CustomEventCtor: CustomEvent,
  abortEventName: ABORT_STREAM_EVENT,
});

export const {
  forgetConversationSessions,
  stopConversationSessions,
  stopWorkspaceSessions,
} = lifecycle;
