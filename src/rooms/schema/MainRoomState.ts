import { MapSchema, Schema, type } from "@colyseus/schema";
import { PlayerState } from "./PlayerState";
export class MainRoomState extends Schema {
    @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
}