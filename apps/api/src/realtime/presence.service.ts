import { Injectable } from "@nestjs/common";

/** In-memory presence tracking, per board room. Multi-tab aware: a user
 * only counts as "gone" once every socket they had open for that board has
 * disconnected/left. Single-instance only — flagged as a Redis-adapter
 * concern if this API ever runs as more than one process. */
@Injectable()
export class PresenceService {
  private readonly boards = new Map<string, Map<string, Set<string>>>();

  /** Returns true if this is the user's first active socket in the board (a real "join"). */
  join(boardId: string, userId: string, socketId: string): boolean {
    let users = this.boards.get(boardId);
    if (!users) {
      users = new Map();
      this.boards.set(boardId, users);
    }
    let sockets = users.get(userId);
    const isNewUser = !sockets;
    if (!sockets) {
      sockets = new Set();
      users.set(userId, sockets);
    }
    sockets.add(socketId);
    return isNewUser;
  }

  /** Returns true if this was the user's last active socket in the board (a real "leave"). */
  leave(boardId: string, userId: string, socketId: string): boolean {
    const users = this.boards.get(boardId);
    const sockets = users?.get(userId);
    if (!sockets) return false;
    sockets.delete(socketId);
    if (sockets.size === 0) {
      users!.delete(userId);
      if (users!.size === 0) this.boards.delete(boardId);
      return true;
    }
    return false;
  }

  /** Removes a disconnected socket from every board it was present in. */
  leaveAll(socketId: string): Array<{ boardId: string; userId: string }> {
    const departures: Array<{ boardId: string; userId: string }> = [];
    for (const [boardId, users] of this.boards) {
      for (const [userId, sockets] of users) {
        if (sockets.has(socketId) && this.leave(boardId, userId, socketId)) {
          departures.push({ boardId, userId });
        }
      }
    }
    return departures;
  }

  getUsers(boardId: string): string[] {
    return Array.from(this.boards.get(boardId)?.keys() ?? []);
  }
}
