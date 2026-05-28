import { Client } from "@colyseus/core";

export interface PlayerJoinOptions {
    appearance?: string;
    player_name?: string;
    platform_code?: string;
    platform_user_id?: string;
}

export interface PlatformUserIdentity {
    platformCode: string;
    platformUserId: string;
}

const clientPlatformIdentity = new WeakMap<Client, PlatformUserIdentity>();

export function storeClientPlatformIdentity(
    client: Client,
    options: PlayerJoinOptions | undefined,
): PlatformUserIdentity {
    const identity = resolvePlatformUserIdentity(options);
    clientPlatformIdentity.set(client, identity);
    return identity;
}

export function getClientPlatformIdentity(
    client: Client,
): PlatformUserIdentity | undefined {
    return clientPlatformIdentity.get(client);
}

export function clearClientPlatformIdentity(client: Client): void {
    clientPlatformIdentity.delete(client);
}

export function hasAuthenticatedPlatformIdentity(
    identity: PlatformUserIdentity | undefined | null,
): boolean {
    return Boolean(identity?.platformUserId);
}

function resolvePlatformUserIdentity(
    options: PlayerJoinOptions | undefined,
): PlatformUserIdentity {
    return {
        platformCode: normalizeValue(options?.platform_code),
        platformUserId: normalizeValue(options?.platform_user_id),
    };
}

function normalizeValue(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}
