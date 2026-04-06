import { MapSchema, Schema, type } from "@colyseus/schema";
import { PlayerState } from "./PlayerState";

export class SquidDollRoomState extends Schema {
    @type({ map: PlayerState }) players = new MapSchema<PlayerState>();

    /** true = green light (can move), false = red light (stop) */
    @type("boolean") greenLight: boolean = true;

    /** Countdown from 180 to 0 while greenLight is true; always 0 when red */
    @type("number") countdown: number = 180;

    /** Duration of each phase in seconds (default 3) */
    @type("number") phaseDuration: number = 3;
}
