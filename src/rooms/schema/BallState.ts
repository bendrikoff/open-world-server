import { Schema, type } from "@colyseus/schema";

export class BallState extends Schema {
    // Position
    @type("number") x: number = 0;
    @type("number") y: number = 5;
    @type("number") z: number = 0;

    // Velocity
    @type("number") vx: number = 0;
    @type("number") vy: number = 0;
    @type("number") vz: number = 0;

    // Angular velocity (for rotation)
    @type("number") rotX: number = 0;
    @type("number") rotY: number = 0;
    @type("number") rotZ: number = 0;
}
