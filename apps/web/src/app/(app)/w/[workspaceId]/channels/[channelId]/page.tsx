"use client";

import { useParams } from "next/navigation";
import { MessageThread } from "@/components/chat/message-thread";

export default function ChannelPage() {
  const params = useParams<{ channelId: string }>();
  return <MessageThread channelId={params.channelId} />;
}
