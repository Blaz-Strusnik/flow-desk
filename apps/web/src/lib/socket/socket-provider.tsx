"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "@/lib/auth/token-store";
import { useAuth } from "@/lib/auth/auth-context";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3001";

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    // `auth` as a callback is re-invoked on every (re)connect attempt, so a
    // token refresh doesn't require tearing down and recreating the socket.
    const instance = io(WS_URL, {
      auth: (cb) => cb({ token: getAccessToken() }),
      withCredentials: true,
    });
    // Storing the handle to an external connection this effect just opened
    // — exactly the "subscribe to an external system" case the lint rule's
    // own guidance calls out as correct.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSocket(instance);

    return () => {
      instance.disconnect();
      setSocket(null);
    };
  }, [status]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocket(): Socket | null {
  return useContext(SocketContext);
}
