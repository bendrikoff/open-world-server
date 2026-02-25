import { Schema, type } from "@colyseus/schema";

export class ParcourState extends Schema {

  @type("number")
  currentColor: number = 0;

  @type("number")
  phase: number = 0; 

  @type("number")
  nextChangeAt: number = 0;
}
