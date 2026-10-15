import { toggleFollow, useIsFollowed, type LocalFollow } from "../lib/local-state";
import { IconCheck, IconRss } from "./icons";
import { useText } from "./LanguageSwitch";

/** Follow a topic or graph entity on this device, and its RSS feed for a reader instead. */
export function FollowControls({ kind, id, name }: { kind: LocalFollow["kind"]; id: string; name: string }) {
  const followed = useIsFollowed(kind, id);
  const t = useText();
  return (
    <div className="lr-follow">
      <button type="button" aria-pressed={followed} onClick={() => toggleFollow({ kind, key: id, name })}
        className={`lr-follow-btn ${followed ? "is-on" : ""}`}>
        {followed ? <><IconCheck size={14} /> {t("已关注", "Following")}</> : <>+ {t("关注", "Follow")}</>}
      </button>
      <a href={`/feed/${kind}/${encodeURIComponent(id)}.xml`} className="lr-follow-rss" title={t("用阅读器订阅", "Subscribe in a feed reader")}>
        <IconRss size={14} /> RSS
      </a>
    </div>
  );
}
