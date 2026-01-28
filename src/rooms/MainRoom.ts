import { Room, Client } from "@colyseus/core";
import { MainRoomState } from "./schema/MainRoomState";
import { PlayerState } from "./schema/PlayerState";
import { ParcourPhase } from "./schema/ParcourPhase";

const SHOW_COLOR_TIME = 5000;
const HIDE_TIME = 3000;

// Ball physics constants
const GRAVITY = -9.81;
const BALL_RADIUS = 1;
const BOUNCINESS = 0.8;
const FRICTION = 0.99;
const PLAYER_RADIUS = 0.5;
const BALL_PLAYER_BOUNCINESS = 0.8;

// World bounds
const BOUNDS_MIN = { x: -11.87, y: 0, z: -7.5 };
const BOUNDS_MAX = { x: 12.08, y: 10, z: 7.37 };


export class MainRoom extends Room<MainRoomState> {
  maxClients = 4;
  state = new MainRoomState();

  onCreate(options: any) {
    this.setupMessageHandlers();
    this.initializeParcour();
    this.initializeBall();
  }

  onJoin(client: Client, options: any) {
    const player = new PlayerState();
    player.appearance = options.appearance;
    player.name = options.player_name;

    this.state.players.set(client.sessionId, player);
    console.log(client.sessionId, "joined!");
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    console.log(client.sessionId, "left!");
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }

  // -------------------------------
  // PARCOUR LOGIC (FSM)
  // -------------------------------

  private initializeParcour() {
    const p = this.state.parcour;

    p.currentColor = this.getRandomColor();
    p.phase = ParcourPhase.ShowColor;
    p.nextChangeAt = Date.now() + SHOW_COLOR_TIME;

    // единый серверный тик
    this.clock.setInterval(() => {
      this.updateParcour();
      this.updateBall(0.1); // 100ms = 0.1s
    }, 100);
  }

  private updateParcour() {
    const p = this.state.parcour;
    const now = Date.now();

    if (now < p.nextChangeAt) return;

    switch (p.phase) {

      // 1️⃣ Цвет показан → через 5 сек убираем клетки
      case ParcourPhase.ShowColor:
        p.phase = ParcourPhase.HideCells;
        p.nextChangeAt = now + HIDE_TIME;
        break;

      // 2️⃣ Клетки убраны → выбираем новый цвет
      case ParcourPhase.HideCells:
        p.currentColor = this.getRandomColor();
        p.phase = ParcourPhase.ShowColor;
        p.nextChangeAt = now + SHOW_COLOR_TIME;
        break;
    }
  }

  // -------------------------------
  // MESSAGES
  // -------------------------------

  private setupMessageHandlers() {
    this.onMessage("pos", (client, message) => {
      this.handlePlayerPosition(client, message);
    });

    this.onMessage("rotate", (client, yaw: number) => {
      this.handlePlayerRotation(client, yaw);
    });
  }

  private handlePlayerPosition(client: Client, message: any) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    player.x = message.x;
    player.y = message.y;
    player.z = message.z;
  }

  private handlePlayerRotation(client: Client, yaw: number) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    player.rotY = yaw;
  }

  // -------------------------------
  // HELPERS
  // -------------------------------

  private getRandomColor(): number {
    const colors = [
      0, //Red
      1, //Blue
      2, //Green
      3  //Yellow
    ]; 
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // -------------------------------
  // BALL PHYSICS
  // -------------------------------

  private initializeBall() {
    const ball = this.state.ball;
    // Start ball in the center of the field
    ball.x = (BOUNDS_MIN.x + BOUNDS_MAX.x) / 2;
    ball.y = 2; // Start at 2 meters height
    ball.z = (BOUNDS_MIN.z + BOUNDS_MAX.z) / 2;
    ball.vx = 0;
    ball.vy = 0;
    ball.vz = 0;
  }

  private updateBall(deltaTime: number) {
    const ball = this.state.ball;

    // Apply gravity
    ball.vy += GRAVITY * deltaTime;

    // Update position
    ball.x += ball.vx * deltaTime;
    ball.y += ball.vy * deltaTime;
    ball.z += ball.vz * deltaTime;

    // Apply friction only when on ground
    const isOnGround = ball.y - BALL_RADIUS <= BOUNDS_MIN.y + 0.01;
    if (isOnGround) {
      ball.vx *= FRICTION;
      ball.vz *= FRICTION;
    }

    // Check collision with players
    this.checkBallPlayerCollisions();

    // Check collision with boundaries
    this.checkBallBoundaryCollisions();

    // Update rotation
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vz * ball.vz);
    if (speed > 0.01) {
      ball.rotX += speed * deltaTime * 10;
      ball.rotZ += (ball.vx / speed) * deltaTime * 5;
    }
  }

  private checkBallPlayerCollisions() {
    const ball = this.state.ball;

    this.state.players.forEach((player) => {
      const dx = ball.x - player.x;
      const dy = ball.y - player.y;
      const dz = ball.z - player.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      const collisionDist = BALL_RADIUS + PLAYER_RADIUS;

      if (distSq < collisionDist * collisionDist && distSq > 0) {
        const dist = Math.sqrt(distSq);
        
        // Normalize collision vector
        const nx = dx / dist;
        const ny = dy / dist;
        const nz = dz / dist;

        // Move ball outside of player
        ball.x = player.x + nx * collisionDist;
        ball.y = player.y + ny * collisionDist;
        ball.z = player.z + nz * collisionDist;

        // Calculate velocity along collision normal
        const velAlongNormal = ball.vx * nx + ball.vy * ny + ball.vz * nz;

        const impulseStrength = 6;
        
        if (velAlongNormal < 0) {
          // Apply bounce
          ball.vx -= (1 + BALL_PLAYER_BOUNCINESS) * velAlongNormal * nx;
          ball.vy -= (1 + BALL_PLAYER_BOUNCINESS) * velAlongNormal * ny;
          ball.vz -= (1 + BALL_PLAYER_BOUNCINESS) * velAlongNormal * nz;
        }
        
        // Add impulse in direction away from player with upward lift
        ball.vx += nx * impulseStrength;
        ball.vy += Math.abs(ny) * impulseStrength + 3.5; // Always add upward component
        ball.vz += nz * impulseStrength;
      }
    });
  }

  private checkBallBoundaryCollisions() {
    const ball = this.state.ball;

    // Ground collision
    if (ball.y - BALL_RADIUS <= BOUNDS_MIN.y) {
      ball.y = BOUNDS_MIN.y + BALL_RADIUS;
      ball.vy = Math.abs(ball.vy) * BOUNCINESS;
    }

    // Ceiling collision (top)
    if (ball.y + BALL_RADIUS > BOUNDS_MAX.y) {
      ball.y = BOUNDS_MAX.y - BALL_RADIUS;
      ball.vy = -ball.vy * BOUNCINESS;
    }

    // X-axis boundaries
    if (ball.x - BALL_RADIUS < BOUNDS_MIN.x) {
      ball.x = BOUNDS_MIN.x + BALL_RADIUS;
      ball.vx = -ball.vx * BOUNCINESS;
    }
    if (ball.x + BALL_RADIUS > BOUNDS_MAX.x) {
      ball.x = BOUNDS_MAX.x - BALL_RADIUS;
      ball.vx = -ball.vx * BOUNCINESS;
    }

    // Z-axis boundaries
    if (ball.z - BALL_RADIUS < BOUNDS_MIN.z) {
      ball.z = BOUNDS_MIN.z + BALL_RADIUS;
      ball.vz = -ball.vz * BOUNCINESS;
    }
    if (ball.z + BALL_RADIUS > BOUNDS_MAX.z) {
      ball.z = BOUNDS_MAX.z - BALL_RADIUS;
      ball.vz = -ball.vz * BOUNCINESS;
    }
  }
}
