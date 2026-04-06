import { Schema, type } from "@colyseus/schema";

export class StoneState extends Schema {
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") z: number = 0;

    @type("number") vx: number = 0;
    @type("number") vy: number = 0;
    @type("number") vz: number = 0;

    @type("number") rotX: number = 0;
    @type("number") rotY: number = 0;
    @type("number") rotZ: number = 0;

    @type("number") radius: number = 10;
}
