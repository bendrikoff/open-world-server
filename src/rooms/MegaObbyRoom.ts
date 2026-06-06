import { Room, Client } from "@colyseus/core";
import { MegaObbyRoomState } from "./schema/MegaObbyRoomState";
import { PlayerState } from "./schema/PlayerState";
import { registerChat } from "../services/chat";
import {
    clearClientPlatformIdentity,
    PlayerJoinOptions,
    storeClientPlatformIdentity,
} from "../services/platformIdentity";
import { normalizePlayerName, sanitizeRichText } from "../services/userText";

export class MegaObbyRoom extends Room<MegaObbyRoomState> {
    maxClients = 20;
    state = new MegaObbyRoomState();

    onCreate(options: any) {
        this.setupMessageHandlers();
        registerChat(this);
    }

    onJoin(client: Client, options: PlayerJoinOptions) {
        storeClientPlatformIdentity(client, options);

        const player = new PlayerState();
        player.appearance = options.appearance;
        player.name = sanitizeRichText(normalizePlayerName(options.player_name));

        this.state.players.set(client.sessionId, player);
        console.log(client.sessionId, "joined MegaObbyRoom!");
    }

    onLeave(client: Client) {
        clearClientPlatformIdentity(client);
        this.state.players.delete(client.sessionId);
        console.log(client.sessionId, "left MegaObbyRoom!");
    }

    onDispose() {
        console.log("MegaObbyRoom", this.roomId, "disposing...");
    }

    private setupMessageHandlers() {
        this.onMessage("pos", (client, message) => {
            const player = this.state.players.get(client.sessionId);
            if (!player) return;
            player.x = message.x;
            player.y = message.y;
            player.z = message.z;
        });

        this.onMessage("rotate", (client, yaw: number) => {
            const player = this.state.players.get(client.sessionId);
            if (!player) return;
            player.rotY = yaw;
        });

        this.onMessage("appearance", (client, appearance: string) => {
            const player = this.state.players.get(client.sessionId);
            if (!player || typeof appearance !== "string") return;
            player.appearance = appearance;
        });
    }
}
