// In-game clock with minutes -> hours -> days, time-scale(pause, normal, 2x)

export type PhaseName = string;

export interface PhaseDef {
    name: PhaseName; // 'preopen' || 'open' || 'close'
    start: string; // "HH:MM", 24H
    end: string; // "HH:MM", 24H
}

export interface GameClockOptions {
    startDay?: number;
    startHour?: number;
    startMinute?: number;
    minutesPerTick?: number; // in-game minutes advanced per sim tick
    phaseDefs: PhaseDef[]; // [{ name:'preopen', start:'06:00', end:'08:00' }, ...]
}

export type ClockEvent =
    | { type: "tick"; phase: PhaseName; time: string; day: number }
    | { type: "phase"; phase: PhaseName; time: string; day: number };

export type ClockListener = (e: ClockEvent) => void;

function timeToMinutes(time: string): number {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
}

export class GameClock {
    day: number;
    hour: number;
    minute: number;
    minutesPerTick: number;
    phaseDefs: PhaseDef[];
    phase: PhaseName;
    private listeners: Set<ClockListener>;
    timeScale: number;

    constructor({
        startDay = 1,
        startHour = 7,
        startMinute = 0,
        minutesPerTick = 1,
        phaseDefs,
    }: GameClockOptions) {
        this.day = startDay;
        this.hour = startHour;
        this.minute = startMinute;
        this.minutesPerTick = minutesPerTick;
        this.phaseDefs = phaseDefs;
        this.phase = this.calcPhase();
        this.listeners = new Set();
        this.timeScale = 1; // 0 = paused, 1 = normal, 2 = double
    }

    get timeStr(): string {
        return `${String(this.hour).padStart(2, "0")}:${String(this.minute).padStart(2, "0")}`;
    }

    get dayStr(): string {
        return `Day ${this.day}`;
    }

    // Register a listener for GameClock Events and returns an unsubscribe function
    on(listener: ClockListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    // Clock tick for ingame clock. Each call advances time, updates current day phase, and notifies subscribers
    tick(): void {
        if (this.timeScale === 0) return;

        const minutesToAdd = this.minutesPerTick * this.timeScale;

        const prevPhase = this.phase;

        this.addMinutes(minutesToAdd);

        this.phase = this.calcPhase()

        if (this.phase !== prevPhase) {
            this.emit({
                type: "phase",
                phase: this.phase,
                time: this.timeStr,
                day: this.day,
            });
        }
        this.emit({
            type: "tick",
            phase: this.phase,
            time: this.timeStr,
            day: this.day,
        });
    }

    setTimeScale(scale: number): void {
        this.timeScale = Math.max(0, scale | 0);
    }

    // add minutes to minute. roll over min / day
    private addMinutes(min: number): void {
        this.minute += min;
        while (this.minute >= 60) {
            this.minute -= 60;
            this.hour += 1;
        }
        while (this.hour >= 24) {
            this.hour -= 24;
            this.day += 1;
        }
    }

    // Return current phase based on time using numeric comparison
    private calcPhase(): PhaseName {
        const now = this.hour * 60 + this.minute;
        for (const p of this.phaseDefs) {
            const start = timeToMinutes(p.start);
            const end = timeToMinutes(p.end);
            if (start <= end) {
                if (now >= start && now < end) return p.name;
            } else {
                // wraps midnight
                if (now >= start || now < end) return p.name;
            }
        }
        return "unknown";
    }

    private emit(payload: ClockEvent): void {
        for (const fn of this.listeners) fn(payload);
    }
}
