import { Room, Client } from "@colyseus/core";
import { MainRoomState } from "./schema/MainRoomState";
import { PlayerState } from "./schema/PlayerState";
import { ParcourPhase } from "./schema/ParcourPhase";
import { MathExampleState } from "./schema/MathExampleState";
import RuCensor from 'russian-bad-word-censor';
import { registerChat } from "../services/chat";
import {
  clearClientPlatformIdentity,
  PlayerJoinOptions,
  storeClientPlatformIdentity,
} from "../services/platformIdentity";
import { normalizePlayerName, sanitizeRichText } from "../services/userText";

const SHOW_COLOR_TIME = 2000;
const HIDE_TIME = 2000;
const MATH_BROADCAST_INTERVAL_MS = 2 * 60 * 1000;

// Ball physics constants
const GRAVITY = -9.81;
const PLAYER_RADIUS = 0.5;
const BALL_MASS = 1.2;            // heavier ball – feels "weighty"
const AIR_DRAG = 0.993;           // per-tick multiplier (slight air resistance)
const GROUND_FRICTION = 0.88;     // strong ground drag per tick
const ROLLING_FRICTION = 0.98;    // rolling slowdown
const KICK_BASE_IMPULSE = 1.2;    // minimum impulse from any contact
const KICK_SPEED_MULTIPLIER = 1.2;// how much player speed amplifies the kick
const KICK_UPWARD_RATIO = 0.12;   // less upward lift – heavier ball stays lower
const VELOCITY_DEADZONE = 0.05;   // stop ball below this speed
const BOUNCE_DEADZONE = 0.5;      // stop vertical bounce below this vy
const PHYSICS_DT = 1 / 30;        // 30 Hz physics step
const ANGULAR_DAMPING = 0.98;     // spin slowdown per tick
const ANGULAR_GROUND_DAMPING = 0.95; // extra spin damping when on ground
const SPIN_FROM_KICK = 4.0;       // how much spin a kick imparts

// World bounds
const BOUNDS_MAX = { x: 11.81, y: 5, z: 60 };
const BOUNDS_MIN = { x: -12.16, y: -0.3, z: 45 };

//centrifuge
export const CENTRIFUGE_SPEED = 30;


export class MainRoom extends Room<MainRoomState> {
  maxClients = 100;
  state = new MainRoomState();
  touchedStep = new Set<string>();
  censor = new RuCensor('normal');

  // Player velocity tracking (sessionId -> previous position)
  private prevPlayerPos = new Map<string, { x: number; y: number; z: number }>();
  private playerVelocities = new Map<string, { vx: number; vy: number; vz: number }>();

  onCreate(options: any) {
    this.setupMessageHandlers();
    this.initializeParcour();
    this.initializeBall();
    this.initializeMathBroadcast();
    this.initializeStepTouchHandler();
    this.initializeCentrifuge();
    registerChat(this);
    
  }

  onJoin(client: Client, options: PlayerJoinOptions) {
    storeClientPlatformIdentity(client, options);

    const player = new PlayerState();
    player.appearance = options.appearance;
    player.name = sanitizeRichText(
      this.censor.replace(normalizePlayerName(options.player_name), "*"),
    );
    client.send("server_time", {
      //serverTime: Date.now()
      serverTime: new Date("2026-05-24T12:00:00Z").getTime()
    });

    this.state.players.set(client.sessionId, player);
    console.log(client.sessionId, "joined!");
  }

  onLeave(client: Client) {
    clearClientPlatformIdentity(client);
    this.state.players.delete(client.sessionId);
    this.prevPlayerPos.delete(client.sessionId);
    this.playerVelocities.delete(client.sessionId);
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

    // единый серверный тик – parcour on its own slower cadence
    this.clock.setInterval(() => {
      this.updateParcour();
    }, 100);

    // Ball physics at 30 Hz for smoother, more realistic behaviour
    this.clock.setInterval(() => {
      this.updatePlayerVelocities(PHYSICS_DT);
      this.updateBall(PHYSICS_DT);
    }, Math.round(PHYSICS_DT * 1000));
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
    ball.radius = 0.7;
    ball.bounciness = 0.5;          // heavier ball bounces less
    ball.friction = 0.88;            // kept for schema compat
    ball.playerBounciness = 0.2;     // soft bounce off players
    // By default the ball uses the shared world bounds; to change bounds for
    // this object set `useWorldBounds = false` and fill `boundsMin`/`boundsMax`.
    ball.useWorldBounds = true;
  }

  /** Estimate player velocities from position deltas */
  private updatePlayerVelocities(dt: number) {
    this.state.players.forEach((player, sessionId) => {
      const prev = this.prevPlayerPos.get(sessionId);
      if (prev) {
        const invDt = 1 / dt;
        this.playerVelocities.set(sessionId, {
          vx: (player.x - prev.x) * invDt,
          vy: (player.y - prev.y) * invDt,
          vz: (player.z - prev.z) * invDt,
        });
      }
      this.prevPlayerPos.set(sessionId, { x: player.x, y: player.y, z: player.z });
    });
  }

  private updateBall(deltaTime: number) {
    const ball = this.state.ball;

    // Apply gravity
    ball.vy += GRAVITY * deltaTime;

    // Air drag (acts on all axes always)
    ball.vx *= AIR_DRAG;
    ball.vy *= AIR_DRAG;
    ball.vz *= AIR_DRAG;

    // Update position
    ball.x += ball.vx * deltaTime;
    ball.y += ball.vy * deltaTime;
    ball.z += ball.vz * deltaTime;

    // Determine which bounds to use for this object
    const objBoundsMin = ball.useWorldBounds ? BOUNDS_MIN : { x: ball.boundsMin.x, y: ball.boundsMin.y, z: ball.boundsMin.z };

    // Ground friction & rolling resistance
    const isOnGround = ball.y - ball.radius <= objBoundsMin.y + 0.05;
    if (isOnGround) {
      ball.vx *= GROUND_FRICTION;
      ball.vz *= GROUND_FRICTION;
      // Additional rolling friction
      ball.vx *= ROLLING_FRICTION;
      ball.vz *= ROLLING_FRICTION;
    }

    // Check collision with players
    this.checkBallPlayerCollisions();

    // Check collision with boundaries
    this.checkBallBoundaryCollisions();

    // Deadzone: stop micro-movements
    const hSpeed = Math.sqrt(ball.vx * ball.vx + ball.vz * ball.vz);
    if (hSpeed < VELOCITY_DEADZONE && isOnGround) {
      ball.vx = 0;
      ball.vz = 0;
    }

    // --- Angular velocity / spin ---
    // Apply angular damping
    ball.avx *= ANGULAR_DAMPING;
    ball.avy *= ANGULAR_DAMPING;
    ball.avz *= ANGULAR_DAMPING;

    if (isOnGround) {
      // Extra ground damping
      ball.avx *= ANGULAR_GROUND_DAMPING;
      ball.avy *= ANGULAR_GROUND_DAMPING;
      ball.avz *= ANGULAR_GROUND_DAMPING;

      // Ground rolling: linear velocity drives rotation around the perpendicular axis
      // Moving along +Z => spin around X; moving along +X => spin around -Z
      if (hSpeed > 0.01) {
        const rollRate = hSpeed / ball.radius; // rad/s
        // Blend toward rolling contact angular velocity (don't overwrite spin)
        const blend = 0.3;
        ball.avx += ((-ball.vz / hSpeed) * rollRate - ball.avx) * blend;
        ball.avz += ((ball.vx / hSpeed) * rollRate - ball.avz) * blend;
      }
    }

    // Deadzone for spin
    const spinSpeed = Math.sqrt(ball.avx * ball.avx + ball.avy * ball.avy + ball.avz * ball.avz);
    if (spinSpeed < 0.05 && isOnGround) {
      ball.avx = 0;
      ball.avy = 0;
      ball.avz = 0;
    }

    // Integrate angular velocity into rotation angles
    ball.rotX += ball.avx * deltaTime;
    ball.rotY += ball.avy * deltaTime;
    ball.rotZ += ball.avz * deltaTime;
  }

  private checkBallPlayerCollisions() {
    const ball = this.state.ball;

    this.state.players.forEach((player, sessionId) => {
      const dx = ball.x - player.x;
      const dy = ball.y - player.y;
      const dz = ball.z - player.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      const collisionDist = ball.radius + PLAYER_RADIUS;

      if (distSq < collisionDist * collisionDist && distSq > 0) {
        const dist = Math.sqrt(distSq);

        // Collision normal (ball – player)
        const nx = dx / dist;
        const ny = dy / dist;
        const nz = dz / dist;

        // Separate ball from player (resolve overlap)
        ball.x = player.x + nx * (collisionDist + 0.01);
        ball.y = player.y + ny * (collisionDist + 0.01);
        ball.z = player.z + nz * (collisionDist + 0.01);

        // --- velocity-dependent kick ---
        const pv = this.playerVelocities.get(sessionId) || { vx: 0, vy: 0, vz: 0 };
        const playerSpeed = Math.sqrt(pv.vx * pv.vx + pv.vy * pv.vy + pv.vz * pv.vz);

        // Impulse magnitude scales with how fast the player is moving
        const kickMag = KICK_BASE_IMPULSE + playerSpeed * KICK_SPEED_MULTIPLIER;

        // Kick direction: blend collision normal with player's movement direction
        let kdx = nx;
        let kdy = ny;
        let kdz = nz;
        if (playerSpeed > 0.5) {
          // Mix in player velocity direction (60 % movement, 40 % collision normal)
          const invSpeed = 1 / playerSpeed;
          kdx = nx * 0.4 + pv.vx * invSpeed * 0.6;
          kdy = ny * 0.4 + pv.vy * invSpeed * 0.6;
          kdz = nz * 0.4 + pv.vz * invSpeed * 0.6;
          // Re-normalise
          const len = Math.sqrt(kdx * kdx + kdy * kdy + kdz * kdz) || 1;
          kdx /= len;
          kdy /= len;
          kdz /= len;
        }

        // Remove ball velocity component moving into the player (bounce)
        const velAlongNormal = ball.vx * nx + ball.vy * ny + ball.vz * nz;
        if (velAlongNormal < 0) {
          ball.vx -= (1 + ball.playerBounciness) * velAlongNormal * nx;
          ball.vy -= (1 + ball.playerBounciness) * velAlongNormal * ny;
          ball.vz -= (1 + ball.playerBounciness) * velAlongNormal * nz;
        }

        // Apply kick impulse in the blended direction
        ball.vx += kdx * kickMag;
        ball.vy += kdy * kickMag + kickMag * KICK_UPWARD_RATIO; // slight upward lift
        ball.vz += kdz * kickMag;

        // Impart spin from kick (cross product of kick direction × up gives side-spin,
        // cross of kick direction × right gives top-spin)
        // Simplified: kick along XZ plane produces top-spin (avx, avz) + side-spin (avy)
        const spinMag = kickMag * SPIN_FROM_KICK;
        ball.avx += -kdz * spinMag;  // top/back-spin from Z component
        ball.avy += (kdx * nz - kdz * nx) * spinMag * 0.5; // side-spin
        ball.avz += kdx * spinMag;   // top/back-spin from X component

        // Clamp maximum ball speed to keep things controllable
        const maxSpeed = 20;
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy + ball.vz * ball.vz);
        if (speed > maxSpeed) {
          const scale = maxSpeed / speed;
          ball.vx *= scale;
          ball.vy *= scale;
          ball.vz *= scale;
        }
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
      if (Math.abs(ball.vy) < BOUNCE_DEADZONE) {
        ball.vy = 0; // stop micro-bouncing
      } else {
        ball.vy = Math.abs(ball.vy) * ball.bounciness;
      }
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
