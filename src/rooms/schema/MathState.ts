import { ArraySchema, Schema, type } from "@colyseus/schema";
import { MathExampleState } from "./MathExampleState";

export class MathState extends Schema {
  @type([MathExampleState]) examples = new ArraySchema<MathExampleState>();
  @type("number") generatedAt = 0;
}
