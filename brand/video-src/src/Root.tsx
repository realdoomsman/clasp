import React from "react";
import { Composition, Still } from "remotion";
import { Video } from "./Video";
import { TL, VideoId } from "./timeline";
import { LAUNCH_LABELS, LAUNCH_SCENES } from "./scenes/Launch";
import { CLIP_LABELS, CLIP_SCENES } from "./scenes/Clips";
import { LaunchPoster } from "./Posters";

// Scene maps hold components, which can't travel through serialized props; bind them per composition.
// `captions` comes from inputProps so posters can reuse a clip frame without the caption box.
const bind = (id: VideoId): React.FC<{ captions?: boolean }> => {
  const launch = id === "launch";
  const C: React.FC<{ captions?: boolean }> = ({ captions = true }) => (
    <Video id={id} scenes={launch ? LAUNCH_SCENES : CLIP_SCENES} labels={launch ? LAUNCH_LABELS : CLIP_LABELS} captions={captions} />
  );
  C.displayName = `Video(${id})`;
  return C;
};

const IDS: VideoId[] = ["launch", "clip-money-flow", "clip-lock-weight", "clip-early-exit", "clip-walkthrough"];

export const RemotionRoot: React.FC = () => (
  <>
    {IDS.map((id) => (
      <Composition key={id} id={id} component={bind(id)} durationInFrames={TL[id].durationInFrames} fps={30} width={1920} height={1080} />
    ))}
    <Still id="launch-poster" component={LaunchPoster} width={1920} height={1080} />
  </>
);
