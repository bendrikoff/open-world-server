import { Room, Client } from "@colyseus/core";
import { MapSchema } from "@colyseus/schema";
import { PlayerState } from "../rooms/schema/PlayerState";
import RuCensor from "russian-bad-word-censor";
import {
    DEFAULT_PLAYER_NAME,
    normalizeChatMessage as normalizeChatMessageInput,
    normalizePlayerName,
    sanitizeRichText,
} from "./userText";

const MAX_CHAT_MESSAGE_LENGTH = 60;

interface ChatRoomState {
    players: MapSchema<PlayerState>;
}

const censor = new RuCensor("normal");

/**
 * Registers chat message handlers on any Room whose state has a `players` MapSchema.
 * Call once inside `onCreate`.
 */
export function registerChat(room: Room<ChatRoomState>) {
    room.onMessage("chat:send", (client: Client, payload: any) => {
        const text = normalizeChatMessage(payload?.message);
        if (!text) return;

        const result = sanitizeRichText(censor.replace(text, "*"));
        const playerName =
            room.state.players.get(client.sessionId)?.name ?? DEFAULT_PLAYER_NAME;

        room.broadcast("chat:new", {
            sessionId: client.sessionId,
            nickname: sanitizeRichText(normalizePlayerName(playerName)),
            message: result,
            sentAtUtcMs: Date.now(),
        });
    });
}

function normalizeChatMessage(message: unknown): string {
    return normalizeChatMessageInput(message, MAX_CHAT_MESSAGE_LENGTH);
}
