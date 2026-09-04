export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";
export type BoardRole = "OWNER" | "EDITOR" | "VIEWER";
export type NotificationType =
  | "CARD_ASSIGNED"
  | "CARD_COMMENT"
  | "CARD_DUE_SOON"
  | "MENTION"
  | "CHANNEL_INVITE"
  | "WORKSPACE_INVITE";

export interface UserDto {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface WorkspaceDto {
  id: string;
  name: string;
  ownerId: string;
}

export interface WorkspaceMemberDto {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
}

export interface BoardDto {
  id: string;
  workspaceId: string;
  name: string;
  background: string | null;
}

export interface BoardMemberDto {
  userId: string;
  boardId: string;
  role: BoardRole;
}

export interface ListDto {
  id: string;
  boardId: string;
  name: string;
  position: number;
}

export interface CardDto {
  id: string;
  listId: string;
  title: string;
  description: string | null;
  position: number;
  startDate: string | null;
  dueDate: string | null;
  coverColor: string | null;
}

export interface LabelDto {
  id: string;
  boardId: string;
  name: string;
  color: string;
}

export interface AttachmentDto {
  id: string;
  cardId: string;
  url: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  createdAt: string;
}

export interface CardDetailDto extends CardDto {
  labels: LabelDto[];
  members: UserDto[];
  comments: CommentDto[];
  attachments: AttachmentDto[];
}

export interface BoardCardDto extends CardDto {
  labels: LabelDto[];
}

export interface ListWithCardsDto extends ListDto {
  cards: BoardCardDto[];
}

export interface BoardDetailDto extends BoardDto {
  lists: ListWithCardsDto[];
  labels: LabelDto[];
}

export interface CommentDto {
  id: string;
  cardId: string;
  userId: string;
  body: string;
  createdAt: string;
  user: UserDto;
}

export interface ChannelDto {
  id: string;
  workspaceId: string;
  name: string;
  isPrivate: boolean;
}

export interface MessageDto {
  id: string;
  channelId: string;
  userId: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  user: UserDto;
}

export interface NotificationDto {
  id: string;
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}
