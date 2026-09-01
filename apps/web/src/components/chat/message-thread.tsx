"use client";

import { format } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useChannelMembers } from "@/hooks/use-channel-members";
import { flattenMessagePages, useMessages, useSendMessage } from "@/hooks/use-messages";
import { renderMessageMarkdown } from "@/lib/markdown";
import { useChatSocket } from "@/lib/socket/use-chat-socket";
import { MessageComposer } from "./message-composer";

export function MessageThread({ channelId }: { channelId: string }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useMessages(channelId);
  const sendMessage = useSendMessage(channelId);
  const { typingUserIds, sendTyping } = useChatSocket(channelId);
  const { data: members } = useChannelMembers(channelId);

  const messages = flattenMessagePages(data?.pages);
  const typingNames = typingUserIds
    .map((id) => members?.find((m) => m.userId === id)?.user.name)
    .filter(Boolean);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        {hasNextPage && (
          <div className="mb-4 flex justify-center">
            <Button size="sm" variant="outline" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
              {isFetchingNextPage ? "Loading..." : "Load older messages"}
            </Button>
          </div>
        )}

        {isLoading && <p className="text-sm text-muted-foreground">Loading messages...</p>}

        <div className="flex flex-col gap-3">
          {messages.map((message) => (
            <div key={message.id} className="flex gap-2">
              <Avatar className="size-8">
                <AvatarFallback className="text-xs">{message.user?.name?.[0] ?? "?"}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">{message.user?.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(message.createdAt), "MMM d, HH:mm")}
                  </span>
                </div>
                <div
                  className="text-sm [&_pre]:my-1"
                  dangerouslySetInnerHTML={{ __html: renderMessageMarkdown(message.body) }}
                />
              </div>
            </div>
          ))}
          {messages.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground">No messages yet — say hello!</p>
          )}
        </div>
      </div>

      {typingNames.length > 0 && (
        <p className="px-4 pb-1 text-xs text-muted-foreground">
          {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing...
        </p>
      )}

      <MessageComposer
        channelId={channelId}
        onSend={(body) => sendMessage.mutate(body)}
        onTyping={sendTyping}
      />
    </div>
  );
}
