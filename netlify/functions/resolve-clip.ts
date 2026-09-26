type Quality = {
  quality: string;
  fps: number;
  url: string;
  height: number;
};

type GqlClip = {
  id?: string;
  title?: string;
  durationSeconds?: number;
  viewCount?: number;
  createdAt?: string;
  broadcaster?: {
    displayName?: string;
    login?: string;
  };
  curator?: {
    displayName?: string;
    login?: string;
  };
  thumbnailURL?: string;
  videoQualities?: Array<{
    quality?: string;
    frameRate?: number;
    sourceURL?: string;
  }>;
  playbackAccessToken?: {
    signature?: string;
    value?: string;
  };
};

const TWITCH_GQL = "https://gql.twitch.tv/gql";
const TWITCH_WEB_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";

/*
 * Twitch's website uses an internal GraphQL surface for its web player.
 * This is not the official public Twitch GraphQL API.
 *
 * Persisted query hashes can change when Twitch updates its web client.
 * The resolver therefore has a small fallback list.
 */
const ACCESS_QUERY_HASHES = [
  "993d9a5131f15a37bd16f32342c44ed1e0b1a9b968c6afdb662d2cddd595f6c5",
  "36b89d2507fce29e5ca551df756d27c1cfe079e2609642b4390aa4c35796eb11"
];

function parseClipSlug(input: string): string {
  let url: URL;

  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Enter a valid Twitch URL.");
  }

  const host = url.hostname.toLowerCase();

  if (
    host !== "twitch.tv" &&
    host !== "www.twitch.tv" &&
    host !== "clips.twitch.tv"
  ) {
    throw new Error("This doesn't look like a Twitch Clip URL.");
  }

  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "clips.twitch.tv") {
    if (!parts[0]) throw new Error("Clip slug is missing.");
    return parts[0];
  }

  const clipIndex = parts.findIndex(
    part => part.toLowerCase() === "clip"
  );

  if (clipIndex < 0 || !parts[clipIndex + 1]) {
    throw new Error(
      "Use a URL like https://www.twitch.tv/channel/clip/ClipSlug"
    );
  }

  return parts[clipIndex + 1];
}

async function gql(body: unknown) {
  const response = await fetch(TWITCH_GQL, {
    method: "POST",
    headers: {
      "Client-ID": TWITCH_WEB_CLIENT_ID,
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Twitch returned HTTP ${response.status}.`);
  }

  const data = await response.json();

  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    throw new Error(
      data.errors
        .map((error: { message?: string }) => error.message ?? "GraphQL error")
        .join("; ")
    );
  }

  return data;
}

async function getClipMetadata(slug: string): Promise<GqlClip | null> {
  const query = `
    query ClipMetadata($slug: String!) {
      clip(slug: $slug) {
        id
        title
        durationSeconds
        viewCount
        createdAt
        broadcaster {
          displayName
          login
        }
        curator {
          displayName
          login
        }
        thumbnailURL(width: 1280, height: 720)
      }
    }
  `;

  const response = await gql({
    operationName: "ClipMetadata",
    query,
    variables: { slug }
  });

  return response?.data?.clip ?? null;
}

  const response = await gql({
    query,
    variables: { slug }
  });

  return response?.data?.clip ?? null;
}

async function getAccessData(slug: string) {
  for (const hash of ACCESS_QUERY_HASHES) {
    const response = await gql({
      operationName: "VideoAccessToken_Clip",
      variables: {
        platform: "web",
        slug
      },
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash: hash
        }
      }
    });

    const clip = response?.data?.clip;

    if (clip?.playbackAccessToken && Array.isArray(clip.videoQualities)) {
      return clip;
    }
  }

  return null;
}

function withAccessToken(
  sourceURL: string,
  signature: string,
  value: string
) {
  const url = new URL(sourceURL);
  url.searchParams.set("sig", signature);
  url.searchParams.set("token", value);
  return url.toString();
}

export default async (request: Request) => {
  if (request.method !== "POST") {
    return Response.json(
      { error: "Method not allowed." },
      { status: 405 }
    );
  }

  try {
    const body = await request.json() as { url?: string };

    if (!body.url) {
      return Response.json(
        { error: "Paste a Twitch Clip URL first." },
        { status: 400 }
      );
    }

    const slug = parseClipSlug(body.url);

    const [metadata, access] = await Promise.all([
  getClipMetadata(slug),
  getAccessData(slug)
]);

if (!metadata || !access) {
  return Response.json(
    {
      error:
        "Twitch returned playback data, but complete Clip metadata was unavailable."
    },
    { status: 502 }
  );
}

const broadcaster =
  metadata.broadcaster?.displayName ??
  metadata.broadcaster?.login;

const creator =
  metadata.curator?.displayName ??
  metadata.curator?.login;

if (
  !broadcaster ||
  !creator ||
  metadata.durationSeconds == null ||
  metadata.viewCount == null
) {
  return Response.json(
    {
      error:
        "Twitch returned incomplete Clip metadata. Please try again."
    },
    { status: 502 }
  );
}
    const sourceQualities =
      metadata?.videoQualities?.length
        ? metadata.videoQualities
        : access?.videoQualities ?? [];

    const signature = access?.playbackAccessToken?.signature;
    const token = access?.playbackAccessToken?.value;

    const typedSourceQualities: NonNullable<GqlClip["videoQualities"]> =
      sourceQualities;

    const qualities: Quality[] = typedSourceQualities
      .filter(q => q.sourceURL && q.quality)
      .map(q => {
        const rawQuality = String(q.quality);
        const fps = Number(q.frameRate ?? 0);
        const height = Number.parseInt(rawQuality.replace("p", ""), 10) || 0;

        let sourceURL = q.sourceURL!;

        if (signature && token) {
          sourceURL = withAccessToken(sourceURL, signature, token);
        }

        return {
          quality: `${height || rawQuality}p`,
          fps,
          height,
          url: sourceURL
        };
      })
      .filter(item => item.url)
      .sort((a, b) => b.height - a.height);

    const unique = Array.from(
      new Map(qualities.map(item => [item.quality, item])).values()
    );

    if (!unique.length) {
      return Response.json(
        {
          error:
            "Twitch returned the Clip, but no downloadable video source was available."
        },
        { status: 404 }
      );
    }

    return Response.json({
      id: metadata?.id ?? access?.id ?? slug,
      title: metadata?.title ?? slug,
      broadcaster,
      creator,
      duration: metadata.durationSeconds,
      views: metadata.viewCount,
      thumbnail: metadata?.thumbnailURL ?? "",
      qualities: unique
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected resolver error."
      },
      { status: 500 }
    );
  }
};
