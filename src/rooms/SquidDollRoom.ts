import { Room, Client } from "@colyseus/core";
import { SquidDollRoomState } from "./schema/SquidDollRoomState";
import { PlayerState } from "./schema/PlayerState";
import { registerChat } from "../services/chat";
import {
    clearClientPlatformIdentity,
    PlayerJoinOptions,
    storeClientPlatformIdentity,
} from "../services/platformIdentity";

const COUNTDOWN_MAX = 180;
const PHASE_DURATION_SEC = 3;
const TICK_INTERVAL_MS = 100; // 10 Hz tick

export class SquidDollRoom extends Room<SquidDollRoomState> {
    maxClients = 20;
    state = new SquidDollRoomState();

    private phaseTimer = 0; // accumulated ms in current phase
    private countdownTimer = 0; // accumulated ms for countdown decrement

    onCreate(options: any) {
        this.state.phaseDuration = PHASE_DURATION_SEC;
        this.state.greenLight = true;
        this.state.countdown = COUNTDOWN_MAX;

        this.setupMessageHandlers();
        registerChat(this);

        this.clock.setInterval(() => {
            this.tick(TICK_INTERVAL_MS);
        }, TICK_INTERVAL_MS);
    }

    onJoin(client: Client, options: PlayerJoinOptions) {
        storeClientPlatformIdentity(client, options);

        const player = new PlayerState();
        player.appearance = options.appearance;
        player.name = options.player_name ?? "Player";

        this.state.players.set(client.sessionId, player);
        console.log(client.sessionId, "joined SquidDollRoom!");
    }

    onLeave(client: Client) {
        clearClientPlatformIdentity(client);
        this.state.players.delete(client.sessionId);
        console.log(client.sessionId, "left SquidDollRoom!");
    }

    onDispose() {
        console.log("SquidDollRoom", this.roomId, "disposing...");
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

    private tick(dt: number) {
        const phaseDurationMs = this.state.phaseDuration * 1000;

        // Phase switching timer
        this.phaseTimer += dt;
        if (this.phaseTimer >= phaseDurationMs) {
            this.phaseTimer -= phaseDurationMs;
            this.state.greenLight = !this.state.greenLight;

            // When switching to red light, force countdown to 0
            if (!this.state.greenLight) {
                this.state.countdown = 0;
                this.countdownTimer = 0;
            } else {
                // Switching to green light – reset countdown to max
                this.state.countdown = COUNTDOWN_MAX;
                this.countdownTimer = 0;
            }
        }

        // Countdown logic: only counts down during green light
        if (this.state.greenLight && this.state.countdown > 0) {
            this.countdownTimer += dt;
            // Decrement once per tick proportionally
            const step = (COUNTDOWN_MAX / phaseDurationMs) * dt;
            this.state.countdown = Math.max(0, this.state.countdown - step);
        }
    }
}
