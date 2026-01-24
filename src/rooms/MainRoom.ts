import { Room, Client } from "@colyseus/core";
import { MainRoomState } from "./schema/MainRoomState";
import { PlayerState } from "./schema/PlayerState";

export class MainRoom extends Room<MainRoomState> {
  maxClients = 4;
  state = new MainRoomState();

  onCreate (options: any) {
    this.onMessage("pos", (client, message) => {
      this.state.players.get(client.sessionId)!.x = message.x;
      this.state.players.get(client.sessionId)!.y = message.y;
      this.state.players.get(client.sessionId)!.z = message.z;
    });
    
    this.onMessage("rotate", (client, yaw: number) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      player.rotY = yaw;
    });
  }

  onJoin (client: Client, options: any) {
    this.state.players.set(client.sessionId, new PlayerState());
    this.state.players.get(client.sessionId)!.appearance = options.appearance;
    console.log(client.sessionId, "joined!");
  }

  onLeave (client: Client, consented: boolean) {
    console.log(client.sessionId, "left!");
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }

}
