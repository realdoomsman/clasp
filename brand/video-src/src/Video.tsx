import React from "react";
import { Sequence, useCurrentFrame } from "remotion";
import { Paper, Chrome } from "./components/Base";
import { Captions } from "./components/Captions";
import { ensureFonts } from "./fonts";
import { easeOut, ramp } from "./lib/anim";
import { Scene, TL, VideoId } from "./timeline";

ensureFonts();

type SceneMap = Record<string, React.FC<{ s: Scene }>>;
type LabelMap = Record<string, [string, string] | null>;

/** Lays out a video's scenes from the shared timeline, with header chrome and captions on top. */
export const Video: React.FC<{ id: VideoId; scenes: SceneMap; labels: LabelMap; captions?: boolean }> = ({ id, scenes, labels, captions = true }) => {
  const f = useCurrentFrame();
  const tl = TL[id];
  const cur = tl.scenes.find((s) => f >= s.from && f < s.from + s.dur) ?? tl.scenes[tl.scenes.length - 1];
  const lab = labels[cur.id];
  const chromeIn = lab ? ramp(f, cur.from, cur.from + 14, easeOut) : 0;
  const prevLab = tl.scenes.indexOf(cur) > 0 ? labels[tl.scenes[tl.scenes.indexOf(cur) - 1].id] : null;
  const chromeOut = lab && f > cur.from + cur.dur - 10 ? (labels[tl.scenes[tl.scenes.indexOf(cur) + 1]?.id] ? 1 : 1 - ramp(f, cur.from + cur.dur - 10, cur.from + cur.dur - 1)) : 1;
  const show = lab ? (prevLab ? 1 : chromeIn) * chromeOut : 0;
  return (
    <Paper>
      {tl.scenes.map((s) => {
        const C = scenes[s.id];
        return (
          <Sequence key={s.id} from={s.from} durationInFrames={s.dur} name={s.id}>
            <C s={s} />
          </Sequence>
        );
      })}
      {lab ? <Chrome label={lab[1]} index={lab[0]} show={show} /> : null}
      {captions ? <Captions tl={tl} /> : null}
    </Paper>
  );
};
