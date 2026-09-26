import data from "./timeline.json";

export type Word = [number, number, string];
export type Line = {
  from: number;
  dur: number;
  cap: string;
  say: string;
  key: string;
  startSec: number;
  durSec: number;
  words: Word[];
};
export type Scene = {
  id: string;
  from: number;
  dur: number;
  beats: Record<string, number>;
  sfx: unknown[];
  lines: Line[];
};
export type VideoTimeline = { fps: number; durationInFrames: number; scenes: Scene[] };
export type VideoId = "launch" | "clip-money-flow" | "clip-lock-weight" | "clip-early-exit" | "clip-walkthrough";

export const TL = data as unknown as Record<VideoId, VideoTimeline>;

/** Beat frame (scene-relative); throws on typos so choreography never silently desyncs. */
export const beat = (scene: Scene, name: string): number => {
  const v = scene.beats[name];
  if (v === undefined) throw new Error(`Missing beat "${name}" in scene ${scene.id}`);
  return v;
};
