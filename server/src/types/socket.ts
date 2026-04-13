import { Socket } from "socket.io"

type SocketId = string

enum SocketEvent {
	JOIN_REQUEST = "join-request",
	JOIN_ACCEPTED = "join-accepted",
	USER_JOINED = "user-joined",
	USER_DISCONNECTED = "user-disconnected",
	SYNC_FILE_STRUCTURE = "sync-file-structure",
	DIRECTORY_CREATED = "directory-created",
	DIRECTORY_UPDATED = "directory-updated",
	DIRECTORY_RENAMED = "directory-renamed",
	DIRECTORY_DELETED = "directory-deleted",
	FILE_CREATED = "file-created",
	FILE_UPDATED = "file-updated",
	FILE_RENAMED = "file-renamed",
	FILE_DELETED = "file-deleted",
	USER_OFFLINE = "offline",
	USER_ONLINE = "online",
	SEND_MESSAGE = "send-message",
	RECEIVE_MESSAGE = "receive-message",
	TYPING_START = "typing-start",
	TYPING_PAUSE = "typing-pause",
	CURSOR_MOVE = "cursor-move",
	USERNAME_EXISTS = "username-exists",
	REQUEST_DRAWING = "request-drawing",
	SYNC_DRAWING = "sync-drawing",
	DRAWING_UPDATE = "drawing-update",

	// ── Code Execution ────────────────────────────────────────────────────
	/** Client → Server: submit code for execution */
	RUN_CODE       = "run:code",
	/** Client → Server: kill the currently running job */
	RUN_KILL       = "run:kill",
	/** Server → Client: a chunk of stdout */
	RUN_STDOUT     = "run:stdout",
	/** Server → Client: a chunk of stderr */
	RUN_STDERR     = "run:stderr",
	/** Server → Client: process exited (normal or timeout) */
	RUN_DONE       = "run:done",
	/** Server → Client: infrastructure / unsupported-language error */
	RUN_ERROR      = "run:error",
	/** Server → Client: execution started acknowledgement */
	RUN_STARTED    = "run:started",
}

interface SocketContext {
	socket: Socket
}

export { SocketEvent, SocketContext, SocketId }