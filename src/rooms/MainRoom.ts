import { Room, Client } from "@colyseus/core";
import { MainRoomState } from "./schema/MainRoomState";
import { PlayerState } from "./schema/PlayerState";
import { ParcourPhase } from "./schema/ParcourPhase";
import { MathExampleState } from "./schema/MathExampleState";
import RuCensor from 'russian-bad-word-censor';

const SHOW_COLOR_TIME = 5000;
const HIDE_TIME = 3000;
const MATH_BROADCAST_INTERVAL_MS = 5 * 60 * 1000;

// Ball physics constants
const GRAVITY = -9.81;
const PLAYER_RADIUS = 0.5;

// World bounds
const BOUNDS_MAX = { x: 11.81, y: 5, z: 60 };
const BOUNDS_MIN = { x: -12.16, y: -0.3, z: 45 };

//centrifuge
export const CENTRIFUGE_SPEED = 30;
const MAX_CHAT_MESSAGE_LENGTH = 18;


export class MainRoom extends Room<MainRoomState> {
  maxClients = 4;
  state = new MainRoomState();
  touchedStep = new Set<string>();
  censor = new RuCensor('normal');

  onCreate(options: any) {
    this.setupMessageHandlers();
    this.initializeParcour();
    this.initializeBall();
    this.initializeMathBroadcast();
    this.initializeStepTouchHandler();
    this.initializeCentrifuge();
    this.registerChatHandlers();

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

  private registerChatHandlers() {
    this.onMessage("chat:send", (client, payload) => {
      this.handleChatMessage(client, payload);
    });
  }

  private handleChatMessage(client: Client, payload: any) {
    const text = this.normalizeChatMessage(payload?.message);
    if (!text) return;
    const result = this.censor.replace(text, '*');
    const playerName = this.state.players.get(client.sessionId)?.name ?? "Player";
    this.broadcast("chat:new", `${playerName}: ${result}`);
  }

  private normalizeChatMessage(message: unknown): string {
    return String(message ?? "")
      .trim()
      .slice(0, MAX_CHAT_MESSAGE_LENGTH);
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
  // MATH BROADCAST
  // -------------------------------

  private initializeMathBroadcast() {
    // Сразу генерируем первый пример
    this.updateMathState();
    // Затем обновляем по интервалу
    this.clock.setInterval(() => {
      this.updateMathState();
    }, MATH_BROADCAST_INTERVAL_MS);
  }

  private updateMathState() {
    const examples = Array.from({ length: 5 }, () => this.createMathExample());
    const mathState = this.state.math;
    mathState.examples.clear();
    examples.forEach((example) => mathState.examples.push(example));
    mathState.generatedAt = Date.now();
  }

  private createMathExample() {
    const op = Math.random() < 0.5 ? "+" : "-";
    let a = 0;
    let b = 0;
    let result = 0;

    if (op === "+") {
      do {
        a = this.randomInt(0, 100);
        b = this.randomInt(0, 100);
        result = a + b;
      } while (result > 100);
    } else {
      a = this.randomInt(0, 100);
      b = this.randomInt(0, a);
      result = a - b;
    }

    let wrong = this.randomInt(0, 100);
    while (wrong === result) {
      wrong = this.randomInt(0, 100);
    }

    const correctIndex = this.randomInt(0, 1);

    const example = new MathExampleState();
    example.expression = `${a}${op}${b}`;
    example.correct = result;
    example.wrong = wrong;
    example.correctIndex = correctIndex;
    return example;
  }

  private randomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
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
    ball.objectType = "ball";
    ball.x = (BOUNDS_MIN.x + BOUNDS_MAX.x) / 2;
    ball.y = 2; // Start at 2 meters height
    ball.z = (BOUNDS_MIN.z + BOUNDS_MAX.z) / 2;
    ball.vx = 0;
    ball.vy = 0;
    ball.vz = 0;
    // Set object-specific physical parameters (you can change these per-object)
    ball.radius = 1;
    ball.bounciness = 0.8;
    ball.friction = 0.99;
    ball.playerBounciness = 0.8;
    // By default the ball uses the shared world bounds; to change bounds for
    // this object set `useWorldBounds = false` and fill `boundsMin`/`boundsMax`.
    ball.useWorldBounds = true;
  }

  private updateBall(deltaTime: number) {
    const ball = this.state.ball;

    // Apply gravity
    ball.vy += GRAVITY * deltaTime;

    // Update position
    ball.x += ball.vx * deltaTime;
    ball.y += ball.vy * deltaTime;
    ball.z += ball.vz * deltaTime;

    // Determine which bounds to use for this object
    const objBoundsMin = ball.useWorldBounds ? BOUNDS_MIN : { x: ball.boundsMin.x, y: ball.boundsMin.y, z: ball.boundsMin.z };
    const objBoundsMax = ball.useWorldBounds ? BOUNDS_MAX : { x: ball.boundsMax.x, y: ball.boundsMax.y, z: ball.boundsMax.z };

    // Apply friction only when on ground
    const isOnGround = ball.y - ball.radius <= objBoundsMin.y + 0.01;
    if (isOnGround) {
      ball.vx *= ball.friction;
      ball.vz *= ball.friction;
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
      const collisionDist = ball.radius + PLAYER_RADIUS;

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
          // Apply bounce using per-object player bounciness
          ball.vx -= (1 + ball.playerBounciness) * velAlongNormal * nx;
          ball.vy -= (1 + ball.playerBounciness) * velAlongNormal * ny;
          ball.vz -= (1 + ball.playerBounciness) * velAlongNormal * nz;
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

    // Determine which bounds to use for this object
    const objBoundsMin = ball.useWorldBounds ? BOUNDS_MIN : { x: ball.boundsMin.x, y: ball.boundsMin.y, z: ball.boundsMin.z };
    const objBoundsMax = ball.useWorldBounds ? BOUNDS_MAX : { x: ball.boundsMax.x, y: ball.boundsMax.y, z: ball.boundsMax.z };

    // Ground collision
    if (ball.y - ball.radius <= objBoundsMin.y) {
      ball.y = objBoundsMin.y + ball.radius;
      ball.vy = Math.abs(ball.vy) * ball.bounciness;
    }

    // Ceiling collision (top)
    if (ball.y + ball.radius > objBoundsMax.y) {
      ball.y = objBoundsMax.y - ball.radius;
      ball.vy = -ball.vy * ball.bounciness;
    }

    // X-axis boundaries
    if (ball.x - ball.radius < objBoundsMin.x) {
      ball.x = objBoundsMin.x + ball.radius;
      ball.vx = -ball.vx * ball.bounciness;
    }
    if (ball.x + ball.radius > objBoundsMax.x) {
      ball.x = objBoundsMax.x - ball.radius;
      ball.vx = -ball.vx * ball.bounciness;
    }

    // Z-axis boundaries
    if (ball.z - ball.radius < objBoundsMin.z) {
      ball.z = objBoundsMin.z + ball.radius;
      ball.vz = -ball.vz * ball.bounciness;
    }
    if (ball.z + ball.radius > objBoundsMax.z) {
      ball.z = objBoundsMax.z - ball.radius;
      ball.vz = -ball.vz * ball.bounciness;
    }
  }

  initializeStepTouchHandler() {
      this.onMessage("step_touch", (client: Client, data) => {
      const id = data;
      if (!id) return;

      //if (this.touchedStep.has(id)) return; // уже исчезает/исчезла
      this.touchedStep.add(id);

      this.broadcast("step_fade", { id });
    });
  }

  initializeCentrifuge() {
      this.clock.setInterval(() => {

      const degPerSec = CENTRIFUGE_SPEED * 6; // rpm * 360 / 60
      const deltaSec = this.clock.deltaTime / 1000;

      this.state.centrifugeAngle += degPerSec * deltaSec;

      // держим 0–360
      this.state.centrifugeAngle %= 360;

    }, 16); // ~60 FPS обновление
  }
}
