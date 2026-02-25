import fs from "fs";
import path from "path";

type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

const logsDir = path.resolve(__dirname, "..", "logs");

let currentDate = "";
let currentStream: fs.WriteStream | null = null;

function getDatePart(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function ensureStream(date: Date): fs.WriteStream {
    const datePart = getDatePart(date);

    if (currentStream && currentDate === datePart) {
        return currentStream;
    }

    fs.mkdirSync(logsDir, { recursive: true });

    if (currentStream) {
        currentStream.end();
    }

    currentDate = datePart;
    const filePath = path.join(logsDir, `server-${datePart}.log`);
    currentStream = fs.createWriteStream(filePath, { flags: "a" });

    return currentStream;
}

export function serializeUnknownError(value: unknown): Record<string, unknown> {
    if (value instanceof Error) {
        return {
            name: value.name,
            message: value.message,
            stack: value.stack,
        };
    }

    return { value };
}

function stringifyMeta(meta?: Record<string, unknown>): string {
    if (!meta || Object.keys(meta).length === 0) {
        return "";
    }

    try {
        return ` ${JSON.stringify(meta)}`;
    } catch {
        return " {\"meta\":\"[unserializable]\"}";
    }
}

function write(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    const now = new Date();
    const line = `${now.toISOString()} [${level}] ${message}${stringifyMeta(meta)}\n`;

    const stream = ensureStream(now);
    stream.write(line);

    if (level === "ERROR") {
        console.error(line.trimEnd());
        return;
    }

    if (level === "WARN") {
        console.warn(line.trimEnd());
        return;
    }

    console.log(line.trimEnd());
}

export const logger = {
    info(message: string, meta?: Record<string, unknown>) {
        write("INFO", message, meta);
    },
    warn(message: string, meta?: Record<string, unknown>) {
        write("WARN", message, meta);
    },
    error(message: string, meta?: Record<string, unknown>) {
        write("ERROR", message, meta);
    },
    debug(message: string, meta?: Record<string, unknown>) {
        write("DEBUG", message, meta);
    },
};
