import { MapSchema, Schema, type } from "@colyseus/schema";
import { PlayerState } from "./PlayerState";
import { ParcourState } from "./ParcourState";
import { BallState } from "./BallState";

export class MainRoomState extends Schema {
    @type({ map: PlayerState }) players = new MapSchema<PlayerState>();

    @type(ParcourState) parcour = new ParcourState();

    @type(BallState) ball = new BallState();
}