import { Schema, type } from "@colyseus/schema";

export class PlayerState extends Schema {
    @type("number") x: number;
    @type("number") y: number;
    @type("number") z: number;
    @type("number") rotY: number;

    @type("string") appearance: string;
    @type("string") name: string;
}