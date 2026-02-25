import { MapSchema, Schema, type } from "@colyseus/schema";
import { PlayerState } from "./PlayerState";
import { ParcourState } from "./ParcourState";
import { BallState } from "./BallState";
import { KickableState } from "./KickableState";
import { MathState } from "./MathState";

export class MainRoomState extends Schema {
    @type({ map: PlayerState }) players = new MapSchema<PlayerState>();

    @type(ParcourState) parcour = new ParcourState();

    @type(BallState) ball = new BallState();

    @type({ map: KickableState }) kickables = new MapSchema<KickableState>();

    @type(MathState) math = new MathState();

    @type("number") centrifugeAngle = 0;
}