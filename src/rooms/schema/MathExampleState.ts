import { Schema, type } from "@colyseus/schema";

export class MathExampleState extends Schema {
  @type("string") expression = "";
  @type("number") correct = 0;
  @type("number") wrong = 0;
  @type("number") correctIndex = 0;
}
