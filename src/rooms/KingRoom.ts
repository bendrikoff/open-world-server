import { Room, Client } from "@colyseus/core";
import { KingRoomState } from "./schema/KingRoomState";
import { PlayerState } from "./schema/PlayerState";
import { StoneState } from "./schema/StoneState";
import { registerChat } from "../services/chat";
import {
    clearClientPlatformIdentity,
    PlayerJoinOptions,
    storeClientPlatformIdentity,
} from "../services/platformIdentity";
import { normalizePlayerName, sanitizeRichText } from "../services/userText";

// Stone physics constants
const GRAVITY = 9.81;
const SLOPE_ANGLE_DEG = 20; // surface rotation (-20, 0, 0)
const SLOPE_ANGLE_RAD = (SLOPE_ANGLE_DEG * Math.PI) / 180;
const STONE_COUNT = 5;
const PHYSICS_DT = 1 / 30;
const STONE_RADIUS = 5;
const SPIN_MULTIPLIER = 25;

// Initial velocity range (stones already rolling when they appear)
const INITIAL_SPEED_MIN = 8;
const INITIAL_SPEED_MAX = 14;
const X_DRIFT_STRENGTH = 0.15; // reduced to prevent X boundary violations

// Bounce constants
const NORMAL_GRAVITY = GRAVITY * Math.cos(SLOPE_ANGLE_RAD); // gravity perpendicular to slope ~9.22
const BOUNCE_FACTOR = 0.1;    // fraction of speed that becomes bounce velocity
const BOUNCE_RANDOM = 0.8;    // random bounce impulse
const BOUNCE_DAMPING = 0.3;   // energy kept on each bounce (0-1)

// Slope gravity: acceleration along the slope projected onto Z axis
const SLOPE_ACCEL_Z = GRAVITY * Math.sin(SLOPE_ANGLE_RAD) * Math.cos(SLOPE_ANGLE_RAD); // ~3.15

// Slope start position (top of the slope)
const SLOPE_START_Y = 45;
const SLOPE_START_Z = 122;

// X spawn range
const SPAWN_X_MIN = -8;
const SPAWN_X_MAX = 14;

// Random offsets for natural feel
const SPAWN_Z_MAX = 137;       // max Z for spawn
const SPAWN_Z_RANGE = SPAWN_Z_MAX - SLOPE_START_Z; // ~15.71
const INITIAL_SPAWN_DELAY = 1500; // ms between each stone at start
const MIN_STONE_DISTANCE = 16;   // minimum distance between stones at spawn
const COLLISION_RADIUS = STONE_RADIUS * 2.2; // push apart if closer

export class KingRoom extends Room<KingRoomState> {
    maxClients = 20;
    state = new KingRoomState();

    onCreate(options: any) {
        this.setupMessageHandlers();
        this.initializeStones();
        registerChat(this);
    }

    onJoin(client: Client, options: PlayerJoinOptions) {
        storeClientPlatformIdentity(client, options);

        const player = new PlayerState();
        player.appearance = options.appearance;
        player.name = sanitizeRichText(normalizePlayerName(options.player_name));

        this.state.players.set(client.sessionId, player);
        console.log(client.sessionId, "joined KingRoom!");
    }

    onLeave(client: Client) {
        clearClientPlatformIdentity(client);
        this.state.players.delete(client.sessionId);
        console.log(client.sessionId, "left KingRoom!");
    }

    onDispose() {
        console.log("KingRoom", this.roomId, "disposing...");
    }

    // Track which stones are waiting to respawn
    private respawning = new Set<number>();

    private randomSpawnX(): number {
        return SPAWN_X_MIN + Math.random() * (SPAWN_X_MAX - SPAWN_X_MIN);
    }

    // Calculate Y on the slope surface for a given Z offset from SLOPE_START_Z
    private slopeYAtZ(z: number): number {
        const dz = SLOPE_START_Z - z; // how far down the slope
        return SLOPE_START_Y - dz * Math.tan(SLOPE_ANGLE_RAD);
    }

    // Find a spawn position (X, Z) far enough from all active stones
    private findSpacedSpawn(): { x: number; z: number } {
        for (let attempt = 0; attempt < 30; attempt++) {
            const cx = this.randomSpawnX();
            const cz = SLOPE_START_Z + Math.random() * SPAWN_Z_RANGE;
            let tooClose = false;
            for (let i = 0; i < this.state.stones.length; i++) {
                if (this.respawning.has(i)) continue;
                const other = this.state.stones[i];
                const dx = other.x - cx;
                const dz = other.z - cz;
                if (Math.sqrt(dx * dx + dz * dz) < MIN_STONE_DISTANCE) {
                    tooClose = true;
                    break;
                }
            }
            if (!tooClose) return { x: cx, z: cz };
        }
        return { x: this.randomSpawnX(), z: SLOPE_START_Z + Math.random() * SPAWN_Z_RANGE };
    }

    // Give a stone realistic initial rolling velocity
    private applyInitialVelocity(stone: StoneState) {
        const speed = INITIAL_SPEED_MIN + Math.random() * (INITIAL_SPEED_MAX - INITIAL_SPEED_MIN);
        stone.vz = -speed;  // rolling down slope in -Z
        stone.vx = (Math.random() - 0.5) * 1.5;
    }

    private initializeStones() {
        // Create all stones but mark them as respawning initially
        for (let i = 0; i < STONE_COUNT; i++) {
            const stone = new StoneState();
            stone.radius = STONE_RADIUS;
            // Park off-screen until their staggered spawn
            stone.x = 0;
            stone.y = 999;
            stone.z = 999;
            this.state.stones.push(stone);
            this.respawning.add(i);

            // Stagger each stone's first appearance
            this.clock.setTimeout(() => {
                this.respawnStone(i);
            }, i * INITIAL_SPAWN_DELAY);
        }

        // Physics tick at 30 Hz
        this.clock.setInterval(() => {
            this.updateStonePhysics();
        }, PHYSICS_DT * 1000);
    }

    private respawnStone(index: number) {
        const stone = this.state.stones[index];
        const spawn = this.findSpacedSpawn();
        stone.x = spawn.x;
        stone.y = this.slopeYAtZ(spawn.z);
        stone.z = spawn.z;
        this.applyInitialVelocity(stone);
        stone.rotX = 0;
        stone.rotY = 0;
        stone.rotZ = 0;
        this.respawning.delete(index);
    }

    private scheduleRespawn(index: number) {
        if (this.respawning.has(index)) return;
        this.respawning.add(index);
        // Instant respawn at top — no delay
        this.respawnStone(index);
    }

    private updateStonePhysics() {
        const stones = this.state.stones;

        for (let idx = 0; idx < stones.length; idx++) {
            const stone = stones[idx];
            if (this.respawning.has(idx)) continue;

            // Accelerate down the slope (only Z, Y is derived)
            stone.vz -= SLOPE_ACCEL_Z * PHYSICS_DT;

            // Subtle random lateral drift
            stone.vx += (Math.random() - 0.5) * X_DRIFT_STRENGTH * PHYSICS_DT;
            stone.vx *= 0.96; // damp lateral velocity

            // Update position
            stone.x += stone.vx * PHYSICS_DT;
            stone.z += stone.vz * PHYSICS_DT;

            // Bounce physics: gravity pulls stone toward slope, bounces on contact
            stone.vy -= NORMAL_GRAVITY * PHYSICS_DT;
            stone.y += stone.vy * PHYSICS_DT;

            const slopeY = this.slopeYAtZ(stone.z);
            if (stone.y <= slopeY) {
                stone.y = slopeY;
                // Bounce up: speed-dependent + random
                const downhillSpeed = Math.abs(stone.vz);
                stone.vy = downhillSpeed * BOUNCE_FACTOR + Math.random() * BOUNCE_RANDOM;
                // If previous bounce was tiny, sometimes skip (variety)
                if (Math.random() < 0.3) stone.vy *= 0.2;
            }

            // Clamp X to boundaries
            if (stone.x < SPAWN_X_MIN + STONE_RADIUS) {
                stone.x = SPAWN_X_MIN + STONE_RADIUS;
                stone.vx = Math.abs(stone.vx) * 0.3; // bounce inward
            } else if (stone.x > SPAWN_X_MAX - STONE_RADIUS) {
                stone.x = SPAWN_X_MAX - STONE_RADIUS;
                stone.vx = -Math.abs(stone.vx) * 0.3;
            }

            // Push apart from other stones to prevent overlapping
            for (let j = idx + 1; j < stones.length; j++) {
                if (this.respawning.has(j)) continue;
                const other = stones[j];
                const dx = other.x - stone.x;
                const dz = other.z - stone.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist < COLLISION_RADIUS && dist > 0.01) {
                    const overlap = COLLISION_RADIUS - dist;
                    const nx = dx / dist;
                    const nz = dz / dist;
                    // Strong push to separate
                    const push = overlap * 0.6;
                    stone.x -= nx * push;
                    other.x += nx * push;
                    // Only push Z on the faster stone to avoid stopping
                    if (Math.abs(stone.vz) > Math.abs(other.vz)) {
                        other.z += nz * push * 0.3;
                    } else {
                        stone.z -= nz * push * 0.3;
                    }
                    // Lateral velocity exchange
                    stone.vx -= nx * 1.0;
                    other.vx += nx * 1.0;
                }
            }

            // Rolling rotation based on velocity
            const speed = Math.sqrt(stone.vx * stone.vx + stone.vz * stone.vz);
            if (stone.radius > 0 && speed > 0.01) {
                // Angular velocity = linear speed / radius
                const angularSpeed = (speed / stone.radius) * SPIN_MULTIPLIER;
                // Rotate around X axis (rolling forward along Z)
                stone.rotX += angularSpeed * PHYSICS_DT * Math.sign(stone.vz);
                // Rotate around Z axis (rolling sideways along X)
                stone.rotZ -= angularSpeed * PHYSICS_DT * Math.sign(stone.vx);
            }

            // Reset stone to top when it reaches z = 17 or falls too far
            if ((stone.z <= 17 || stone.y < -10) && !this.respawning.has(idx)) {
                this.scheduleRespawn(idx);
            }
        }
    }

    private setupMessageHandlers() {
        this.onMessage("pos", (client, message) => {
            const player = this.state.players.get(client.sessionId);
            if (!player) return;

            player.x = message.x;
            player.y = message.y;
            player.z = message.z;
        });

        this.onMessage("rotate", (client, yaw: number) => {
            const player = this.state.players.get(client.sessionId);
            if (!player) return;

            player.rotY = yaw;
        });
    }
}
