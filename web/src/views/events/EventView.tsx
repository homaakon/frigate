import Logo from "@/components/Logo";
import NewReviewData from "@/components/dynamic/NewReviewData";
import ReviewActionGroup from "@/components/filter/ReviewActionGroup";
import ReviewFilterGroup from "@/components/filter/ReviewFilterGroup";
import DynamicVideoPlayer, {
  DynamicVideoController,
} from "@/components/player/DynamicVideoPlayer";
import PreviewThumbnailPlayer from "@/components/player/PreviewThumbnailPlayer";
import EventReviewTimeline from "@/components/timeline/EventReviewTimeline";
import ActivityIndicator from "@/components/indicators/activity-indicator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useEventUtils } from "@/hooks/use-event-utils";
import { useScrollLockout } from "@/hooks/use-mouse-listener";
import { FrigateConfig } from "@/types/frigateConfig";
import { Preview } from "@/types/preview";
import {
  MotionData,
  ReviewFilter,
  ReviewSegment,
  ReviewSeverity,
  ReviewSummary,
} from "@/types/review";
import { getChunkedTimeRange } from "@/utils/timelineUtil";
import axios from "axios";
import {
  MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { isDesktop, isMobile } from "react-device-detect";
import { LuFolderCheck } from "react-icons/lu";
import { MdCircle } from "react-icons/md";
import useSWR from "swr";
import MotionReviewTimeline from "@/components/timeline/MotionReviewTimeline";
import { Button } from "@/components/ui/button";

type EventViewProps = {
  reviews?: ReviewSegment[];
  reviewSummary?: ReviewSummary;
  relevantPreviews?: Preview[];
  timeRange: { before: number; after: number };
  filter?: ReviewFilter;
  severity: ReviewSeverity;
  setSeverity: (severity: ReviewSeverity) => void;
  markItemAsReviewed: (review: ReviewSegment) => void;
  onOpenReview: (reviewId: string) => void;
  pullLatestData: () => void;
  updateFilter: (filter: ReviewFilter) => void;
};
export default function EventView({
  reviews,
  reviewSummary,
  relevantPreviews,
  timeRange,
  filter,
  severity,
  setSeverity,
  markItemAsReviewed,
  onOpenReview,
  pullLatestData,
  updateFilter,
}: EventViewProps) {
  const { data: config } = useSWR<FrigateConfig>("config");
  const contentRef = useRef<HTMLDivElement | null>(null);

  // review counts

  const reviewCounts = useMemo(() => {
    if (!reviewSummary) {
      return { alert: 0, detection: 0, significant_motion: 0 };
    }

    let summary;
    if (filter?.before == undefined) {
      summary = reviewSummary["last24Hours"];
    } else {
      const day = new Date(filter.before * 1000);
      const key = `${day.getFullYear()}-${("0" + (day.getMonth() + 1)).slice(-2)}-${("0" + day.getDate()).slice(-2)}`;
      summary = reviewSummary[key];
    }

    if (!summary) {
      return { alert: 0, detection: 0, significant_motion: 0 };
    }

    if (filter?.showReviewed == 1) {
      return {
        alert: summary.total_alert,
        detection: summary.total_detection,
        significant_motion: summary.total_motion,
      };
    } else {
      return {
        alert: summary.total_alert - summary.reviewed_alert,
        detection: summary.total_detection - summary.reviewed_detection,
        significant_motion: summary.total_motion - summary.reviewed_motion,
      };
    }
  }, [filter, reviewSummary]);

  // review paging

  const reviewItems = useMemo(() => {
    const all: ReviewSegment[] = [];
    const alerts: ReviewSegment[] = [];
    const detections: ReviewSegment[] = [];
    const motion: ReviewSegment[] = [];

    reviews?.forEach((segment) => {
      all.push(segment);

      switch (segment.severity) {
        case "alert":
          alerts.push(segment);
          break;
        case "detection":
          detections.push(segment);
          break;
        default:
          motion.push(segment);
          break;
      }
    });

    return {
      all: all,
      alert: alerts,
      detection: detections,
      significant_motion: motion,
    };
  }, [reviews]);

  // review interaction

  const [selectedReviews, setSelectedReviews] = useState<string[]>([]);
  const onSelectReview = useCallback(
    (reviewId: string, ctrl: boolean) => {
      if (selectedReviews.length > 0 || ctrl) {
        const index = selectedReviews.indexOf(reviewId);

        if (index != -1) {
          if (selectedReviews.length == 1) {
            setSelectedReviews([]);
          } else {
            const copy = [
              ...selectedReviews.slice(0, index),
              ...selectedReviews.slice(index + 1),
            ];
            setSelectedReviews(copy);
          }
        } else {
          const copy = [...selectedReviews];
          copy.push(reviewId);
          setSelectedReviews(copy);
        }
      } else {
        onOpenReview(reviewId);
      }
    },
    [selectedReviews, setSelectedReviews, onOpenReview],
  );

  const exportReview = useCallback(
    (id: string) => {
      const review = reviewItems.all?.find((seg) => seg.id == id);

      if (!review) {
        return;
      }

      axios.post(
        `export/${review.camera}/start/${review.start_time}/end/${review.end_time}`,
        { playback: "realtime" },
      );
    },
    [reviewItems],
  );

  if (!config) {
    return <ActivityIndicator />;
  }

  return (
    <div className="flex flex-col size-full">
      <div className="h-10 relative flex justify-between items-center m-2">
        {isMobile && (
          <Logo className="absolute inset-y-0 inset-x-1/2 -translate-x-1/2 h-8" />
        )}
        <ToggleGroup
          className="*:px-3 *:py-4 *:rounded-2xl"
          type="single"
          size="sm"
          value={severity}
          onValueChange={(value: ReviewSeverity) =>
            value ? setSeverity(value) : null
          } // don't allow the severity to be unselected
        >
          <ToggleGroupItem
            className={`${severity == "alert" ? "" : "text-gray-500"}`}
            value="alert"
            aria-label="Select alerts"
          >
            <MdCircle className="size-2 md:mr-[10px] text-severity_alert" />
            <div className="hidden md:block">Alerts ∙ {reviewCounts.alert}</div>
          </ToggleGroupItem>
          <ToggleGroupItem
            className={`${severity == "detection" ? "" : "text-gray-500"}`}
            value="detection"
            aria-label="Select detections"
          >
            <MdCircle className="size-2 md:mr-[10px] text-severity_detection" />
            <div className="hidden md:block">
              Detections ∙ {reviewCounts.detection}
            </div>
          </ToggleGroupItem>
          <ToggleGroupItem
            className={`px-3 py-4 rounded-2xl ${
              severity == "significant_motion" ? "" : "text-gray-500"
            }`}
            value="significant_motion"
            aria-label="Select motion"
          >
            <MdCircle className="size-2 md:mr-[10px] text-severity_motion" />
            <div className="hidden md:block">Motion</div>
          </ToggleGroupItem>
        </ToggleGroup>

        {selectedReviews.length <= 0 ? (
          <ReviewFilterGroup filter={filter} onUpdateFilter={updateFilter} />
        ) : (
          <ReviewActionGroup
            selectedReviews={selectedReviews}
            setSelectedReviews={setSelectedReviews}
            onExport={exportReview}
            pullLatestData={pullLatestData}
          />
        )}
      </div>

      <div className="flex h-full overflow-hidden">
        {severity != "significant_motion" && (
          <DetectionReview
            contentRef={contentRef}
            reviewItems={reviewItems}
            relevantPreviews={relevantPreviews}
            selectedReviews={selectedReviews}
            itemsToReview={reviewCounts[severity]}
            severity={severity}
            filter={filter}
            timeRange={timeRange}
            markItemAsReviewed={markItemAsReviewed}
            onSelectReview={onSelectReview}
            pullLatestData={pullLatestData}
          />
        )}
        {severity == "significant_motion" && (
          <MotionReview
            contentRef={contentRef}
            reviewItems={reviewItems}
            relevantPreviews={relevantPreviews}
            timeRange={timeRange}
            filter={filter}
            onSelectReview={onSelectReview}
          />
        )}
      </div>
    </div>
  );
}

type DetectionReviewProps = {
  contentRef: MutableRefObject<HTMLDivElement | null>;
  reviewItems: {
    all: ReviewSegment[];
    alert: ReviewSegment[];
    detection: ReviewSegment[];
    significant_motion: ReviewSegment[];
  };
  itemsToReview?: number;
  relevantPreviews?: Preview[];
  selectedReviews: string[];
  severity: ReviewSeverity;
  filter?: ReviewFilter;
  timeRange: { before: number; after: number };
  markItemAsReviewed: (review: ReviewSegment) => void;
  onSelectReview: (id: string, ctrl: boolean) => void;
  pullLatestData: () => void;
};
function DetectionReview({
  contentRef,
  reviewItems,
  itemsToReview,
  relevantPreviews,
  selectedReviews,
  severity,
  filter,
  timeRange,
  markItemAsReviewed,
  onSelectReview,
  pullLatestData,
}: DetectionReviewProps) {
  const segmentDuration = 60;

  // review data
  const currentItems = useMemo(() => {
    const current = reviewItems[severity];

    if (!current || current.length == 0) {
      return null;
    }

    if (filter?.showReviewed != 1) {
      return current.filter((seg) => !seg.has_been_reviewed);
    } else {
      return current;
    }
    // only refresh when severity or filter changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [severity, filter, reviewItems.all.length]);

  // preview

  const [previewTime, setPreviewTime] = useState<number>();

  // review interaction

  const [hasUpdate, setHasUpdate] = useState(false);

  const markAllReviewed = useCallback(async () => {
    if (!currentItems) {
      return;
    }

    await axios.post(`reviews/viewed`, {
      ids: currentItems?.map((seg) => seg.id),
    });
    setHasUpdate(false);
    pullLatestData();
  }, [currentItems, pullLatestData]);

  // timeline interaction

  const { alignStartDateToTimeline } = useEventUtils(
    reviewItems.all,
    segmentDuration,
  );

  const scrollLock = useScrollLockout(contentRef);

  const [minimap, setMinimap] = useState<string[]>([]);
  const minimapObserver = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    const visibleTimestamps = new Set<string>();
    minimapObserver.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const start = (entry.target as HTMLElement).dataset.start;

          if (!start) {
            return;
          }

          if (entry.isIntersecting) {
            visibleTimestamps.add(start);
          } else {
            visibleTimestamps.delete(start);
          }

          setMinimap([...visibleTimestamps]);
        });
      },
      { root: contentRef.current, threshold: isDesktop ? 0.1 : 0.5 },
    );

    return () => {
      minimapObserver.current?.disconnect();
    };
  }, [contentRef, minimapObserver]);

  const minimapBounds = useMemo(() => {
    const data = {
      start: 0,
      end: 0,
    };
    const list = minimap.sort();

    if (list.length > 0) {
      data.end = parseFloat(list.at(-1) || "0");
      data.start = parseFloat(list[0]);
    }

    return data;
  }, [minimap]);

  const minimapRef = useCallback(
    (node: HTMLElement | null) => {
      if (!minimapObserver.current) {
        return;
      }

      try {
        if (node) minimapObserver.current.observe(node);
      } catch (e) {
        // no op
      }
    },
    [minimapObserver],
  );

  const showMinimap = useMemo(() => {
    if (!contentRef.current) {
      return false;
    }

    return contentRef.current.scrollHeight > contentRef.current.clientHeight;
    // we know that these deps are correct
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentRef.current?.scrollHeight, severity]);

  return (
    <>
      <div
        ref={contentRef}
        className="flex flex-1 flex-wrap content-start gap-2 md:gap-4 overflow-y-auto no-scrollbar"
      >
        {filter?.before == undefined && (
          <NewReviewData
            className="absolute w-full z-30"
            contentRef={contentRef}
            severity={severity}
            hasUpdate={hasUpdate}
            setHasUpdate={setHasUpdate}
            pullLatestData={pullLatestData}
          />
        )}

        {itemsToReview == 0 && (
          <div className="size-full flex flex-col justify-center items-center">
            <LuFolderCheck className="size-16" />
            There are no {severity.replace(/_/g, " ")} items to review
          </div>
        )}

        <div
          className="w-full m-2 grid sm:grid-cols-2 md:grid-cols-3 3xl:grid-cols-4 gap-2 md:gap-4"
          ref={contentRef}
        >
          {currentItems &&
            currentItems.map((value) => {
              const selected = selectedReviews.includes(value.id);

              return (
                <div
                  key={value.id}
                  ref={minimapRef}
                  data-start={value.start_time}
                  data-segment-start={
                    alignStartDateToTimeline(value.start_time) - segmentDuration
                  }
                  className={`outline outline-offset-1 rounded-lg shadow-none transition-all my-1 md:my-0 ${selected ? `outline-4 shadow-[0_0_6px_1px] outline-severity_${value.severity} shadow-severity_${value.severity}` : "outline-0 duration-500"}`}
                >
                  <div className="aspect-video rounded-lg overflow-hidden">
                    <PreviewThumbnailPlayer
                      review={value}
                      allPreviews={relevantPreviews}
                      setReviewed={markItemAsReviewed}
                      scrollLock={scrollLock}
                      onTimeUpdate={setPreviewTime}
                      onClick={onSelectReview}
                    />
                  </div>
                </div>
              );
            })}
          {(itemsToReview ?? 0) > 0 && (
            <div className="col-span-full flex justify-center items-center">
              <Button
                className="text-white"
                variant="select"
                onClick={markAllReviewed}
              >
                Mark these items as reviewed
              </Button>
            </div>
          )}
        </div>
      </div>
      <div className="w-[55px] md:w-[100px] mt-2 overflow-y-auto no-scrollbar">
        <EventReviewTimeline
          segmentDuration={segmentDuration}
          timestampSpread={15}
          timelineStart={timeRange.before}
          timelineEnd={timeRange.after}
          showMinimap={showMinimap && !previewTime}
          minimapStartTime={minimapBounds.start}
          minimapEndTime={minimapBounds.end}
          showHandlebar={previewTime != undefined}
          handlebarTime={previewTime}
          events={reviewItems.all}
          severityType={severity}
          contentRef={contentRef}
        />
      </div>
    </>
  );
}

type MotionReviewProps = {
  contentRef: MutableRefObject<HTMLDivElement | null>;
  reviewItems: {
    all: ReviewSegment[];
    alert: ReviewSegment[];
    detection: ReviewSegment[];
    significant_motion: ReviewSegment[];
  };
  relevantPreviews?: Preview[];
  timeRange: { before: number; after: number };
  filter?: ReviewFilter;
  onSelectReview: (data: string, ctrl: boolean) => void;
};
function MotionReview({
  contentRef,
  reviewItems,
  relevantPreviews,
  timeRange,
  filter,
  onSelectReview,
}: MotionReviewProps) {
  const segmentDuration = 30;
  const { data: config } = useSWR<FrigateConfig>("config");
  const [playerReady, setPlayerReady] = useState(false);

  const reviewCameras = useMemo(() => {
    if (!config) {
      return [];
    }

    let cameras;
    if (!filter || !filter.cameras) {
      cameras = Object.values(config.cameras);
    } else {
      const filteredCams = filter.cameras;

      cameras = Object.values(config.cameras).filter((cam) =>
        filteredCams.includes(cam.name),
      );
    }

    return cameras.sort((a, b) => a.ui.order - b.ui.order);
  }, [config, filter]);

  const videoPlayersRef = useRef<{ [camera: string]: DynamicVideoController }>(
    {},
  );

  // motion data

  const { data: motionData } = useSWR<MotionData[]>([
    "review/activity",
    {
      before: timeRange.before,
      after: timeRange.after,
      scale: segmentDuration / 2,
      cameras: filter?.cameras?.join(",") ?? null,
    },
  ]);

  // timeline time

  const lastFullHour = useMemo(() => {
    const end = new Date(timeRange.before * 1000);
    end.setMinutes(0, 0, 0);
    return end.getTime() / 1000;
  }, [timeRange]);
  const timeRangeSegments = useMemo(
    () => getChunkedTimeRange(timeRange.after, lastFullHour),
    [lastFullHour, timeRange],
  );

  const [selectedRangeIdx, setSelectedRangeIdx] = useState(
    timeRangeSegments.ranges.length - 1,
  );
  const [currentTime, setCurrentTime] = useState<number>(
    timeRangeSegments.ranges[selectedRangeIdx].start,
  );
  const currentTimeRange = useMemo(
    () => timeRangeSegments.ranges[selectedRangeIdx],
    [selectedRangeIdx, timeRangeSegments],
  );

  // move to next clip

  useEffect(() => {
    if (
      !videoPlayersRef.current &&
      Object.values(videoPlayersRef.current).length > 0
    ) {
      return;
    }

    const firstController = Object.values(videoPlayersRef.current)[0];

    if (firstController) {
      firstController.onClipChangedEvent((dir) => {
        if (dir == "forward") {
          if (selectedRangeIdx < timeRangeSegments.ranges.length - 1) {
            setSelectedRangeIdx(selectedRangeIdx + 1);
          }
        }
      });
    }
  }, [selectedRangeIdx, timeRangeSegments, videoPlayersRef, playerReady]);

  useEffect(() => {
    if (
      currentTime > currentTimeRange.end + 60 ||
      currentTime < currentTimeRange.start - 60
    ) {
      const index = timeRangeSegments.ranges.findIndex(
        (seg) => seg.start <= currentTime && seg.end >= currentTime,
      );

      if (index != -1) {
        setSelectedRangeIdx(index);
      }
      return;
    }

    Object.values(videoPlayersRef.current).forEach((controller) => {
      controller.scrubToTimestamp(currentTime);
    });
  }, [currentTime, currentTimeRange, timeRangeSegments]);

  if (!relevantPreviews) {
    return <ActivityIndicator />;
  }

  return (
    <>
      <div className="flex flex-1 flex-wrap content-start gap-2 md:gap-4 overflow-y-auto no-scrollbar">
        <div
          ref={contentRef}
          className="w-full m-2 grid sm:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4 gap-2 md:gap-4 overflow-auto no-scrollbar"
        >
          {reviewCameras.map((camera) => {
            let grow;
            const aspectRatio = camera.detect.width / camera.detect.height;
            if (aspectRatio > 2) {
              grow = "sm:col-span-2 aspect-wide";
            } else if (aspectRatio < 1) {
              grow = "md:row-span-2 md:h-full aspect-tall";
            } else {
              grow = "aspect-video";
            }
            return (
              <DynamicVideoPlayer
                key={camera.name}
                className={`${grow}`}
                camera={camera.name}
                timeRange={currentTimeRange}
                cameraPreviews={relevantPreviews || []}
                previewOnly
                preloadRecordings={false}
                onControllerReady={(controller) => {
                  videoPlayersRef.current[camera.name] = controller;
                  setPlayerReady(true);
                }}
                onClick={() =>
                  onSelectReview(`motion,${camera.name},${currentTime}`, false)
                }
              />
            );
          })}
        </div>
      </div>
      <div className="w-[55px] md:w-[100px] mt-2 overflow-y-auto no-scrollbar">
        <MotionReviewTimeline
          segmentDuration={segmentDuration}
          timestampSpread={15}
          timelineStart={timeRangeSegments.end}
          timelineEnd={timeRangeSegments.start}
          showHandlebar
          handlebarTime={currentTime}
          setHandlebarTime={setCurrentTime}
          events={reviewItems.all}
          motion_events={motionData ?? []}
          severityType="significant_motion"
          contentRef={contentRef}
        />
      </div>
    </>
  );
}
