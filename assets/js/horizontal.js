  (() => {
    "use strict";

    const SYSTEM_TWITCH_AVATAR_URL = "https://static-cdn.jtvnw.net/jtv_user_pictures/7db44749-286f-4db0-9c99-574b16170d44-profile_image-70x70.png";
    const YOUTUBE_NAME_COLORS = [
      "#ff7f50", "#1e90ff", "#32cd32", "#ff69b4", "#ba55d3", "#00ced1",
      "#ffb000", "#8a2be2", "#00b894", "#e84393", "#f97316", "#38bdf8",
      "#a3e635", "#f472b6", "#c084fc", "#2dd4bf", "#facc15", "#60a5fa",
      "#fb7185", "#22c55e", "#818cf8", "#fb923c", "#06b6d4", "#e879f9",
      "#84cc16", "#f59e0b", "#14b8a6", "#ec4899", "#93c5fd", "#d946ef"
    ];
    const youtubeColorByUserKey = new Map();
    const youtubeUserKeyByColor = new Map();

    const params = new URLSearchParams(location.search);
    const urlFontSize = params.get("fontSize") ?? params.get("fontsize") ?? params.get("fs");
    const CONFIG = {
      connect: params.get("connect") === "1",
      debugWS: params.get("debugWS") === "1",
      debugPayload: params.get("debugPayload") === "1",
      bg: params.get("bg") || "#000000",
      opacity: clampNumber(params.get("opacity"), 0, 1, 1),
      accentColor: params.get("accentColor") || "#8b5cf6",
      sbHost: params.get("sbHost") || "127.0.0.1",
      sbPort: params.get("sbPort") || "8080",
      showTimestamp: params.get("timestamp") !== "0" && params.get("showTimestamp") !== "0",
      showAvatar: params.get("avatars") !== "0" && params.get("showAvatar") !== "0",
      showPlatform: params.get("platform") !== "0" && params.get("showPlatform") !== "0",
      showBadges: params.get("badges") !== "0" && params.get("showBadges") !== "0",
      showUsername: params.get("username") !== "0" && params.get("showUsername") !== "0",
      font: params.get("font") || "",
      fontSize: clampNumber(urlFontSize, 10, 44, 18),
      groupConsecutiveMessages: params.get("groupConsecutiveMessages") === "1",
      highlightMentions: params.get("highlightMentions") !== "0",
      streamerNames: splitList(params.get("streamerNames") || params.get("streamer") || "jsmoctezuma"),
      twitchChatMessages: params.get("twitch.chatMessages") !== "0",
      twitchNewFollowers: params.get("twitch.newFollowers") !== "0",
      twitchNewSubscribers: params.get("twitch.newSubscribers") !== "0",
      twitchCheers: params.get("twitch.cheers") !== "0",
      twitchRaids: params.get("twitch.raids") !== "0",
      twitchRewards: params.get("twitch.channelPointRedemptions") !== "0",
      twitchAnnouncements: params.get("twitch.announcements") !== "0",
      twitchChatState: params.get("twitch.chatState") !== "0",
      twitchWatchStreaks: params.get("twitch.watchStreaks") !== "0",
      youtubeSuperChats: params.get("youtube.superChats") !== "0",
      youtubeSuperStickers: params.get("youtube.superStickers") !== "0",
      youtubeGifts: params.get("youtube.gifts") !== "0",
      youtubeMemberships: params.get("youtube.memberships") !== "0",
      youtubeChatMessages: params.get("youtube.chatMessages") !== "0",
      kickEnabled: params.get("kick.enabled") !== "0",
      kickChatMessages: params.get("kick.chatMessages") !== "0",
      kickFollowers: params.get("kick.newFollowers") !== "0",
      kickSubscribers: params.get("kick.newSubscribers") !== "0",
      kickRewards: params.get("kick.channelPointRedemptions") !== "0",
      kickGifts: params.get("kick.gifts") !== "0",
      tiktokEnabled: params.get("tiktok") === "1",
      tikfinityUrl: params.get("tfUrl") || "ws://localhost:21213/",
      tiktokChatMessages: params.get("tiktok.chatMessages") !== "0",
      tiktokGifts: params.get("tiktok.gifts") !== "0",
      tiktokLikes: params.get("tiktok.likes") !== "0",
      tiktokShares: params.get("tiktok.shares") !== "0",
      tiktokFollowers: params.get("tiktok.newFollowers") !== "0",
      tiktokSubscribers: params.get("tiktok.newSubscribers") !== "0",
      emoteSize: clampNumber(params.get("emoteSize"), 12, 96, 0),
      emoteLargeSize: clampNumber(params.get("emoteLargeSize"), 48, 320, 0),
      maxItems: clampNumber(params.get("maxItems"), 6, 40, 18),
      hideAfter: clampNumber(params.get("hideAfter"), 0, 600, 0) * 1000,
      excludeCommands: params.get("excludeCommands") !== "0",
      ignoreChatters: splitList(params.has("ignoreChatters") ? params.get("ignoreChatters") : "streamelements,nightbot,streamlabs")
    };

    const bgRgb = hexToRgb(CONFIG.bg) || { r: 0, g: 0, b: 0 };
    const accentRgb = hexToRgb(CONFIG.accentColor) || { r: 139, g: 92, b: 246 };
    document.documentElement.style.setProperty("--bg", CONFIG.bg);
    document.documentElement.style.setProperty("--bg-r", String(bgRgb.r));
    document.documentElement.style.setProperty("--bg-g", String(bgRgb.g));
    document.documentElement.style.setProperty("--bg-b", String(bgRgb.b));
    document.documentElement.style.setProperty("--accent-r", String(accentRgb.r));
    document.documentElement.style.setProperty("--accent-g", String(accentRgb.g));
    document.documentElement.style.setProperty("--accent-b", String(accentRgb.b));
    document.documentElement.style.setProperty("--opacity", String(CONFIG.opacity));
    document.documentElement.style.setProperty("--accent", CONFIG.accentColor);
    applyVisualScale(CONFIG.fontSize);
    if (CONFIG.font) {
      loadGoogleFont(CONFIG.font);
      document.documentElement.style.setProperty("--font", `${cssFontName(CONFIG.font)}, "Rajdhani", "Arial Narrow", Arial, sans-serif`);
    }

    const track = document.getElementById("tickerTrack");
    const eventOverlay = document.getElementById("eventOverlay");
    const wsStatus = document.getElementById("wsStatus");
    const wsText = document.getElementById("wsText");

    if (CONFIG.debugWS) wsStatus.classList.add("debugOn");

    function applyVisualScale(logicalFontSize) {
      // Tamaños reales: fontSize=18 significa texto real de 18px.
      // Sin fontSize se aplica exactamente el mismo camino que fontSize=18.
      // La barra NO se agranda: --bar-h queda fija en 40px.
      const base = Number.isFinite(Number(logicalFontSize)) ? Number(logicalFontSize) : 18;
      const avatar = Math.max(16, Math.min(32, Math.round(base + 2)));
      const badge = Math.max(12, Math.min(24, Math.round(base * .78)));
      const emote = CONFIG && CONFIG.emoteSize ? Math.max(12, Math.min(96, Math.round(CONFIG.emoteSize))) : Math.max(16, Math.min(32, Math.round(base + 2)));
      const icon = Math.max(14, Math.min(24, Math.round(base)));
      const gap = Math.max(26, Math.round(base + 18));

      document.documentElement.style.setProperty("--font-size", `${base}px`);
      document.documentElement.style.setProperty("--time-size", `${base}px`);
      document.documentElement.style.setProperty("--bar-h", "40px");
      document.documentElement.style.setProperty("--avatar", `${avatar}px`);
      document.documentElement.style.setProperty("--badge", `${badge}px`);
      document.documentElement.style.setProperty("--emote", `${emote}px`);
      document.documentElement.style.setProperty("--icon", `${icon}px`);
      document.documentElement.style.setProperty("--gap", `${gap}px`);
    }



    function clampNumber(value, min, max, fallback) {
      // Importante:
      // URLSearchParams.get(...) devuelve null cuando el parámetro no existe.
      // Number(null) da 0, y eso estaba mandando fontSize ausente al mínimo 10.
      // Por eso sin fontSize se veía en 10px.
      if (value === null || value === undefined || String(value).trim() === "") {
        return fallback;
      }
      const n = Number(value);
      if (!Number.isFinite(n)) return fallback;
      return Math.min(max, Math.max(min, n));
    }

    function normalizeChatterToken(value = "") {
      return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/^@+/, "")
        .replace(/\s+/g, "")
        .replace(/[^a-z0-9_\-.]/g, "");
    }

    function splitList(value) {
      return String(value || "")
        .split(",")
        .map(v => normalizeChatterToken(v))
        .filter(Boolean);
    }



    function cssFontName(font) {
      const clean = String(font || "").trim().replace(/[;"<>]/g, "");
      if (!clean) return "";
      return clean.includes(" ") ? `"${clean}"` : clean;
    }

    function loadGoogleFont(font) {
      const clean = String(font || "").trim().replace(/[;"<>]/g, "");
      if (!clean) return;

      const key = "hipe-font-" + clean.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      if (document.getElementById(key)) return;

      const link = document.createElement("link");
      link.id = key;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=" + encodeURIComponent(clean).replace(/%20/g, "+") + ":wght@400;500;600;700;800&display=swap";
      document.head.appendChild(link);
    }

    function hexToRgb(value) {
      const raw = String(value || "").trim();
      const hex = raw.startsWith("#") ? raw.slice(1) : raw;
      if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hex)) return null;
      const full = hex.length === 3
        ? hex.split("").map(ch => ch + ch).join("")
        : hex;
      return {
        r: parseInt(full.slice(0, 2), 16),
        g: parseInt(full.slice(2, 4), 16),
        b: parseInt(full.slice(4, 6), 16)
      };
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function safeUrl(url) {
      const u = String(url || "").trim();
      return /^https?:\/\//i.test(u) ? u : "";
    }

    function compact(value = "", max = 160) {
      const text = String(value || "").replace(/\s+/g, " ").trim();
      return text.length > max ? `${text.slice(0, Math.max(0, max - 1)).trim()}…` : text;
    }

    function first(...values) {
      for (const value of values) {
        if (value !== undefined && value !== null && String(value).trim() !== "") return value;
      }
      return "";
    }

    function isExplicitTrue(value) {
      if (value === true || value === 1) return true;
      if (value === false || value === 0 || value === null || value === undefined) return false;
      const normalized = String(value).trim().toLowerCase();
      return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "y";
    }

    function hasReplyValue(value, depth = 0) {
      if (value === null || value === undefined) return false;

      if (typeof value === "boolean") return value === true;
      if (typeof value === "number") return Number.isFinite(value);

      if (Array.isArray(value)) {
        return value.some(entry => hasReplyValue(entry, depth + 1));
      }

      if (typeof value === "object") {
        if (depth > 2) return Object.keys(value).length > 0;
        return Object.values(value).some(entry => hasReplyValue(entry, depth + 1));
      }

      const text = String(value).trim();
      if (!text) return false;
      const normalized = text.toLowerCase();
      return normalized !== "false" && normalized !== "null" && normalized !== "undefined";
    }

    function normalizePlatform(value) {
      const text = String(value || "").toLowerCase();
      if (text.includes("youtube") || text === "yt") return "youtube";
      if (text.includes("tiktok") || text.includes("tikfinity") || text === "tt") return "tiktok";
      if (text.includes("kick")) return "kick";
      if (text.includes("twitch")) return "twitch";
      if (text.includes("general")) return "general";
      return text || "twitch";
    }



    function timeNow(raw) {
      const text = String(raw || "").trim();
      const value = /^\d{10,13}$/.test(text)
        ? Number(text.length <= 10 ? Number(text) * 1000 : text)
        : raw;
      const d = value ? new Date(value) : new Date();
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }

    function hasKickEmoteTokens(value = "") {
      return /\[emote:[^:\]\s]+:[^\]]+\]/i.test(String(value || ""));
    }

    function renderKickEmoteTokenFallback(value = "") {
      return escapeHtml(String(value || "")).replace(
        /\[emote:([^:\]\s]+):([^\]]+)\]/gi,
        (_match, id, label) => {
          const cleanLabel = String(label || "").trim();
          const safeLabel = cleanLabel || "emote";
          return `<span class="kick-emote-fallback" data-kick-emote-id="${escapeHtml(id)}" title="${escapeHtml(`Kick emote ${id}`)}">${escapeHtml(safeLabel)}</span>`;
        }
      );
    }

    function renderKickEmoteTokensWithImages(value = "", emotes = []) {
      const raw = String(value || "");
      const byName = new Map();
      (Array.isArray(emotes) ? emotes : []).forEach((emote) => {
        const name = String(emote?.name || "").trim().toLowerCase();
        if (name && !byName.has(name)) byName.set(name, emote);
      });

      const tokenPattern = /\[emote:([^:\]\s]+):([^\]]+)\]/gi;
      let cursor = 0;
      let html = "";
      let match;

      while ((match = tokenPattern.exec(raw))) {
        const [token, id, label] = match;
        const cleanLabel = String(label || "").trim();
        const emote = byName.get(cleanLabel.toLowerCase());

        html += escapeHtml(raw.slice(cursor, match.index));

        if (emote?.imageUrl) {
          const alt = cleanLabel || emote.name || "Kick emote";
          html += `<img class="emote" src="${escapeHtml(emote.imageUrl)}" alt="${escapeHtml(alt)}" loading="lazy" referrerpolicy="no-referrer">`;
        } else {
          const safeLabel = cleanLabel || "emote";
          html += `<span class="kick-emote-fallback" data-kick-emote-id="${escapeHtml(id)}" title="${escapeHtml(`Kick emote ${id}`)}">${escapeHtml(safeLabel)}</span>`;
        }

        cursor = match.index + token.length;
      }

      html += escapeHtml(raw.slice(cursor));
      return html;
    }

    function normalizeBadges(badges) {
      if (!Array.isArray(badges)) return [];
      return badges.map(b => ({
        name: first(b.name, b.id, ""),
        imageUrl: first(b.imageUrl, b.url, b.image_url, ""),
        version: first(b.version, ""),
        info: first(b.info, "")
      })).filter(b => b.name || b.imageUrl);
    }

    function normalizeEmotes(payload = {}) {
      const raw = [];
      if (Array.isArray(payload.emotes)) raw.push(...payload.emotes);
      if (Array.isArray(payload.message_emotes)) raw.push(...payload.message_emotes);
      if (payload.emote && typeof payload.emote === "object") raw.push(payload.emote);
      const powerUp = first(payload.power_up, payload.powerUp, payload.powerup, {});
      if (powerUp && typeof powerUp === "object" && powerUp.emote) raw.push(powerUp.emote);
      const messageObj = payload.message && typeof payload.message === "object" ? payload.message : {};
      if (Array.isArray(messageObj.fragments)) {
        for (const fragment of messageObj.fragments) {
          if (fragment && fragment.emote) {
            raw.push({
              id: fragment.emote.id,
              name: first(fragment.text, fragment.emote.name, fragment.emote.id, ""),
              imageUrl: fragment.emote.id ? `https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(fragment.emote.id)}/default/dark/3.0` : "",
              type: "Twitch"
            });
          }
        }
      }
      if (Array.isArray(payload.parts)) {
        for (const part of payload.parts) {
          if (String(part.type || "").toLowerCase() === "emote" || part.imageUrl || part.image) raw.push(part);
        }
      }

      const seen = new Set();
      const out = [];
      for (const e of raw) {
        const name = first(e.name, e.text, e.emoji, "");
        const imageUrl = first(e.imageUrl, e.image_url, e.url, e.image, "");
        const id = first(e.id, e.emoteId, e.emote_id, "");
        const start = first(e.startIndex, e.begin, e.start, "");
        const end = first(e.endIndex, e.end, "");
        const provider = String(first(e.provider, e.source, e.type, "")).toLowerCase();
        const key = `${id}|${name}|${start}|${end}|${provider}|${imageUrl}`;
        if (!name || !imageUrl || seen.has(key)) continue;
        seen.add(key);
        out.push({
          id,
          name,
          imageUrl,
          provider,
          startIndex: Number(start),
          endIndex: Number(end)
        });
      }
      return out;
    }

    function getPowerUpSignal(...sources) {
      const texts = [];
      sources.forEach((source) => {
        if (!source || typeof source !== "object") return;
        if (source.gigantify === true || source.isGigantify === true || source.gigantified === true) {
          texts.push("gigantify");
        }
        const powerUp = first(source.power_up, source.powerUp, source.powerup, {});
        const powerUpObj = powerUp && typeof powerUp === "object" ? powerUp : {};
        const messageObj = source.message && typeof source.message === "object" ? source.message : {};
        texts.push(
          source.message_type,
          source.messageType,
          source.reward_type,
          source.rewardType,
          source.powerUpType,
          source.powerupType,
          source.power_up_type,
          source.powerUpName,
          source.powerupName,
          source.powerUpTitle,
          source.eventType,
          source.type,
          source.kind,
          powerUpObj.type,
          powerUpObj.name,
          powerUpObj.title,
          messageObj.message_type,
          messageObj.messageType
        );
      });
      const joined = texts.filter((value) => value !== undefined && value !== null).join(" ").toLowerCase();
      return joined.includes("gigantify_an_emote") || joined.includes("power_ups_gigantified_emote") || joined.includes("gigantify") || joined.includes("gigantificar");
    }



    function renderMessageText(message, emotes = []) {
      let text = String(message || "");
      if (!text) return "";
      if (hasKickEmoteTokens(text)) return renderKickEmoteTokensWithImages(compact(text, 180), emotes);

      function emoteImg(e) {
        return `<img class="emote" src="${escapeHtml(e.imageUrl)}" alt="${escapeHtml(e.name)}" loading="lazy" referrerpolicy="no-referrer">`;
      }

      function rangeMatchesToken(e) {
        if (!Number.isInteger(e.startIndex) || !Number.isInteger(e.endIndex)) return false;
        const start = Math.max(0, e.startIndex);
        const end = Math.min(text.length - 1, e.endIndex);
        const sliced = text.slice(start, end + 1);
        const name = String(e.name || "");
        return !(
          name &&
          name.includes(":") &&
          text.includes(name) &&
          sliced !== name
        );
      }

      const usable = emotes
        .filter((e) => {
          if (!Number.isInteger(e.startIndex) || !Number.isInteger(e.endIndex) || !e.imageUrl) return false;
          const provider = String(e.provider || "").toLowerCase();
          const imageUrl = String(e.imageUrl || "").toLowerCase();
          // v39: no confiar en rangos para Twemoji/emoji unicode; a veces llegan desfasados
          // y terminan cortando texto o dejando caracteres rotos. Esos se resuelven abajo por token.
          if (provider.includes("twemoji") || imageUrl.includes("twemoji")) return false;
          return rangeMatchesToken(e);
        })
        .sort((a, b) => a.startIndex - b.startIndex);

      if (!usable.length) {
        let html = escapeHtml(compact(text, 180));
        const tokenEmotes = [];
        const seenTokenEmotes = new Set();

        emotes
          .filter(e => e.name && e.imageUrl && text.includes(e.name))
          .sort((a, b) => String(b.name).length - String(a.name).length)
          .forEach((e) => {
            const key = String(e.name || "").toLowerCase();
            if (!key || seenTokenEmotes.has(key)) return;
            seenTokenEmotes.add(key);
            if (tokenEmotes.length < 12) tokenEmotes.push(e);
          });

        for (const e of tokenEmotes) {
          html = html.split(escapeHtml(e.name)).join(emoteImg(e));
        }

        return html;
      }

      let html = "";
      let cursor = 0;
      for (const e of usable) {
        const start = Math.max(0, e.startIndex);
        const end = Math.min(text.length - 1, e.endIndex);
        if (start < cursor) continue;
        html += escapeHtml(text.slice(cursor, start));
        html += emoteImg(e);
        cursor = end + 1;
      }
      html += escapeHtml(text.slice(cursor));

      const fallbackTokenEmotes = [];
      const seenFallbackTokenEmotes = new Set();

      emotes
        .filter(e => e.name && e.imageUrl && text.includes(e.name) && !usable.includes(e))
        .sort((a, b) => String(b.name).length - String(a.name).length)
        .forEach((e) => {
          const key = String(e.name || "").toLowerCase();
          if (!key || seenFallbackTokenEmotes.has(key)) return;
          seenFallbackTokenEmotes.add(key);
          if (fallbackTokenEmotes.length < 12) fallbackTokenEmotes.push(e);
        });

      for (const e of fallbackTokenEmotes) {
        html = html.split(escapeHtml(e.name)).join(emoteImg(e));
      }

      return html;
    }



    function icon(platform) {
      if (platform === "youtube") {
        return `<svg viewBox="0 0 48 48" aria-label="YouTube" role="img" preserveAspectRatio="xMidYMid meet"><rect x="4" y="10" width="40" height="28" rx="8" fill="#FF1F2D"/><path fill="#FFFFFF" d="M20.8 18.2 31.8 24 20.8 29.8V18.2Z"/></svg>`;
      }
      if (platform === "kick") {
        return `<span aria-label="Kick" role="img">K</span>`;
      }
      if (platform === "tiktok") {
        return `<svg viewBox="0 0 48 48" aria-label="TikTok" role="img" preserveAspectRatio="xMidYMid meet"><path fill="#25F4EE" d="M20.6 18.8v16.1a6.9 6.9 0 1 1-6.9-6.9c.5 0 1 .1 1.5.2v5.1a2 2 0 1 0 1.4 1.9V6h5.2c.7 4.3 3.2 7 7.6 7.5v5.3c-2.8-.1-5.3-1-7.5-2.7v18.8A12.2 12.2 0 1 1 9.7 22.7c1.9 0 3.7.4 5.4 1.2v5.8a6.9 6.9 0 1 0 5.5 6.7V18.8Z"/><path fill="#FE2C55" d="M23.6 6h5.2c.7 4.3 3.2 7 7.6 7.5v5.3c-2.8-.1-5.3-1-7.5-2.7v18.8A12.2 12.2 0 0 1 9 44.4a12.2 12.2 0 0 0 21-8.5V17.1c2.2 1.7 4.7 2.6 7.5 2.7v-4.1c-4.4-.5-6.9-3.2-7.6-7.5h-5.2v28.3a6.9 6.9 0 0 1-10.9 5.6 6.9 6.9 0 0 0 11-5.6V6Z" opacity=".82"/><path fill="#FFFFFF" d="M22.1 6h5.2c.7 4.3 3.2 7 7.6 7.5v3.6c-2.8-.1-5.3-1-7.5-2.7v18.8A12.2 12.2 0 1 1 15.2 21c.5 0 1 .03 1.5.1v5.3a6.9 6.9 0 1 0 5.4 6.7V6Z"/></svg>`;
      }
      return `<svg viewBox="0 0 48 48" aria-label="Twitch" role="img"><path fill="#9146FF" d="M8 5h34v23.5L32.5 38H25l-6.5 6.5V38H8V5Z"/><path fill="#FFFFFF" d="M12 9h26v17.8L30.8 34H23l-5.5 5.5V34H12V9Z"/><path fill="#9146FF" d="M20 16h4v11h-4V16Zm10 0h4v11h-4V16Z"/></svg>`;
    }



    const avatarCache = new Map();

    function buildFallbackAvatarUrl(item = {}) {
      const platform = normalizePlatform(first(item.platform, item.source, ""));
      const username = String(first(item.username, item.login, item.displayName, item.name, "") || "").trim();
      const userId = String(first(item.userId, item.id, "") || "").trim();

      if (platform === "twitch") {
        // En vertical usamos username primero para evitar icono genérico de Twitch por id.
        if (username) return `https://unavatar.io/twitch/${encodeURIComponent(username)}`;
        if (userId) return `https://unavatar.io/twitch/${encodeURIComponent(userId)}`;
      }

      if (platform === "youtube") {
        if (userId) return `https://unavatar.io/youtube/${encodeURIComponent(userId)}`;
        if (username) return `https://unavatar.io/youtube/${encodeURIComponent(username)}`;
      }

      return "";
    }

    function resolveAvatar(item = {}) {
      if (!CONFIG.showAvatar) return "";
      if (item.systemAvatar) return "";

      const direct = safeUrl(first(
        item.avatar,
        item.avatarUrl,
        item.profileImage,
        item.profileImageUrl,
        item.profile_image_url,
        item.userProfileImageUrl,
        item.userProfileImage,
        ""
      ));

      if (direct) return direct;

      const fallback = buildFallbackAvatarUrl(item);
      return safeUrl(fallback);
    }

    function avatarHtml(item, system = false) {
      if (!CONFIG.showAvatar) return "";

      if (system || item.systemAvatar) {
        const url = item.platform === "youtube" ? "" : SYSTEM_TWITCH_AVATAR_URL;
        if (url) return `<img class="avatar" src="${escapeHtml(url)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
      }

      const resolved = resolveAvatar(item);
      if (resolved) return `<img class="avatar" src="${escapeHtml(resolved)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;

      return `<span class="avatarFallback"></span>`;
    }

    function hydrateAvatars() {
      // Vertical v23: sin Decapi, sin preload, sin hydrate.
      // avatar directo -> unavatar.io -> pintar inmediato.
    }

    function userFrom(data = {}, flat = {}) {
      return first(data.user, flat.user, data._user, {});
    }

    function isSilentInfrastructureEvent(payload = {}) {
      const root = payload && typeof payload === "object" ? payload : {};
      const rootEvent = root.event && typeof root.event === "object" ? root.event : {};
      const rootData = root.data && typeof root.data === "object" ? root.data : {};
      const nestedEvent = rootData.event && typeof rootData.event === "object" ? rootData.event : {};
      const eventType = String(first(rootEvent.type, nestedEvent.type, root.type, rootData.type, "") || "").toLowerCase();
      const eventSource = String(first(rootEvent.source, nestedEvent.source, root.source, rootData.source, "") || "").toLowerCase();
      const dataType = String(first(rootData.type, root.type, "") || "").toLowerCase();
      const dataAction = String(first(rootData.action, root.action, "") || "").toLowerCase();

      return (
        eventType === "viewercountupdate" ||
        eventType === "presentviewers" ||
        eventType === "broadcasterchatconnected" ||
        eventType === "broadcasterchatdisconnected" ||
        dataType === "hipe:viewers" ||
        dataAction === "goalupdate" ||
        dataAction === "streamstate" ||
        dataAction === "viewerupdate" ||
        dataAction === "viewercountupdate" ||
        (eventSource === "general" && dataType.startsWith("hipe:"))
      );
    }

    function normalizePayload(raw = {}) {
      if (isSilentInfrastructureEvent(raw)) {
        return { kind: "ignored", category: "ignored", platform: normalizePlatform(raw?.event?.source || raw?.source || raw?.platform || "general") };
      }

      const root = raw && typeof raw === "object" ? raw : {};
      const rootEvent = root.event && typeof root.event === "object" ? root.event : {};
      const rootData = root.data && typeof root.data === "object" ? root.data : {};

      const nestedEvent = rootData.event && typeof rootData.event === "object" ? rootData.event : {};
      const nestedData = rootData.data && typeof rootData.data === "object" ? rootData.data : {};
      const nestedSource = String(nestedEvent.source || "").toLowerCase();
      const unwrapNested =
        String(rootEvent.source || "").toLowerCase() === "general" &&
        String(rootEvent.type || "").toLowerCase() === "custom" &&
        nestedEvent.type &&
        (nestedSource === "kick" || nestedSource === "twitch" || nestedSource === "youtube");

      const event = unwrapNested ? nestedEvent : rootEvent;
      const data = unwrapNested ? nestedData : rootData;
      const flat = { ...data, ...root };
      const source = normalizePlatform(first(root.source, data.platform, data.source, flat.platform, event.source, "twitch"));
      const type = String(first(event.type, root.type, data.type, ""));
      const lower = type.toLowerCase();

      const userObj = first(data.user, root.user, data._user, {});
      const targetUser = first(data.targetUser, data.target, root.targetUser, {});
      const recipient = first(data.recipient, data.receiver, root.recipient, {});
      const messageObj = first(data.message, root.message, {});

      const item = {
        raw,
        source,
        platform: source,
        type,
        kind: "event",
        category: "event",
        eventType: type,
        username: first(
          userObj.name, userObj.displayName, userObj.login,
          data.user_name, data.userName, data.user_login,
          root.user_name, root.userName, root.user_login,
          messageObj.authorName,
          data.authorName,
          ""
        ),
        userId: first(userObj.id, data.user_id, data.userId, root.user_id, root.userId, ""),
        messageId: first(
          data.messageId,
          data.message_id,
          data.msgId,
          messageObj.messageId,
          messageObj.message_id,
          messageObj.msgId,
          root.messageId,
          root.message_id,
          root.msgId,
          ""
        ),
        avatar: first(
          userObj.profileImageUrl, userObj.profileImage, userObj.profilePicture, userObj.avatar, userObj.avatarUrl, userObj.profile_image_url,
          data.profileImageUrl, data.profileImage, data.profilePicture, data.profile_image_url, data.avatar, data.avatarUrl,
          messageObj.profileImageUrl,
          ""
        ),
        nameColor: first(userObj.color, data.color, data.nameColor, ""),
        badges: normalizeBadges(first(userObj.badges, data.badges, root.badges, [])),
        emotes: normalizeEmotes(data),
        message: first(data.text, data.message_text, data.userInput, data.user_input, data.systemMessage, data.message, root.text, root.message, ""),
        isReply: isExplicitTrue(data.isReply) || isExplicitTrue(root.isReply),
        reply: first(data.reply, root.reply, null),
        replyUser: "",
        replyText: "",
        time: timeNow(first(root.timeStamp, root.timestamp, data.publishedAt, data.created_at, data.redeemed_at, data.redeemedAt, "")),
        amount: "",
        muted: "",
        systemAvatar: ""
      };

      const powerUpSignal = getPowerUpSignal(root, data, messageObj, item);

      if (powerUpSignal) {
        item.kind = "event";
        item.category = "powerUps";
        item.eventType = "PowerUp";
        item.username = first(
          item.username,
          data.user_name,
          data.userName,
          data.user_login,
          userObj.name,
          userObj.login,
          "Usuario"
        );
        item.userId = first(item.userId, data.user_id, data.userId, userObj.id, "");
        item.amount = "Emote gigante";
        item.message = first(
          data.message_text,
          data.messageText,
          data.user_input,
          data.userInput,
          data.text,
          typeof data.message === "string" ? data.message : "",
          messageObj.text,
          item.message,
          item.emotes[0] && item.emotes[0].name,
          ""
        );
        item.emotes = normalizeEmotes(data);
        registerPowerUpEcho(item);
        return item;
      }

      if (source === "youtube") {
        const ytUser = first(data.user, root.user, {});
        item.username = first(ytUser.name, ytUser.displayName, data.authorName, data.name, item.username, "UsuarioYT");
        item.userId = first(ytUser.id, ytUser.channelId, data.authorChannelId, item.userId);
        item.avatar = first(ytUser.profileImageUrl, ytUser.profileImage, data.profileImageUrl, item.avatar);
        item.message = first(data.message, data.text, root.message, root.text, "");
        item.nameColor = getYouTubeUserColor(item);
      }

      // Normal messages
      if (lower === "chatmessage" || lower === "message") {
        item.kind = "message";
        item.category = "chatMessages";
        item.eventType = "";
        item.message = first(data.text, data.message, root.text, root.message, "");
        item.emotes = normalizeEmotes(data);
        item.reply = first(data.reply, root.reply, item.reply, null);
        const replyInfo = resolveReplyInfo({ ...item, _data: data, _message: messageObj });
        item.isReply = replyInfo.isReply;
        item.replyUser = replyInfo.user;
        item.replyText = replyInfo.text;
        return item;
      }

      // Moderation / chat state
      if (isChatState(type)) {
        item.kind = "event";
        item.category = "chatState";
        item.username = "Moderación";
        item.eventType = "de Chat:";
        item.amount = chatStateText(type, data);
        item.message = "";
        item.avatar = "";
        item.badges = [];
        item.nameColor = "";
        item.systemAvatar = "twitch";
        return item;
      }

      if (["chatmessagedeleted", "sharedchatmessagedeleted"].includes(lower)) {
        item.kind = "ignored";
        item.category = "ignored";
        return item;
      }

      if (lower === "chatcleared") {
        item.kind = "event";
        item.category = "chatState";
        item.username = "Moderación";
        item.eventType = "de Chat:";
        item.amount = "chat limpiado";
        item.message = "";
        item.systemAvatar = source === "youtube" ? "youtube" : "twitch";
        return item;
      }

      if (lower.includes("banned") || lower.includes("timedout")) {
        item.kind = "ignored";
        item.category = "ignored";
        return item;
      }

      // Follow
      if (lower === "follow") {
        const tu = Object.keys(targetUser || {}).length ? targetUser : userObj;
        item.kind = "event";
        item.category = "newFollowers";
        item.username = first(tu.name, tu.login, data.user_name, data.user_login, item.username, "Usuario");
        item.userId = first(tu.id, item.userId);
        item.avatar = first(tu.profilePicture, tu.profileImageUrl, tu.avatar, item.avatar);
        item.message = "";
        item.eventType = "Follow";
        return item;
      }

      // Twitch/Kick subs
      if (lower === "subscription" || lower === "sub") {
        item.kind = "event";
        item.category = "newSubscribers";
        item.eventType = source === "kick" ? "Subscription" : "se suscribió";
        item.amount = first(data.duration, data.months, userObj.monthsSubscribed, "");
        item.message = first(data.text, data.systemMessage, data.message, "");
        return item;
      }

      if (lower === "resubscription" || lower === "resub") {
        item.kind = "event";
        item.category = "newSubscribers";
        item.eventType = "ReSub";
        item.amount = first(
          data.duration,
          data.cumulativeMonths,
          data.cumulative_months,
          data.months,
          data.monthStreak,
          data.streakMonths,
          data.durationMonths,
          userObj.monthsSubscribed,
          ""
        );
        item.message = first(data.text, data.message, "");
        return item;
      }

      if (lower === "giftsubscription" || lower === "giftsub" || lower.includes("gift sub")) {
        const fromCommunityGift = Boolean(first(data.fromCommunitySubGift, false));
        const communityGiftCount = Number(first(data.communitySubGiftCount, 0));

        if (source !== "kick" && (fromCommunityGift || communityGiftCount > 1)) {
          item.kind = "ignored";
          item.category = "ignored";
          return item;
        }

        item.kind = "event";
        item.category = "newSubscribers";
        item.eventType = "GiftSub";
        item.amount = first(recipient.name, recipient.login, data.recipientName, data.recipient, "");
        const total = first(data.cumlativeTotal, data.cumulativeTotal, data.cumulative_total, data.communitySubGiftCumulativeTotal, "");
        item.message = total && Number(total) > 0 ? `ha regalado ${total} ${Number(total) === 1 ? "sub" : "subs"} en total` : "";
        return item;
      }

      if (lower === "massgiftsubscription" || lower === "giftbomb" || lower.includes("communitygift") || lower.includes("gift bomb")) {
        item.kind = "event";
        item.category = "newSubscribers";
        item.eventType = "GiftBomb";
        item.amount = first(
          data.communitySubGiftCount,
          data.total,
          data.totalGiftedCount,
          data.giftCount,
          data.count,
          data.amount,
          Array.isArray(data.recipients) ? data.recipients.length : "",
          ""
        );
        const total = first(data.cumulative_total, data.cumulativeTotal, data.cumlativeTotal, data.communitySubGiftCumulativeTotal, "");
        item.message = total ? `ha regalado ${total} ${Number(total) === 1 ? "sub" : "subs"} en total` : "";
        return item;
      }

      if (source === "kick" && (lower === "sgifted" || lower === "kicksgifted" || lower === "kicks gifted")) {
        const kicks = data.kicks || {};
        item.kind = "event";
        item.category = "gifts";
        item.eventType = "sGifted";
        item.amount = first(kicks.amount, data.amount, "");
        item.message = first(data.rawInput, data.rawInputEscaped, kicks.name, "Kicks Gift");
        return item;
      }

      if (lower === "cheer") {
        item.kind = "event";
        item.category = "cheers";
        item.eventType = "Cheer";
        item.amount = first(data.bits, root.bits, "");
        item.message = first(data.text, root.text, "");
        return item;
      }

      if (lower === "raid") {
        item.kind = "event";
        item.category = "raids";
        item.eventType = "Raid";
        item.username = first(data.from_broadcaster_user_name, data.from_broadcaster_user_login, item.username, "Raider");
        item.amount = first(data.viewers, data.viewerCount, "");
        item.message = "";
        return item;
      }

      if (lower === "announcement") {
        item.kind = "event";
        item.category = "announcements";
        item.eventType = "Anuncio";
        item.message = first(data.text, data.message, "");
        return item;
      }

      if (lower === "rewardredemption") {
        const reward = data.reward || {};
        const redeemer = data.redeemer || userObj || {};
        item.kind = "event";
        item.category = "channelPointRedemptions";
        item.eventType = "canjeó";
        item.username = first(redeemer.name, redeemer.login, data.user_name, data.user_login, item.username, "Usuario");
        item.userId = first(redeemer.id, data.user_id, item.userId);
        item.avatar = first(redeemer.profilePicture, redeemer.profileImageUrl, item.avatar);
        item.rewardTitle = first(reward.title, reward.name, data.rewardTitle, data.reward_name, data.title, "Recompensa");
        item.rewardCost = first(reward.cost, data.cost, "");
        item.amount = item.rewardTitle;
        item.message = "";
        return item;
      }

      const automaticRewardType = String(first(data.reward_type, data.rewardType, data.type, "")).toLowerCase();

      if (
        lower === "automaticrewardredemption" &&
        (
          automaticRewardType === "send_highlighted_message" ||
          automaticRewardType === "send highlighted message" ||
          automaticRewardType === "highlighted_message" ||
          automaticRewardType === "highlighted message"
        )
      ) {
        item.kind = "ignored";
        item.category = "ignored";
        return item;
      }

      if (lower === "automaticrewardredemption" && automaticRewardType === "message_effect") {
        item.kind = "event";
        item.category = "automaticRewards";
        item.eventType = "MessageEffect";
        item.username = first(data.user_name, data.user_login, item.username, "Usuario");
        item.userId = first(data.user_id, item.userId);
        item.amount = "efecto de mensaje";
        item.message = first(data.message_text, data.messageText, data.user_input, data.userInput, "");
        return item;
      }

      if (lower === "automaticrewardredemption" && automaticRewardType === "gigantify_an_emote") {
        item.kind = "event";
        item.category = "powerUps";
        item.eventType = "PowerUp";
        item.username = first(data.user_name, data.user_login, item.username, "Usuario");
        item.userId = first(data.user_id, item.userId);
        item.amount = "Emote gigante";
        item.message = first(data.gigantified_emote && data.gigantified_emote.name, data.message_text, "");
        item.emotes = normalizeEmotes({
          emotes: [data.gigantified_emote || {}],
          message_emotes: data.message_emotes || []
        });
        registerPowerUpEcho(item);
        return item;
      }

      if (lower === "watchstreak" || lower === "watchstreaks") {
        item.kind = "event";
        item.category = "watchStreaks";
        item.eventType = "Racha";
        item.username = first(data.displayName, data.userName, data.user_login, item.username, "Usuario");
        item.userId = first(data.userId, data.user_id, item.userId);
        item.amount = first(data.streak_count, data.streakCount, data.watchStreakCount, data.watchStreak, data.streak, data.count, "");
        item.message = first(data.message, data.text, "");
        item.emotes = normalizeEmotes(data);
        return item;
      }

      if (lower.startsWith("hypetrain")) {
        item.kind = "event";
        item.category = "hypeTrain";
        item.username = "🚂 Tren del Hype";
        item.eventType = lower.includes("end") ? "terminó" : lower.includes("update") || lower.includes("levelup") ? "avanzó" : "inició";
        item.amount = `Nivel ${first(data.level, "")} · ${first(data.progress, data.total, "")} / ${first(data.goal, "")}`.replace(/\s+/g, " ").trim();
        const top = Array.isArray(data.top_contributions) ? data.top_contributions[0] : null;
        item.message = top ? `Top: ${first(top.user_name, top.user_login, "")} · ${translateContribution(top.type)}` : "";
        item.avatar = "";
        item.systemAvatar = "twitch";
        return item;
      }

      // YouTube events
      if (source === "youtube") {
        if (lower === "jewelsgifted") {
          item.kind = "event";
          item.category = "gifts";
          item.eventType = "JewelsGifted";
          item.amount = first(data.name, data.altText, "regalo");
          item.message = first(data.jewelsAmount, data.jewels, "") ? `${first(data.jewelsAmount, data.jewels)} ${Number(first(data.jewelsAmount, data.jewels)) === 1 ? "joya" : "joyas"}` : "";
          item.giftName = item.amount;
          item.jewelsAmount = first(data.jewelsAmount, data.jewels, "");
          item.giftImageUrl = ""; // Vertical compacto: sin imagen grande por espacio.
          item.stickerImageUrl = "";
          return item;
        }

        if (lower === "superchat") {
          item.kind = "event";
          item.category = "superChats";
          item.eventType = "envió Super Chat";
          item.amount = first(data.amountText, data.displayString, data.amount, "");
          item.message = first(data.message, data.text, "");
          return item;
        }

        if (lower === "supersticker") {
          item.kind = "event";
          item.category = "superStickers";
          item.eventType = "envió Super Sticker";
          item.amount = first(data.amountText, data.displayString, data.amount, "");
          item.message = first(data.message, data.sticker && data.sticker.altText, "Super Sticker");
          return item;
        }

        if (lower === "newsponsor") {
          item.kind = "event";
          item.category = "memberships";
          item.eventType = "se hizo miembro";
          item.amount = first(data.levelName, "");
          item.message = "";
          return item;
        }

        if (lower === "newsubscriber") {
          item.kind = "event";
          item.category = "newSubscribers";
          item.eventType = "se suscribió";
          item.message = "";
          return item;
        }

        if (lower === "membermilestone") {
          item.kind = "event";
          item.category = "memberships";
          item.eventType = "cumplió";
          item.amount = first(data.months, "");
          item.message = first(data.message, "");
          return item;
        }

        if (lower === "membershipgift") {
          item.kind = "event";
          item.category = "memberships";
          item.eventType = "regaló";
          item.amount = first(data.count, data.amount, "");
          item.message = "";
          return item;
        }

        if (lower === "giftmembershipreceived") {
          item.kind = "event";
          item.category = "memberships";
          item.eventType = "recibió una membresía de";
          item.amount = first(data.gifterName, "");
          item.message = "";
          return item;
        }
      }

      return item;
    }



    function translateContribution(type) {
      const t = String(type || "").toLowerCase();
      if (t.includes("sub")) return "suscripción";
      if (t.includes("bits")) return "bits";
      return type || "aporte";
    }

    function isChatState(type) {
      return /^Chat(EmoteMode|FollowerMode|SlowMode|SubscriberMode|UniqueMode)/i.test(type || "")
        || /ShieldMode(Begin|End)/i.test(type || "");
    }

    function chatStateText(type, data = {}) {
      const lower = String(type || "").toLowerCase();
      const followMin = first(data.follow_duration_minutes, data.followDurationMinutes, "");
      const seconds = first(data.wait_time_seconds, data.waitTimeSeconds, data.slowModeWaitTimeSeconds, "");
      const minText = followMin !== "" ? ` (${followMin} ${Number(followMin) === 1 ? "minuto" : "minutos"})` : "";
      const secText = seconds !== "" ? ` a ${seconds} ${Number(seconds) === 1 ? "segundo" : "segundos"}` : "";

      if (lower.includes("emotemodeon")) return "modo solo emotes activado";
      if (lower.includes("emotemodeoff")) return "modo solo emotes desactivado";
      if (lower.includes("followermodeon")) return `modo seguidores activado${minText}`;
      if (lower.includes("followermodechanged")) return followMin !== "" ? `modo seguidores cambiado a ${followMin} ${Number(followMin) === 1 ? "minuto" : "minutos"}` : "modo seguidores cambiado";
      if (lower.includes("followermodeoff")) return "modo seguidores desactivado";
      if (lower.includes("slowmodeon")) return seconds !== "" ? `modo lento activado (${seconds} ${Number(seconds) === 1 ? "segundo" : "segundos"})` : "modo lento activado";
      if (lower.includes("slowmodechanged")) return `modo lento cambiado${secText}`;
      if (lower.includes("slowmodeoff")) return "modo lento desactivado";
      if (lower.includes("subscribermodeon")) return "modo solo suscriptores activado";
      if (lower.includes("subscribermodeoff")) return "modo solo suscriptores desactivado";
      if (lower.includes("uniquemodeon")) return "modo único activado";
      if (lower.includes("uniquemodeoff")) return "modo único desactivado";
      if (lower.includes("shieldmodebegin")) return "modo escudo activado";
      if (lower.includes("shieldmodeend")) return "modo escudo desactivado";
      return "estado del chat cambiado";
    }

    const powerUpEchoCache = new Map();

    function powerUpEchoKey(item = {}) {
      const user = String(item.username || "").toLowerCase();
      const msg = String(item.message || "").replace(/\s+/g, " ").trim().toLowerCase();
      return `${user}|${msg}`;
    }

    function tokenPowerUpText(node) {
      if (!node) return "";
      const part = node.querySelector(".message-part");
      const text = String(part ? part.textContent : "").replace(/\s+/g, " ").trim().toLowerCase();
      if (text) return text;
      return Array.from(node.querySelectorAll("img.emote"))
        .map((img) => img.alt || img.title || "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    }

    function removeExistingPowerUpEcho(item = {}) {
      const platform = normalizePlatform(item.platform || item.source || "twitch");
      const user = normalizeChatterToken(item.username || "");
      const message = String(item.message || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (!platform || !user || !message) return;

      Array.from(track.querySelectorAll(".token.message"))
        .slice(-10)
        .forEach((node) => {
          if (node.dataset.platform !== platform || node.dataset.user !== user) return;
          if (tokenPowerUpText(node) === message) node.remove();
        });
    }

    function registerPowerUpEcho(item = {}) {
      const key = powerUpEchoKey(item);
      if (!key || key === "|") return;
      removeExistingPowerUpEcho(item);
      powerUpEchoCache.set(key, Date.now() + 4500);
      setTimeout(() => powerUpEchoCache.delete(key), 5000);
    }

    function isPowerUpEchoMessage(item = {}) {
      if (!item || item.kind !== "message") return false;
      const key = powerUpEchoKey(item);
      const expires = powerUpEchoCache.get(key);
      if (!expires) return false;
      if (Date.now() > expires) {
        powerUpEchoCache.delete(key);
        return false;
      }
      return true;
    }

    function shouldShow(item) {
      if (!item || item.platform === "general" || item.kind === "ignored") return false;

      const user = normalizeChatterToken(item.username || "");
      if (CONFIG.ignoreChatters.includes(user)) return false;

      if (CONFIG.excludeCommands && item.kind === "message" && String(item.message || "").trim().startsWith("!")) return false;
      if (isPowerUpEchoMessage(item)) return false;

      if (item.platform === "twitch") {
        if (item.kind === "message" && item.category === "chatMessages" && !CONFIG.twitchChatMessages) return false;
        if (item.category === "newFollowers" && !CONFIG.twitchNewFollowers) return false;
        if (item.category === "newSubscribers" && !CONFIG.twitchNewSubscribers) return false;
        if (item.category === "cheers" && !CONFIG.twitchCheers) return false;
        if (item.category === "raids" && !CONFIG.twitchRaids) return false;
        if (item.category === "channelPointRedemptions" && !CONFIG.twitchRewards) return false;
        if (item.category === "announcements" && !CONFIG.twitchAnnouncements) return false;
        if (item.category === "chatState" && !CONFIG.twitchChatState) return false;
        if (item.category === "watchStreaks" && !CONFIG.twitchWatchStreaks) return false;
      }

      if (item.platform === "youtube") {
        if (item.kind === "message" && item.category === "chatMessages" && !CONFIG.youtubeChatMessages) return false;
        if (item.category === "superChats" && !CONFIG.youtubeSuperChats) return false;
        if (item.category === "superStickers" && !CONFIG.youtubeSuperStickers) return false;
        if (item.category === "gifts" && !CONFIG.youtubeGifts) return false;
        if (item.category === "memberships" && !CONFIG.youtubeMemberships) return false;
      }

      if (item.platform === "kick") {
        if (!CONFIG.kickEnabled) return false;
        if (item.kind === "message" && item.category === "chatMessages" && !CONFIG.kickChatMessages) return false;
        if (item.category === "newFollowers" && !CONFIG.kickFollowers) return false;
        if (item.category === "newSubscribers" && !CONFIG.kickSubscribers) return false;
        if (item.category === "channelPointRedemptions" && !CONFIG.kickRewards) return false;
        if (item.category === "gifts" && !CONFIG.kickGifts) return false;
      }

      if (item.platform === "tiktok") {
        if (!CONFIG.tiktokEnabled) return false;
        if (item.kind === "message" && item.category === "chatMessages" && !CONFIG.tiktokChatMessages) return false;
        if (item.category === "gifts" && !CONFIG.tiktokGifts) return false;
        if (item.category === "likes" && !CONFIG.tiktokLikes) return false;
        if (item.category === "shares" && !CONFIG.tiktokShares) return false;
        if (item.category === "newFollowers" && !CONFIG.tiktokFollowers) return false;
        if (item.category === "newSubscribers" && !CONFIG.tiktokSubscribers) return false;
      }

      return true;
    }



    function cssEscapeValue(value) {
      const raw = String(value || "");
      if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(raw);
      return raw.replace(/["\\]/g, "\\$&");
    }

    function resolvePayloadMessageId(item = {}) {
      const raw = item.raw || {};
      const data = raw.data || {};
      const payload = raw.payload || {};
      const event = raw.event || {};
      const msg = (data.message && typeof data.message === "object") ? data.message : {};

      return String(first(
        item.messageId,
        item.msgId,
        item.id,
        item.targetMessageId,
        data.messageId,
        data.message_id,
        data.msgId,
        data.targetMessageId,
        data.target_message_id,
        data.deletedMessageId,
        data.deleted_message_id,
        msg.messageId,
        msg.message_id,
        msg.msgId,
        payload.messageId,
        payload.message_id,
        payload.msgId,
        raw.messageId,
        raw.message_id,
        raw.msgId,
        event.messageId,
        ""
      ) || "").trim();
    }

    function messageIdAttr(item = {}) {
      const id = resolvePayloadMessageId(item);
      return id ? ` data-message-id="${escapeHtml(id)}"` : "";
    }

    function resolvePayloadUserId(item = {}) {
      return String(first(
        item.userId,
        item.user_id,
        item.id,
        item.raw && item.raw.userId,
        item.raw && item.raw.user_id,
        item.raw && item.raw.data && item.raw.data.userId,
        item.raw && item.raw.data && item.raw.data.user_id,
        item.raw && item.raw.data && item.raw.data.user && item.raw.data.user.id,
        ""
      ) || "").trim();
    }

    function userIdAttr(item = {}) {
      const id = resolvePayloadUserId(item);
      return id ? ` data-user-id="${escapeHtml(id)}"` : "";
    }

    function normalizeModUser(value) {
      return normalizeChatterToken(value);
    }



    function removeTokenIfEmpty(token) {
      if (!token || !token.isConnected) return;
      const hasMessagePart = token.querySelector(".message-part");
      const hasMsgText = token.querySelector(".msg") && token.querySelector(".msg").textContent.trim();
      if (!hasMessagePart && !hasMsgText) token.remove();
    }

    function normalizeModerationPlatform(value = "") {
      const platform = String(value || "").trim().toLowerCase();
      if (platform === "twitch" || platform === "youtube" || platform === "kick") return platform;
      return "";
    }

    function tokenMatchesModerationPlatform(node, platform = "") {
      const scopedPlatform = normalizeModerationPlatform(platform);
      if (!scopedPlatform) return true;
      const token = node && node.closest ? node.closest(".token.message") : node;
      const nodePlatform = normalizeModerationPlatform(token && token.dataset && token.dataset.platform);
      return nodePlatform === scopedPlatform;
    }

    function deleteVerticalMessageById(messageId, platform = "") {
      const id = String(messageId || "").trim();
      if (!id) return false;

      const selector = `[data-message-id="${cssEscapeValue(id)}"]`;
      const parts = Array.from(track.querySelectorAll(`.message-part${selector}`))
        .filter(part => tokenMatchesModerationPlatform(part, platform));

      if (parts.length) {
        parts.forEach(part => {
          const token = part.closest(".token.message");
          const prev = part.previousElementSibling;
          const next = part.nextElementSibling;

          if (prev && prev.classList && prev.classList.contains("sep")) prev.remove();
          else if (next && next.classList && next.classList.contains("sep")) next.remove();

          part.remove();
          removeTokenIfEmpty(token);
        });
        return true;
      }

      const token = Array.from(track.querySelectorAll(`.token.message${selector}`))
        .find(item => tokenMatchesModerationPlatform(item, platform));
      if (token) {
        token.remove();
        return true;
      }

      return false;
    }

    function getTargetUserFromRaw(raw = {}) {
      const data = raw.data || {};
      const payload = raw.payload || {};
      const target = (
        (data.targetUser && typeof data.targetUser === "object" ? data.targetUser : null) ||
        (payload.targetUser && typeof payload.targetUser === "object" ? payload.targetUser : null) ||
        (raw.targetUser && typeof raw.targetUser === "object" ? raw.targetUser : null) ||
        (data.user && typeof data.user === "object" ? data.user : null) ||
        (payload.user && typeof payload.user === "object" ? payload.user : null) ||
        {}
      );

      return {
        id: String(first(
          target.id,
          target.userId,
          target.user_id,
          data.targetUserId,
          data.target_user_id,
          data.userId,
          data.user_id,
          payload.targetUserId,
          payload.target_user_id,
          payload.userId,
          payload.user_id,
          raw.targetUserId,
          raw.target_user_id,
          raw.userId,
          raw.user_id,
          ""
        ) || "").trim(),
        login: normalizeModUser(first(
          target.login,
          target.userName,
          target.username,
          data.targetUserName,
          data.target_user_name,
          data.userName,
          data.user_name,
          payload.targetUserName,
          payload.target_user_name,
          payload.userName,
          payload.user_name,
          raw.targetUserName,
          raw.target_user_name,
          raw.userName,
          raw.user_name,
          ""
        )),
        name: normalizeModUser(first(
          target.name,
          target.displayName,
          target.display_name,
          data.targetUserDisplayName,
          data.target_user_display_name,
          data.displayName,
          data.display_name,
          payload.targetUserDisplayName,
          payload.target_user_display_name,
          payload.displayName,
          payload.display_name,
          raw.targetUserDisplayName,
          raw.displayName,
          ""
        ))
      };
    }

    function deleteVerticalMessagesByUser(targetUser = {}, platform = "") {
      const id = String(targetUser.id || "").trim();
      const login = normalizeModUser(targetUser.login);
      const name = normalizeModUser(targetUser.name);
      const scopedPlatform = normalizeModerationPlatform(platform);
      if (!id && !login && !name) return 0;

      let removed = 0;
      Array.from(track.querySelectorAll(".token.message")).forEach(token => {
        const rowPlatform = normalizeModerationPlatform(token.dataset && token.dataset.platform);
        if (scopedPlatform && rowPlatform !== scopedPlatform) return;

        const rowUser = normalizeModUser(token.dataset && token.dataset.user);
        const rowUserId = String((token.dataset && token.dataset.userId) || "").trim();

        if (
          (id && rowUserId === id) ||
          (login && rowUser === login) ||
          (name && rowUser === name)
        ) {
          token.remove();
          removed += 1;
        }
      });

      return removed;
    }

    function getDeletedMessageIdFromRaw(raw = {}) {
      const data = raw.data || {};
      const payload = raw.payload || {};
      const message = (data.message && typeof data.message === "object") ? data.message : {};

      return first(
        data.messageId,
        data.message_id,
        data.msgId,
        data.targetMessageId,
        data.target_message_id,
        data.deletedMessageId,
        data.deleted_message_id,
        message.messageId,
        message.message_id,
        message.msgId,
        payload.messageId,
        payload.message_id,
        payload.msgId,
        payload.targetMessageId,
        payload.target_message_id,
        raw.messageId,
        raw.message_id,
        raw.msgId,
        ""
      );
    }

    function getPayloadEventInfo(raw = {}) {
      const rootEvent = raw.event && typeof raw.event === "object" ? raw.event : {};
      const rootData = raw.data && typeof raw.data === "object" ? raw.data : {};
      const nestedEvent = rootData.event && typeof rootData.event === "object" ? rootData.event : {};
      const nestedSource = String(nestedEvent.source || "").toLowerCase();
      const unwrapNested =
        String(rootEvent.source || "").toLowerCase() === "general" &&
        String(rootEvent.type || "").toLowerCase() === "custom" &&
        nestedEvent.type &&
        (nestedSource === "kick" || nestedSource === "twitch" || nestedSource === "youtube");

      const type = String(first(
        unwrapNested ? nestedEvent.type : "",
        raw.event && raw.event.type,
        raw.type,
        raw.data && raw.data.type,
        ""
      ) || "").toLowerCase();

      const source = normalizeModerationPlatform(first(
        unwrapNested ? nestedEvent.source : "",
        raw.event && raw.event.source,
        raw.source,
        raw.data && raw.data.source,
        ""
      ));

      return { type, source };
    }

    function getPayloadType(raw = {}) {
      return getPayloadEventInfo(raw).type;
    }



    function clearVerticalMessagesByPlatform(platform = "") {
      const scopedPlatform = normalizeModerationPlatform(platform);

      if (!scopedPlatform) {
        track.innerHTML = "";
        return true;
      }

      const targets = Array.from(track.querySelectorAll(".token.message"))
        .filter(token => normalizeModerationPlatform(token.dataset && token.dataset.platform) === scopedPlatform);
      targets.forEach(token => token.remove());
      return targets.length > 0;
    }

    function handleVerticalModerationPayload(raw = {}) {
      const payloadInfo = getPayloadEventInfo(raw);
      const lower = payloadInfo.type;
      const platform = payloadInfo.source;

      const isDeleted = (
        lower.includes("chatmessagedeleted") ||
        lower.includes("sharedchatmessagedeleted") ||
        lower.includes("messagedeleted") ||
        lower.includes("message_deleted") ||
        lower.includes("delete_message")
      );

      const isCleared = (
        lower === "chatcleared" ||
        lower.includes("chat_cleared") ||
        lower.includes("clearchat") ||
        lower.includes("clear_chat")
      );

      const isUserBanOrTimeout = (
        lower.includes("userbanned") ||
        lower.includes("user_banned") ||
        lower.includes("usertimedout") ||
        lower.includes("user_timed_out") ||
        lower.includes("timeout")
      );

      if (isDeleted) {
        const messageId = getDeletedMessageIdFromRaw(raw);
        const removed = deleteVerticalMessageById(messageId, platform);
        if (CONFIG.debugPayload) console.log("[Hipe Multichat Vertical] mensaje borrado", { platform, messageId, removed });
        return true;
      }

      if (isCleared) {
        const removed = clearVerticalMessagesByPlatform(platform);
        if (CONFIG.debugPayload) console.log("[Hipe Multichat Vertical] chat limpiado", { platform: platform || "all", removed });
        return true;
      }

      if (isUserBanOrTimeout) {
        const targetUser = getTargetUserFromRaw(raw);
        const removed = deleteVerticalMessagesByUser(targetUser, platform);
        if (CONFIG.debugPayload) console.log("[Hipe Multichat Vertical] purge usuario oculto", { platform, targetUser, removed });
        return true;
      }

      return false;
    }

    function shouldHighlightMention(message) {
      if (!CONFIG.highlightMentions) return false;

      const text = String(message || "")
        .toLowerCase()
        .replace(/https?:\/\/\S+/gi, " ")
        .replace(/\bwww\.\S+/gi, " ");

      return CONFIG.streamerNames.some((name) => {
        const clean = String(name || "").trim().toLowerCase();
        return clean && text.includes(clean);
      });
    }

    function canGroupWithLastMessage(item) {
      if (!CONFIG.groupConsecutiveMessages || item.kind !== "message") return null;
      const last = track.lastElementChild;
      if (!last || last.dataset.kind !== "message") return null;
      const lastUser = String(last.dataset.user || "").toLowerCase();
      const currentUser = String(item.username || "").toLowerCase();
      const lastPlatform = String(last.dataset.platform || "").toLowerCase();
      const currentPlatform = String(item.platform || "").toLowerCase();
      if (!lastUser || lastUser !== currentUser || lastPlatform !== currentPlatform) return null;
      return last;
    }

    function appendGroupedMessage(last, item) {
      const msg = last.querySelector(".msg");
      if (!msg) return false;

      const html = renderMessageText(compact(item.message, 180), item.emotes || []);
      const id = resolvePayloadMessageId(item);

      const sep = document.createElement("span");
      sep.className = "sep";
      sep.textContent = " · ";
      if (id) sep.setAttribute("data-message-id", id);

      const part = document.createElement("span");
      part.className = "message-part grouped-message-part";
      if (id) part.setAttribute("data-message-id", id);
      part.innerHTML = html;

      msg.appendChild(sep);
      msg.appendChild(part);
      return true;
    }

    function readableNameColor(value, fallback = "#c084fc") {
      const raw = String(value || "").trim();
      const color = raw || fallback;

      let r = null, g = null, b = null;

      const hex = color.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
      if (hex) {
        let v = hex[1];
        if (v.length === 3) v = v.split("").map((ch) => ch + ch).join("");
        r = parseInt(v.slice(0, 2), 16);
        g = parseInt(v.slice(2, 4), 16);
        b = parseInt(v.slice(4, 6), 16);
      } else {
        const rgb = color.match(/^rgba?\(\s*([0-9.]+)%?\s*,\s*([0-9.]+)%?\s*,\s*([0-9.]+)%?/i);
        if (rgb) {
          const usesPercent = color.includes("%");
          r = Number(rgb[1]);
          g = Number(rgb[2]);
          b = Number(rgb[3]);
          if (usesPercent) {
            r = Math.round(r * 2.55);
            g = Math.round(g * 2.55);
            b = Math.round(b * 2.55);
          }
        }
      }

      if (![r, g, b].every((channel) => Number.isFinite(channel))) return color;

      const luminance = (0.2126 * r) + (0.7152 * g) + (0.0722 * b);

      // Regla estricta: solo corregir negro o casi negro.
      if (luminance <= 28 && r <= 45 && g <= 45 && b <= 45) {
        return "#6b7280";
      }

      return color;
    }

    function stableStringHash(value) {
      const text = String(value || "");
      let hash = 0;
      for (let i = 0; i < text.length; i += 1) {
        hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
      }
      return Math.abs(hash);
    }

    function getYouTubeUserColor(item = {}) {
      const realColor = readableNameColor(first(
        item.nameColor,
        item.userColor,
        item.color,
        item.raw && item.raw.nameColor,
        item.raw && item.raw.userColor,
        item.raw && item.raw.color,
        item.raw && item.raw.data && item.raw.data.nameColor,
        item.raw && item.raw.data && item.raw.data.userColor,
        item.raw && item.raw.data && item.raw.data.color,
        item.raw && item.raw.data && item.raw.data.user && item.raw.data.user.color
      ), "");
      if (realColor) return realColor;

      const key = first(
        item.userId,
        item.raw && item.raw.data && item.raw.data.user && item.raw.data.user.id,
        item.raw && item.raw.user && item.raw.user.id,
        item.authorChannelId,
        item.raw && item.raw.data && item.raw.data.authorChannelId,
        item.channelId,
        item.raw && item.raw.data && item.raw.data.user && item.raw.data.user.channelId,
        item.username
      );

      const cleanKey = String(key || "").trim();
      if (!cleanKey) return "";

      const assignedColor = youtubeColorByUserKey.get(cleanKey);
      if (assignedColor) return assignedColor;

      const preferredIndex = stableStringHash(cleanKey) % YOUTUBE_NAME_COLORS.length;
      for (let offset = 0; offset < YOUTUBE_NAME_COLORS.length; offset += 1) {
        const color = YOUTUBE_NAME_COLORS[(preferredIndex + offset) % YOUTUBE_NAME_COLORS.length];
        const ownerKey = youtubeUserKeyByColor.get(color);
        if (!ownerKey || ownerKey === cleanKey) {
          youtubeColorByUserKey.set(cleanKey, color);
          youtubeUserKeyByColor.set(color, cleanKey);
          return color;
        }
      }

      return YOUTUBE_NAME_COLORS[preferredIndex];
    }

    function resolveReplyInfo(item = {}) {
      const candidates = [
        item.reply,
        item.replyInfo,
        item.replyParent,
        item.replyMessage,
        item.parentMessage,
        item.repliedTo,
        item._message && item._message.reply,
        item._message && item._message.replyInfo,
        item._message && item._message.replyParent,
        item._message && item._message.parentMessage,
        item._data && item._data.reply,
        item._data && item._data.replyInfo,
        item._data && item._data.replyParent
      ].filter((candidate) => candidate && typeof candidate === "object" && hasReplyValue(candidate));

      const source = candidates[0] || {};
      const sourceUser = first(
        source.sender,
        source.user,
        source.author,
        source.chatter,
        source.fromUser,
        source.replyUser,
        source.replyToUser,
        source.originalUser,
        {}
      );

      const rawUser = first(
        sourceUser.displayName,
        sourceUser.name,
        sourceUser.login,
        sourceUser.username,
        source.displayName,
        source.username,
        source.userName,
        source.userLogin,
        source.user,
        source.name,
        item.replyUser,
        item.replyUsername,
        item.replyUserName,
        item.replyParentUser,
        item.replyParentUsername,
        item.replyParentDisplayName,
        item.replyTo,
        item.replyToUser,
        item.replyToUsername,
        item.replyToDisplayName,
        item._message && item._message.replyUser,
        item._message && item._message.replyUsername,
        item._message && item._message.replyParentUsername,
        item._message && item._message.replyParentDisplayName
      );

      const text = first(
        source.msgBody,
        source.message,
        source.text,
        source.body,
        source.content,
        source.displayText,
        source.messageText,
        source.originalMessage,
        item.replyMessageText,
        item.replyText,
        item.replyParentMessage,
        item.replyParentText,
        item.replyToMessage,
        item._message && item._message.replyMessageText,
        item._message && item._message.replyText,
        item._message && item._message.replyParentMessage,
        item._message && item._message.replyParentText
      );

      const hasReply = Boolean(
        isExplicitTrue(item.isReply) ||
        isExplicitTrue(item._message && item._message.isReply) ||
        isExplicitTrue(item._data && item._data.isReply) ||
        candidates.length > 0 ||
        hasReplyValue(item.replyUser) ||
        hasReplyValue(item.replyUsername) ||
        hasReplyValue(item.replyParentUsername) ||
        hasReplyValue(item.replyToUsername) ||
        hasReplyValue(item.replyMessageText) ||
        hasReplyValue(item.replyText) ||
        hasReplyValue(item.replyParentMessage) ||
        hasReplyValue(item.replyParentText) ||
        hasReplyValue(item.replyToMessage)
      );

      return {
        isReply: hasReply,
        user: String(rawUser || "").trim().replace(/^@+/, ""),
        text: String(text || "").trim()
      };
    }

    function tokenMessage(item) {
      const emoteHtml = renderMessageText(compact(item.message, 180), item.emotes || []);
      const msgIdAttr = messageIdAttr(item);
      const uidAttr = userIdAttr(item);
      const replyInfo = resolveReplyInfo(item);
      const replyHtml = replyInfo.isReply ? `
            <span class="reply-preview-inline">
              ↪ <span>A</span>
              ${replyInfo.user ? `<span class="reply-user">@${escapeHtml(compact(replyInfo.user, 24))}</span>` : `<span class="reply-user">mensaje anterior</span>`}
              ${replyInfo.text ? `<span class="reply-text">: ${escapeHtml(compact(replyInfo.text, 54))}</span>` : ""}
            </span>
      ` : "";

      const mentionClass = shouldHighlightMention(item.message) ? " highlight-mention" : "";

      return `
        <span class="token message ${escapeHtml(item.platform)}${mentionClass}" data-kind="message" data-platform="${escapeHtml(item.platform)}" data-user="${escapeHtml(normalizeChatterToken(item.username || ""))}"${uidAttr}${msgIdAttr} style="--name:${escapeHtml(readableNameColor(item.nameColor, "#c084fc"))}">
          ${avatarHtml(item)}
          ${CONFIG.showTimestamp ? `<span class="time">${escapeHtml(item.time)}</span>` : ""}
          ${CONFIG.showPlatform ? `<span class="platform ${item.platform === "youtube" ? "youtube" : (item.platform === "kick" ? "kick" : (item.platform === "tiktok" ? "tiktok" : (item.platform === "twitch" ? "twitch" : "")))}">${icon(item.platform)}</span>` : ""}
          ${badgesHtml(item)}
          ${CONFIG.showUsername ? `<span class="user">${escapeHtml(compact(item.username, 32))}</span>` : ""}
          <span class="action">:</span>
          ${replyHtml}
          <span class="msg"><span class="message-part"${msgIdAttr}>${emoteHtml}</span></span>
        </span>
      `;
    }

    function badgesHtml(item) {
      if (!CONFIG.showBadges || !Array.isArray(item.badges) || !item.badges.length) return "";
      const html = item.badges.slice(0, 5).map(b => {
        const url = safeUrl(b.imageUrl);
        return url ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(b.name)}" title="${escapeHtml(b.name)}" loading="lazy" referrerpolicy="no-referrer">` : "";
      }).join("");
      return html ? `<span class="badges">${html}</span>` : "";
    }

    function tokenEvent(item) {
      const p = eventPhrase(item);
      const avatarItem = p.system ? { ...item, username: "", avatar: "", systemAvatar: item.systemAvatar || "twitch" } : item;

      return `
        <span class="token event ${escapeHtml(item.category)} ${escapeHtml(item.platform)}" style="--name:${escapeHtml(readableNameColor(item.nameColor, "#c084fc"))}">
          ${avatarHtml(avatarItem, p.system)}
          ${CONFIG.showTimestamp ? `<span class="time">${escapeHtml(item.time)}</span>` : ""}
          ${CONFIG.showPlatform ? `<span class="platform ${item.platform === "youtube" ? "youtube" : (item.platform === "kick" ? "kick" : (item.platform === "tiktok" ? "tiktok" : (item.platform === "twitch" ? "twitch" : "")))}">${icon(item.platform)}</span>` : ""}
          <span class="user">${escapeHtml(p.user)}</span>
          ${p.action ? `<span class="action">${escapeHtml(p.action)}</span>` : ""}
          ${p.accent ? `<span class="accent">${escapeHtml(p.accent)}</span>` : ""}
          ${p.postAction ? `<span class="action">${escapeHtml(p.postAction)}</span>` : ""}
          ${p.postAccent ? `<span class="accent">${escapeHtml(p.postAccent)}</span>` : ""}
          ${p.muted ? `<span class="sep">·</span><span class="muted">${escapeHtml(p.muted)}</span>` : ""}
        </span>
      `;
    }

    function eventPhrase(item) {
      const c = item.category;
      const t = item.eventType;
      const user = compact(item.username || "Usuario", 34);
      const amount = String(item.amount ?? "").trim();
      const msg = compact(item.message || "", 100);

      if (c === "chatState") return { system: true, user: "Moderación", action: "de Chat:", accent: amount, muted: "" };
      if (c === "hypeTrain") return { system: true, user: "🚂 Tren del Hype", action: t, accent: amount, muted: msg };
      if (c === "newFollowers") return { system: false, user, action: "siguió el canal", accent: "", muted: "" };
      if (c === "cheers") return { system: false, user, action: "envió", accent: amount ? `${amount} bits` : "bits", muted: msg };
      if (c === "raids") return { system: false, user, action: "llegó con", accent: amount ? `${amount} viewers` : "raid", muted: "" };
      if (c === "channelPointRedemptions") {
        const rewardTitle = compact(first(item.rewardTitle, item.rewardName, item.reward, amount, "Recompensa"), 44);
        return {
          system: false,
          user,
          action: "canjeó:",
          accent: rewardTitle,
          muted: ""
        };
      }
      if (c === "automaticRewards") {
        return {
          system: false,
          user,
          action: "activó:",
          accent: compact(first(amount, "efecto de mensaje"), 44),
          muted: msg
        };
      }
      if (c === "watchStreaks") {
        const streakAmount = String(first(
          amount,
          item.streak_count,
          item.streakCount,
          item.watchStreakCount,
          item.watchStreak,
          item.streak,
          item.count,
          item.raw && item.raw.data && item.raw.data.streak_count,
          item.raw && item.raw.data && item.raw.data.streakCount,
          item.raw && item.raw.data && item.raw.data.watchStreakCount,
          item.raw && item.raw.data && item.raw.data.watchStreak,
          item.raw && item.raw.data && item.raw.data.streak,
          item.raw && item.raw.data && item.raw.data.count,
          ""
        ) || "").trim();
        return { system: false, user, action: "lleva", accent: streakAmount ? `${streakAmount} streams seguidos` : "racha activa", muted: msg };
      }
      if (c === "powerUps") return { system: false, user: "PowerUp", action: "emote gigante de", accent: user, muted: msg };
      if (t === "GiftSub") return { system: false, user, action: "regaló una sub a", accent: amount, muted: msg };
      if (t === "GiftBomb") return { system: false, user, action: "regaló", accent: amount ? `${amount} subs` : "subs", muted: msg };
      if (t === "ReSub") return { system: false, user, action: amount ? "lleva" : "renovó su suscripción", accent: amount ? `${amount} meses suscrito` : "", muted: msg };
      if (c === "newSubscribers") return { system: false, user, action: t || "se suscribió", accent: amount, muted: msg };
      if (c === "announcements") return { system: false, user: "Anuncio", action: "de", accent: user, muted: msg };
      if (c === "superChats") return { system: false, user, action: t, accent: amount, muted: msg };
      if (c === "gifts") {
        if (item.platform === "tiktok") return { system: false, user, action: "envió", accent: amount || "regalo", muted: msg };
        if (t === "JewelsGifted") return { system: false, user, action: "envió", accent: amount || "regalo", muted: msg };
        if (t === "sGifted") return { system: false, user, action: "envió", accent: amount ? `${amount} Kicks` : "Kicks", muted: msg };
        return { system: false, user, action: "envió", accent: amount || "regalo", muted: msg };
      }
      if (c === "likes") return { system: false, user, action: "tocó", accent: amount ? `${amount} likes` : "like", muted: msg };
      if (c === "shares") return { system: false, user, action: "compartió", accent: "el live", muted: msg };

      if (c === "memberships") {
        if (t === "cumplió") {
          return { system: false, user, action: "cumplió", accent: amount ? `${amount} meses de miembro` : "membresía", muted: msg };
        }
        if (t === "regaló") {
          return { system: false, user, action: "regaló", accent: amount ? `${amount} membresías` : "membresías", muted: msg };
        }
        return { system: false, user, action: t, accent: amount, muted: msg };
      }
      return { system: false, user, action: t || "evento", accent: amount, muted: msg };
    }

    const specialEventQueue = [];
    let specialEventPlaying = false;

    function specialEventHtml(item) {
      const p = eventPhrase(item);
      const avatarItem = p.system ? { ...item, username: "", avatar: "", systemAvatar: item.systemAvatar || "twitch" } : item;

      return `
        <div class="specialEventCard ${escapeHtml(item.category)} ${escapeHtml(item.platform)}" style="--name:${escapeHtml(readableNameColor(item.nameColor, "#c084fc"))}">
          ${avatarHtml(avatarItem, p.system)}
          ${CONFIG.showPlatform ? `<span class="platform ${item.platform === "youtube" ? "youtube" : (item.platform === "kick" ? "kick" : (item.platform === "tiktok" ? "tiktok" : (item.platform === "twitch" ? "twitch" : "")))}">${icon(item.platform)}</span>` : ""}
          <span class="user">${escapeHtml(p.user)}</span>
          ${p.action ? `<span class="action">${escapeHtml(p.action)}</span>` : ""}
          ${p.accent ? `<span class="accent">${escapeHtml(p.accent)}</span>` : ""}
          ${p.postAction ? `<span class="action">${escapeHtml(p.postAction)}</span>` : ""}
          ${p.postAccent ? `<span class="accent">${escapeHtml(p.postAccent)}</span>` : ""}
          ${p.muted ? `<span class="sep">·</span><span class="muted">${escapeHtml(p.muted)}</span>` : ""}
        </div>
      `;
    }

    function playNextSpecialEvent() {
      if (specialEventPlaying) return;
      const item = specialEventQueue.shift();
      if (!item) return;

      specialEventPlaying = true;
      eventOverlay.classList.remove("active");
      eventOverlay.innerHTML = specialEventHtml(item);

      // reinicia animación limpiamente
      void eventOverlay.offsetWidth;
      eventOverlay.classList.add("active");

      setTimeout(() => {
        eventOverlay.classList.remove("active");
        eventOverlay.innerHTML = "";
        specialEventPlaying = false;
        playNextSpecialEvent();
      }, 5200);
    }

    function enqueueSpecialEvent(item) {
      specialEventQueue.push(item);
      playNextSpecialEvent();
    }

    async function addItem(item) {
      if (!shouldShow(item)) return;

      if (item.kind === "event") {
        enqueueSpecialEvent(item);
        return;
      }

      const lastGroup = item.kind === "message" ? canGroupWithLastMessage(item) : null;
      if (lastGroup && appendGroupedMessage(lastGroup, item)) {
        return;
      }

      const html = item.kind === "event" ? tokenEvent(item) : tokenMessage(item);
      const wrap = document.createElement("div");
      wrap.innerHTML = html.trim();
      const node = wrap.firstElementChild;
      if (!node) return;

      track.appendChild(node);

      while (track.children.length > CONFIG.maxItems) {
        track.firstElementChild?.remove();
      }

      // Mensajes normales NO se borran solos. Solo si hideAfter se configura explícitamente.
      if (CONFIG.hideAfter > 0) {
        setTimeout(() => {
          if (!node.isConnected) return;
          node.remove();
        }, CONFIG.hideAfter);
      }
    }

    function isClearChatPayload(payload = {}) {
      const type = String((payload.event && payload.event.type) || payload.type || (payload.data && payload.data.type) || "").toLowerCase();
      return type === "chatcleared";
    }

    async function handleStreamerBotMessage(payload) {
      if (handleVerticalModerationPayload(payload)) {
        return;
      }

      const item = normalizePayload(payload);
      if (CONFIG.debugPayload) {
        console.log("[Hipe Multichat Vertical] mapped", item);
        console.table({
          platform: item.platform,
          category: item.category,
          kind: item.kind,
          username: item.username,
          message: item.message,
          eventType: item.eventType,
          amount: item.amount
        });
      }
      await addItem(item);
    }

    const tiktokLikeCache = new Map();
    const TIKTOK_LIKE_CARD_STEP = 1000;

    function shouldShowTikTokLike(data = {}) {
      const user = String(first(data.uniqueId, data.userId, data.nickname, "anon") || "anon").toLowerCase();
      const likeCount = Number(data.likeCount) || 0;
      if (!user || likeCount <= 0) return false;

      const previous = tiktokLikeCache.get(user) || 0;
      const total = previous + likeCount;
      tiktokLikeCache.set(user, total);

      const previousBucket = Math.floor(previous / TIKTOK_LIKE_CARD_STEP);
      const nextBucket = Math.floor(total / TIKTOK_LIKE_CARD_STEP);
      if (nextBucket <= previousBucket) return false;

      data.__hipeLikeMilestone = nextBucket * TIKTOK_LIKE_CARD_STEP;
      return true;
    }

    function normalizeTikTokComment(value = "") {
      return String(value || "").replace(/\[[a-z0-9_]{2,40}\]/gi, "").replace(/\s{2,}/g, " ").trim();
    }

    function normalizeTikFinityEmotes(data = {}) {
      const rawList = [];
      if (Array.isArray(data.emotes)) rawList.push(...data.emotes);
      if (Array.isArray(data.emoteList)) rawList.push(...data.emoteList);
      if (data.emote && typeof data.emote === "object") rawList.push(data.emote);
      if (data.emoteId || data.emoteImageUrl || data.emoteImageURL) rawList.push(data);

      return rawList.map((emote) => {
        const rawName = String(first(emote.name, emote.emoteName, emote.emoteId, emote.id, data.emoteName, data.emoteId, "emote")).trim();
        const token = rawName.startsWith("[") ? rawName : `[${rawName}]`;
        const imageUrl = first(
          emote.imageUrl,
          emote.emoteImageUrl,
          emote.emoteImageURL,
          emote.url,
          emote.image && emote.image.url,
          data.emoteImageUrl,
          data.emoteImageURL,
          data.imageUrl,
          ""
        );

        return imageUrl ? { name: token, imageUrl, url: imageUrl, provider: "tiktok" } : null;
      }).filter(Boolean);
    }

    function mapTikFinityPayload(raw = {}) {
      const event = String(raw.event || raw.type || "").trim();
      const lower = event.toLowerCase();
      const data = raw.data && typeof raw.data === "object" ? raw.data : raw;

      if (!lower || lower === "config" || lower === "roomuser" || lower === "member" || lower === "livestatuschange") {
        return { kind: "ignored", category: "ignored", platform: "tiktok" };
      }

      const base = {
        raw,
        source: "tiktok",
        platform: "tiktok",
        type: event,
        kind: "event",
        category: "event",
        eventType: event,
        username: first(data.nickname, data.uniqueId, data.username, data.userId, "Usuario TikTok"),
        userId: first(data.userId, data.secUid, data.uniqueId, ""),
        avatar: first(data.profilePictureUrl, data.avatarUrl, data.avatar, ""),
        nameColor: "#25f4ee",
        badges: [],
        emotes: normalizeTikFinityEmotes(data),
        message: "",
        time: timeNow(first(data.createTime, data.timestamp, raw.timestamp, "")),
        amount: "",
        systemAvatar: ""
      };

      if (lower === "chat") {
        const emotes = normalizeTikFinityEmotes(data);
        const rawMessage = first(data.comment, data.message, data.text, "");
        const message = emotes.length ? String(rawMessage || "") : normalizeTikTokComment(rawMessage);
        if (!message) return { kind: "ignored", category: "ignored", platform: "tiktok" };

        return {
          ...base,
          kind: "message",
          category: "chatMessages",
          eventType: "",
          message,
          emotes
        };
      }

      if (lower === "emote") {
        const emotes = normalizeTikFinityEmotes(data);
        if (!emotes.length) return { kind: "ignored", category: "ignored", platform: "tiktok" };
        return {
          ...base,
          kind: "message",
          category: "chatMessages",
          eventType: "",
          message: emotes.map((emote) => emote.name).join(" "),
          emotes
        };
      }

      if (lower === "gift") {
        const groupId = String(first(data.groupId, "") || "");
        if (groupId && groupId !== "0" && data.repeatEnd === false) {
          return { kind: "ignored", category: "ignored", platform: "tiktok" };
        }

        const giftName = first(data.giftName, data.originalName, data.gift && data.gift.name, "regalo");
        const repeatCount = first(data.repeatCount, data.count, "");
        const diamonds = first(data.diamondCount, data.coins, "");

        return {
          ...base,
          kind: "event",
          category: "gifts",
          eventType: "Gift",
          amount: repeatCount ? `${repeatCount}x ${giftName}` : giftName,
          message: diamonds ? `${diamonds} diamonds` : compact(first(data.describe, data.label, ""), 80),
          giftName,
          giftCount: repeatCount
        };
      }

      if (lower === "like") {
        if (!shouldShowTikTokLike(data)) return { kind: "ignored", category: "ignored", platform: "tiktok" };
        return {
          ...base,
          kind: "event",
          category: "likes",
          eventType: "Like",
          amount: first(data.likeCount, "1"),
          message: `${data.__hipeLikeMilestone || TIKTOK_LIKE_CARD_STEP} likes totales`
        };
      }

      if (lower === "share") {
        return { ...base, kind: "event", category: "shares", eventType: "Share", amount: "live", message: "" };
      }

      if (lower === "follow") {
        return { ...base, kind: "event", category: "newFollowers", eventType: "Follow", message: "" };
      }

      if (lower === "subscribe") {
        return { ...base, kind: "event", category: "newSubscribers", eventType: "Subscribe", amount: first(data.subMonth, data.months, ""), message: "" };
      }

      return { kind: "ignored", category: "ignored", platform: "tiktok" };
    }

    async function handleTikFinityMessage(rawMessage) {
      let parsed = rawMessage;
      try {
        if (typeof rawMessage === "string") parsed = JSON.parse(rawMessage);
      } catch {
        return;
      }

      const item = mapTikFinityPayload(parsed);
      if (CONFIG.debugPayload) console.log("[Hipe Multichat Vertical TikFinity] mapped", item);
      await addItem(item);
    }

    let ws = null;
    let tikfinityWs = null;
    let statusHideTimer = null;
    function setStatus(ok, text) {
      clearTimeout(statusHideTimer);
      wsStatus.classList.remove("is-hidden");
      wsStatus.classList.toggle("ok", Boolean(ok));
      wsText.textContent = ok ? "Conectado" : "Conectando...";

      if (ok) {
        statusHideTimer = setTimeout(() => {
          wsStatus.classList.add("is-hidden");
        }, 1400);
      }
    }

    function connectStreamerBot() {
      if (!CONFIG.connect) return;
      const url = `ws://${CONFIG.sbHost}:${CONFIG.sbPort}/`;
      setStatus(false, "Conectando...");
      try {
        ws = new WebSocket(url);
      } catch (err) {
        setStatus(false, "WS ERROR");
        console.error("[Hipe Multichat WS] error", err);
        return;
      }

      ws.addEventListener("open", () => {
        setStatus(true, "WS OK");
        const request = {
          request: "Subscribe",
          id: "hipe-multichat-vertical-subscribe",
          events: {
            Twitch: [
              "ChatMessage", "Cheer", "Follow", "Sub", "ReSub", "GiftSub", "GiftBomb", "Raid",
              "Announcement", "RewardRedemption", "AutomaticRewardRedemption", "CustomPowerUpRedemption",
              "PowerUpRedemption", "PowerUp", "WatchStreak", "WatchStreaks", "ChatMessageDeleted", "ChatCleared",
              "SharedChatMessageDeleted", "UserBanned", "UserTimedOut", "SharedChatUserBanned",
              "SharedChatUserTimedout", "ChatEmoteModeOn", "ChatEmoteModeOff", "ChatFollowerModeOn",
              "ChatFollowerModeOff", "ChatFollowerModeChanged", "ChatSlowModeOn", "ChatSlowModeOff",
              "ChatSlowModeChanged", "ChatSubscriberModeOn", "ChatSubscriberModeOff", "ChatUniqueModeOn",
              "ChatUniqueModeOff", "ShieldModeBegin", "ShieldModeEnd", "HypeTrainStart", "HypeTrainUpdate",
              "HypeTrainLevelUp", "HypeTrainEnd"
            ],
            YouTube: [
              "Message", "MessageDeleted", "UserBanned", "UserTimedout", "SuperChat", "SuperSticker",
              "JewelsGifted", "NewSponsor", "NewSubscriber", "MemberMilestone", "MembershipGift", "GiftMembershipReceived"
            ],
            Kick: [
              "ChatMessage", "Follow", "Subscription", "Resubscription", "GiftSubscription", "MassGiftSubscription",
              "RewardRedemption", "sGifted", "KicksGifted", "UserTimedOut", "UserBanned", "ViewerCountUpdate"
            ],
            General: ["Custom"]
          }
        };
        ws.send(JSON.stringify(request));
        if (CONFIG.debugWS) console.log("[Hipe Multichat WS] sent", request);
      });

      ws.addEventListener("message", (event) => {
        let payload;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }
        if (CONFIG.debugWS) console.log("[Hipe Multichat WS] received", payload);

        if (payload.request === "Hello" || payload.status === "ok" || payload.id === "hipe-multichat-vertical-subscribe") return;
        if (!payload.event && !payload.data && !payload.source) return;

        handleStreamerBotMessage(payload);
      });

      ws.addEventListener("close", () => {
        setStatus(false, "WS OFF");
        setTimeout(connectStreamerBot, 3000);
      });

      ws.addEventListener("error", () => {
        setStatus(false, "WS ERROR");
      });
    }

    function connectTikFinity() {
      if (!CONFIG.tiktokEnabled) return;
      const url = CONFIG.tikfinityUrl || "ws://localhost:21213/";

      try {
        tikfinityWs = new WebSocket(url);
      } catch (err) {
        console.error("[Hipe Multichat TikFinity] error", err);
        setTimeout(connectTikFinity, 3000);
        return;
      }

      tikfinityWs.addEventListener("open", () => {
        if (CONFIG.debugWS) console.log("[Hipe Multichat TikFinity] connected", url);
      });

      tikfinityWs.addEventListener("message", (event) => handleTikFinityMessage(event.data));

      tikfinityWs.addEventListener("close", () => {
        if (CONFIG.debugWS) console.log("[Hipe Multichat TikFinity] closed");
        setTimeout(connectTikFinity, 3000);
      });

      tikfinityWs.addEventListener("error", (err) => {
        if (CONFIG.debugWS) console.log("[Hipe Multichat TikFinity] error", err);
      });
    }

    window.HipeMultichat = {
      handleStreamerBotMessage,
      handleTikFinityMessage,
      emit: handleStreamerBotMessage,
      emitTikTok: handleTikFinityMessage,
      clear() { track.innerHTML = ""; },
      mapTikFinityPayload,
      config: CONFIG
    };

    connectStreamerBot();
    connectTikFinity();
  })();
