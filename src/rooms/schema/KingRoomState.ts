import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { PlayerState } from "./PlayerState";
import { StoneState } from "./StoneState";

export class KingRoomState extends Schema {
    @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
    @type([StoneState]) stones = new ArraySchema<StoneState>();
}
