import { GameClock, type PhaseDef } from "./time";

const phases: PhaseDef[] = [
    { name: "preopen", start: "06:00", end: "08:00" },
    { name: "open", start: "08:00", end: "21:00" },
    { name: "closed", start: "21:00", end: "24:00" },
    { name: "closed", start: "00:00", end: "06:00" },
];

const clock = new GameClock({
    startDay: 1,
    startHour: 20,
    startMinute: 50,
    minutesPerTick: 5,
    phaseDefs: phases,
});

const events: string[] = [];

clock.on((e) => {
    if (e.type === "phase") events.push(`[${e.time}] PHASE -> ${e.phase}`);
    if (e.type === "tick") events.push(`[${e.time}] TICK  (${e.phase})`);
});

for (let i = 0; i < 5; i++) clock.tick();

console.log(events.join("\n"));
