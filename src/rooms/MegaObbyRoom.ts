import { Room, Client } from "@colyseus/core";
import { MegaObbyRoomState } from "./schema/MegaObbyRoomState";
import { PlayerState } from "./schema/PlayerState";
import { registerChat } from "../services/chat";

export class MegaObbyRoom extends Room<MegaObbyRoomState> {
    maxClients = 20;
    state = new MegaObbyRoomState();

    onCreate(options: any) {
        this.setupMessageHandlers();
        registerChat(this);
    }

    onJoin(client: Client, options: any) {
        const player = new PlayerState();
        player.appearance = options.appearance;
        player.name = options.player_name ?? "Player";

        this.state.players.set(client.sessionId, player);
        console.log(client.sessionId, "joined MegaObbyRoom!");
    }

    onLeave(client: Client) {
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
    }
}
