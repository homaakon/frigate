import useDraggableHandler from "@/hooks/use-handle-dragging";
import {
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  RefObject,
} from "react";
import MotionSegment from "./MotionSegment";
import { useEventUtils } from "@/hooks/use-event-utils";
import { MotionData, ReviewSegment, ReviewSeverity } from "@/types/review";
import ReviewTimeline from "./ReviewTimeline";

export type MotionReviewTimelineProps = {
  segmentDuration: number;
  timestampSpread: number;
  timelineStart: number;
  timelineEnd: number;
  showHandlebar?: boolean;
  handlebarTime?: number;
  setHandlebarTime?: React.Dispatch<React.SetStateAction<number>>;
  showMinimap?: boolean;
  minimapStartTime?: number;
  minimapEndTime?: number;
  events: ReviewSegment[];
  motion_events: MotionData[];
  severityType: ReviewSeverity;
  contentRef: RefObject<HTMLDivElement>;
  onHandlebarDraggingChange?: (isDragging: boolean) => void;
};

export function MotionReviewTimeline({
  segmentDuration,
  timestampSpread,
  timelineStart,
  timelineEnd,
  showHandlebar = false,
  handlebarTime,
  setHandlebarTime,
  showMinimap = false,
  minimapStartTime,
  minimapEndTime,
  events,
  motion_events,
  contentRef,
  onHandlebarDraggingChange,
}: MotionReviewTimelineProps) {
  const [isDragging, setIsDragging] = useState(false);
  const scrollTimeRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const handlebarTimeRef = useRef<HTMLDivElement>(null);
  const timelineDuration = useMemo(
    () => timelineStart - timelineEnd,
    [timelineEnd, timelineStart],
  );

  const { alignStartDateToTimeline, alignEndDateToTimeline } = useEventUtils(
    events,
    segmentDuration,
  );

  const { handleMouseDown, handleMouseUp, handleMouseMove } =
    useDraggableHandler({
      contentRef,
      timelineRef,
      scrollTimeRef,
      alignStartDateToTimeline,
      alignEndDateToTimeline,
      segmentDuration,
      showHandlebar,
      handlebarTime,
      setHandlebarTime,
      timelineDuration,
      timelineStart,
      isDragging,
      setIsDragging,
      handlebarTimeRef,
    });

  // Generate segments for the timeline
  const generateSegments = useCallback(() => {
    const segmentCount = timelineDuration / segmentDuration;
    const segmentAlignedTime = alignStartDateToTimeline(timelineStart);

    return Array.from({ length: segmentCount }, (_, index) => {
      const segmentTime = segmentAlignedTime - index * segmentDuration;

      return (
        <MotionSegment
          key={segmentTime}
          events={events}
          motion_events={motion_events}
          segmentDuration={segmentDuration}
          segmentTime={segmentTime}
          timestampSpread={timestampSpread}
          showMinimap={showMinimap}
          minimapStartTime={minimapStartTime}
          minimapEndTime={minimapEndTime}
          setHandlebarTime={setHandlebarTime}
        />
      );
    });
    // we know that these deps are correct
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    segmentDuration,
    timestampSpread,
    timelineStart,
    timelineDuration,
    showMinimap,
    minimapStartTime,
    minimapEndTime,
    events,
    motion_events,
  ]);

  const segments = useMemo(
    () => generateSegments(),
    // we know that these deps are correct
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      segmentDuration,
      timestampSpread,
      timelineStart,
      timelineDuration,
      showMinimap,
      minimapStartTime,
      minimapEndTime,
      events,
      motion_events,
    ],
  );

  useEffect(() => {
    if (onHandlebarDraggingChange) {
      onHandlebarDraggingChange(isDragging);
    }
  }, [isDragging, onHandlebarDraggingChange]);

  return (
    <ReviewTimeline
      timelineRef={timelineRef}
      scrollTimeRef={scrollTimeRef}
      handlebarTimeRef={handlebarTimeRef}
      handleMouseMove={handleMouseMove}
      handleMouseUp={handleMouseUp}
      handleMouseDown={handleMouseDown}
      segmentDuration={segmentDuration}
      showHandlebar={showHandlebar}
      isDragging={isDragging}
    >
      {segments}
    </ReviewTimeline>
  );
}

export default MotionReviewTimeline;
