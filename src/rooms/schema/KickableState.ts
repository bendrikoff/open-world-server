import { Schema, type } from "@colyseus/schema";

export class Vec3Data extends Schema {
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") z: number = 0;
}

export class KickableState extends Schema {
    // Object type identifier (e.g., "ball", "poop")
    @type("string") objectType: string = "ball";

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

    // Physical parameters (configurable per-object)
    @type("number") radius: number = 1;
    @type("number") bounciness: number = 0.8;
    @type("number") friction: number = 0.99;
    @type("number") playerBounciness: number = 0.8;

    // Per-object bounds (if `useWorldBounds` is false these are used)
    @type(Vec3Data) boundsMin: Vec3Data = new Vec3Data();
    @type(Vec3Data) boundsMax: Vec3Data = new Vec3Data();
    // If true, the server will use the shared world bounds instead of the
    // per-object bounds. This makes it easy to create objects that either
    // respect the global arena or have their own limited area.
    @type("boolean") useWorldBounds: boolean = true;
}
