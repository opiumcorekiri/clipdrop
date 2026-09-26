 "use client";

import { useMemo, useRef, useState } from "react";

type Quality = {
  quality: string;
  fps: number;
  url: string;
  height: number;
};

type Clip = {
  id: string;
  title: string;
  broadcaster: string;
  creator: string;
  duration: number;
  views: number;
  createdAt: string;
  thumbnail: string;
  qualities: Quality[];
};

function formatDuration(seconds: number) {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatViews(value: number) {
  return new Intl.NumberFormat("en", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1
  }).format(value);
}

function normalizeTwitchUrl(value: string) {
  return value.trim();
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [clip, setClip] = useState<Clip | null>(null);
  const [selectedQuality, setSelectedQuality] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => clip?.qualities.find(q => q.quality === selectedQuality) ?? clip?.qualities[0],
    [clip, selectedQuality]
  );

  async function resolveClip() {
    const cleanUrl = normalizeTwitchUrl(url);

    if (!cleanUrl) return;

    setLoading(true);
    setError("");
    setClip(null);

    try {
      const response = await fetch("/api/resolve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url: cleanUrl })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not resolve this Clip.");
      }

      setClip(data);
      setSelectedQuality(data.qualities?.[0]?.quality ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function downloadSelected() {
    if (!selected?.url) return;

    // The media URL is served by Twitch's CDN, not by our Netlify function.
    // Opening it lets the CDN/browser handle the actual file transfer.
    window.location.href = selected.url;
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
        setError("");
      }
    } catch {
      inputRef.current?.focus();
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);

    const text = event.dataTransfer.getData("text/plain");
    if (text) {
      setUrl(text.trim());
      setError("");
    }
  }

  return (
    <main className="site">
      <div className="ambient ambientOne" />
      <div className="ambient ambientTwo" />

      <nav className="nav">
        <div className="brand">
          <div className="brandMark">
            <span />
            <span />
            <span />
          </div>
          <span>CLIPDROP</span>
        </div>

        <div className="navPill">
          <span className="statusDot" />
          Twitch Clip Downloader
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">
          <span className="eyebrowLine" />
          FAST • SIMPLE • DIRECT
        </div>

        <h1>
          Your clip.
          <br />
          <span>Right to your device.</span>
        </h1>

        <p className="lead">
          Paste a Twitch Clip link. We find the available video source and
          hand the download directly to your browser.
        </p>

        <div
          className={`searchCard ${dragging ? "dragging" : ""}`}
          onDragOver={e => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <div className="searchIcon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M10.8 4.2a6.6 6.6 0 1 0 4.65 11.27l3.04 3.04a1 1 0 0 0 1.42-1.42l-3.04-3.04A6.6 6.6 0 0 0 10.8 4.2Zm0 2a4.6 4.6 0 1 1 0 9.2 4.6 4.6 0 0 1 0-9.2Z"
                fill="currentColor"
              />
            </svg>
          </div>

          <input
            ref={inputRef}
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") resolveClip();
            }}
            placeholder="Paste your Twitch Clip link..."
            spellCheck={false}
          />

          <button className="pasteButton" onClick={pasteFromClipboard}>
            Paste
          </button>

          <button
            className="findButton"
            onClick={resolveClip}
            disabled={!url.trim() || loading}
          >
            {loading ? (
              <span className="buttonLoader" />
            ) : (
              <>
                Find clip
                <span className="arrow">↗</span>
              </>
            )}
          </button>
        </div>

        <div className="underSearch">
          <span>Supports</span>
          <code>twitch.tv/.../clip/...</code>
          <code>clips.twitch.tv/...</code>
          <span className="separator">•</span>
          <span>Press Enter to search</span>
        </div>

        {error && (
          <div className="errorBox">
            <div className="errorIcon">!</div>
            <div>
              <strong>Couldn&apos;t find that clip</strong>
              <p>{error}</p>
            </div>
          </div>
        )}
      </section>

      {clip && (
        <section className="resultSection">
          <div className="resultHeader">
            <div>
              <span className="sectionLabel">CLIP FOUND</span>
              <h2>{clip.title}</h2>
            </div>
            <button
              className="newSearch"
              onClick={() => {
                setClip(null);
                setUrl("");
                inputRef.current?.focus();
              }}
            >
              + New search
            </button>
          </div>

          <div className="clipCard">
            <div className="preview">
  												<video
   												 key={selected?.url}
 												   src={selected?.url}
												    poster={clip.thumbnail || undefined}
  												  controls
												    playsInline
												    preload="metadata"
												  />

  											<div className="previewOverlay">
												    <span>{formatDuration(clip.duration)}</span>
 											 </div>
											</div>

            <div className="clipInfo">
              <div className="creatorRow">
                <div className="avatar">
                  {clip.broadcaster.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <strong>{clip.broadcaster}</strong>
                  <span>by {clip.creator}</span>
                </div>
              </div>

              <div className="stats">
                <div>
                  <span>Views</span>
                  <strong>{formatViews(clip.views)}</strong>
                </div>
                <div>
                  <span>Duration</span>
                  <strong>{formatDuration(clip.duration)}</strong>
                </div>
                <div>
                  <span>Formats</span>
                  <strong>{clip.qualities.length}</strong>
                </div>
              </div>

              <div className="qualityBlock">
                <div className="qualityHeading">
                  <span>VIDEO QUALITY</span>
                  <small>Choose your preferred version</small>
                </div>

                <div className="qualityGrid">
                  {clip.qualities.map(item => (
                    <button
                      key={`${item.quality}-${item.fps}`}
                      className={`quality ${
                        selectedQuality === item.quality ? "active" : ""
                      }`}
                      onClick={() => setSelectedQuality(item.quality)}
                    >
                      <strong>{item.quality}</strong>
                      <span>{item.fps} FPS</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="downloadButton"
                onClick={downloadSelected}
                disabled={!selected}
              >
                <span className="downloadIcon">↓</span>
                Download {selected?.quality ?? ""}
                <span className="downloadArrow">↗</span>
              </button>

              <p className="downloadNote">
                The video is transferred directly from the Twitch media CDN.
                This site does not store your video.
              </p>
            </div>
          </div>
        </section>
      )}

      <footer>
        <span>CLIPDROP</span>
        <span>For content you have permission to download.</span>
      </footer>
    </main>
  );
}
