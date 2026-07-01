
    /* --- Ajuste v86: fallback seguro para Twemoji roto tipo /72x72/.png --- */
    function replaceBrokenTwemojiImage(img) {
      if (!img || !(img instanceof HTMLImageElement)) return;
      if (!img.classList || !img.classList.contains("emote-img")) return;

      const src = String(img.currentSrc || img.src || "");
      const alt = String(img.alt || "");

      if (!alt) return;

      // Caso confirmado: ✨ generaba assets/72x72/.png, imagen rota.
      // Solo convertimos ese caso a texto unicode; no tocamos emotes Twitch/YouTube válidos.
      if (src.includes("/72x72/.png")) {
        img.replaceWith(document.createTextNode(alt));
      }
    }

    document.addEventListener("error", (event) => {
      replaceBrokenTwemojiImage(event.target);
    }, true);


    const CONFIG = {
      maxMessages: 80,
      chatWidth: 0,
      chatPosition: "left",
      chatOffsetX: 0,
      chatOffsetY: 0,
      chatHeight: "100vh",
      canvasColor: "#303334",
      canvasOpacity: 0.86,
      removeFallback: true,
      longMessageThreshold: 34,
      showPlatform: true,
      showAvatar: true,
      showTimestamp: true,
      showBadges: true,
      showPronouns: false,
      showUsername: true,
      customEmotes: true,
      enlargeEmotes: false,
      gigantifyEmotes: true,
      emoteSize: 28,
      emoteLargeSize: 220,
      emoteOnlyMaxTextLength: 120,

      font: "Rajdhani",
      fontSize: 26,
      lineSpacing: 1.08,
      messageSpacing: 17,
      chatBubbles: false,
      hideAfter: 0,
      excludeCommands: true,
      commandPrefix: "!",
      /* --- Ajuste v113: defaults finales aprobados para overlay/Admin --- */
      ignoreChatters: ["streamelements", "nightbot", "streamlabs"],
      scrollDirection: "normal",
      scrollMode: "hidden",
      groupConsecutiveMessages: false,
      /* --- Ajuste v127: base limpia desde v121; inline activado por default --- */
      inlineChat: true,
      highlightMentions: true,
      streamerNames: ["jsmoctezuma"],
      embedImages: "vip",
      showYouTubeLinkPreviews: true,
      defaultAvatarUrl: "",
      avatarMap: {},

      websocket: {
        enabled: false,
        host: "127.0.0.1",
        port: 8080,
        url: "",
        reconnect: true,
        reconnectDelay: 3000,
        debug: false,
        debugPayload: false,
        subscribe: true
      },

      tiktok: {
        enabled: false,
        url: "ws://localhost:21213/",
        reconnect: true,
        reconnectDelay: 3000
      },

      filters: {
        twitch: {
          chatMessages: true,
          cheers: true,
          announcements: true,
          newFollowers: true,
          newSubscribers: true,
          channelPointRedemptions: true,
          powerUpRedemptions: true,
          raids: true,
          watchStreaks: true,
          /* --- Ajuste v106: filtro específico para estados/moderación del chat --- */
          chatState: true,
          sharedChatMessages: "show-highlight"
        },
        youtube: {
          chatMessages: true,
          superChats: true,
          superStickers: true,
          memberships: true,
          gifts: true
        },
        kick: {
          enabled: true,
          chatMessages: true,
          newFollowers: true,
          newSubscribers: true,
          channelPointRedemptions: true,
          hosts: true,
          gifts: true
        },
        tiktok: {
          enabled: true,
          chatMessages: true,
          gifts: true,
          likes: true,
          shares: true,
          newFollowers: true,
          newSubscribers: true
        }
      }
    };

    const SYSTEM_TWITCH_AVATAR_URL = "https://static-cdn.jtvnw.net/jtv_user_pictures/7db44749-286f-4db0-9c99-574b16170d44-profile_image-70x70.png";
    const AVATAR_CACHE_KEY = "hipeMultichat.avatarCache.v1";
    const avatarLookupMemory = new Map();
    const avatarLookupInFlight = new Map();

    function loadAvatarCache() {
      try {
        const raw = localStorage.getItem(AVATAR_CACHE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        if (!parsed || typeof parsed !== "object") return {};
        return parsed;
      } catch (_) {
        return {};
      }
    }

    function saveAvatarCache(cache = {}) {
      try {
        localStorage.setItem(AVATAR_CACHE_KEY, JSON.stringify(cache));
      } catch (_) {}
    }

    function cacheAvatar(key, url) {
      const safe = String(url || "").trim();
      if (!key || !isSafeUrl(safe)) return;
      avatarLookupMemory.set(key, safe);
      const cache = loadAvatarCache();
      cache[key] = {
        url: safe,
        savedAt: Date.now()
      };
      saveAvatarCache(cache);
    }

    function getCachedAvatar(key) {
      if (!key) return "";
      if (avatarLookupMemory.has(key)) return avatarLookupMemory.get(key);

      const cache = loadAvatarCache();
      const hit = cache[key];
      if (!hit || !hit.url) return "";

      const maxAge = 1000 * 60 * 60 * 24 * 14;
      if (hit.savedAt && Date.now() - Number(hit.savedAt) > maxAge) return "";

      if (isSafeUrl(hit.url)) {
        avatarLookupMemory.set(key, hit.url);
        return hit.url;
      }

      return "";
    }

    function avatarLookupKey(platform, username, userId) {
      const p = String(platform || "").trim().toLowerCase();
      const u = String(username || "").trim().toLowerCase();
      const id = String(userId || "").trim().toLowerCase();
      if (!p) return "";
      return `${p}:${id || u}`;
    }

    function isSystemAvatarEvent(item = {}) {
      const category = String(item.category || "").trim().toLowerCase();
      const username = String(item.username || "").trim().toLowerCase();
      const eventType = String(firstValue(item.eventType, item._event && item._event.type, item.type, "") || "").trim().toLowerCase();
      const sys = String(firstValue(item.systemAvatar, item._systemAvatar, "") || "").trim();

      return Boolean(
        sys ||
        category === "chatstate" ||
        category === "hypetrain" ||
        username === "moderación" ||
        username.includes("tren del hype") ||
        eventType.includes("hypetrain")
      );
    }

    function avatarLookupIdentity(item = {}) {
      if (isSystemAvatarEvent(item)) {
        const platform = normalizePlatform(firstValue(item.platform, item.source, item._event && item._event.source, "twitch"));
        return { platform, username: "", userId: "", key: "" };
      }

      const platform = normalizePlatform(firstValue(item.platform, item.source));
      const username = firstValue(
        item.username,
        item.login,
        item.displayName,
        item.userName,
        item.name,
        item._user && item._user.login,
        item._user && item._user.name,
        item._data && item._data.user && item._data.user.login,
        item._data && item._data.user && item._data.user.name
      );
      const userId = firstValue(
        item.userId,
        item.id,
        item._user && item._user.id,
        item._data && item._data.user && item._data.user.id
      );

      return {
        platform,
        username: String(username || "").trim(),
        userId: String(userId || "").trim(),
        key: avatarLookupKey(platform, username, userId)
      };
    }

    const ICONS = {
      twitch: `
        <svg viewBox="0 0 48 48" aria-label="Twitch" role="img">
          <path fill="#9146FF" d="M8 5h34v23.5L32.5 38H25l-6.5 6.5V38H8V5Z"/>
          <path fill="#FFFFFF" d="M12 9h26v17.8L30.8 34H23l-5.5 5.5V34H12V9Z"/>
          <path fill="#9146FF" d="M20 16h4v11h-4V16Zm10 0h4v11h-4V16Z"/>
        </svg>
      `,
      youtube: `
        <svg viewBox="0 0 256 180" aria-label="YouTube" role="img" preserveAspectRatio="xMidYMid meet">
          <path fill="#FF0000" d="M250.35 28.08A32.2 32.2 0 0 0 227.7 5.42C207.82 0 128 0 128 0S48.18 0 28.3 5.42A32.2 32.2 0 0 0 5.65 28.08C0.32 47.95 0 89.94 0 89.94s0.32 41.99 5.65 61.86a32.2 32.2 0 0 0 22.65 22.66C48.18 179.88 128 180 128 180s79.82-0.12 99.7-5.54a32.2 32.2 0 0 0 22.65-22.66c5.33-19.87 5.65-61.86 5.65-61.86s-0.32-41.99-5.65-61.86Z"/>
          <path fill="#FFFFFF" d="M102.4 128.7V51.3L169.7 90l-67.3 38.7Z"/>
        </svg>
      `,
      kick: `
        <svg viewBox="0 0 250 250" aria-label="Kick" role="img" preserveAspectRatio="xMidYMid meet">
          <title>Kick</title>
          <rect width="250" height="250" fill="#000000"/>
          <path fill="#53FC18" fill-rule="evenodd" clip-rule="evenodd" transform="translate(40 29) scale(.64)" d="M0 0H100V66.6667H133.333V33.3333H166.667V0H266.667V100H233.333V133.333H200V166.667H233.333V200H266.667V300H166.667V266.667H133.333V233.333H100V300H0V0Z"/>
        </svg>
      `,
      tiktok: `
        <svg viewBox="0 0 48 48" aria-label="TikTok" role="img" preserveAspectRatio="xMidYMid meet">
          <path fill="#25F4EE" d="M20.6 18.8v16.1a6.9 6.9 0 1 1-6.9-6.9c.5 0 1 .1 1.5.2v5.1a2 2 0 1 0 1.4 1.9V6h5.2c.7 4.3 3.2 7 7.6 7.5v5.3c-2.8-.1-5.3-1-7.5-2.7v18.8A12.2 12.2 0 1 1 9.7 22.7c1.9 0 3.7.4 5.4 1.2v5.8a6.9 6.9 0 1 0 5.5 6.7V18.8Z"/>
          <path fill="#FE2C55" d="M23.6 6h5.2c.7 4.3 3.2 7 7.6 7.5v5.3c-2.8-.1-5.3-1-7.5-2.7v18.8A12.2 12.2 0 0 1 9 44.4a12.2 12.2 0 0 0 21-8.5V17.1c2.2 1.7 4.7 2.6 7.5 2.7v-4.1c-4.4-.5-6.9-3.2-7.6-7.5h-5.2v28.3a6.9 6.9 0 0 1-10.9 5.6 6.9 6.9 0 0 0 11-5.6V6Z" opacity=".82"/>
          <path fill="#FFFFFF" d="M22.1 6h5.2c.7 4.3 3.2 7 7.6 7.5v3.6c-2.8-.1-5.3-1-7.5-2.7v18.8A12.2 12.2 0 1 1 15.2 21c.5 0 1 .03 1.5.1v5.3a6.9 6.9 0 1 0 5.4 6.7V6Z"/>
        </svg>
      `,
      heart: `
        <svg viewBox="0 0 48 48" aria-label="Heart" role="img">
          <path fill="#FF3B65" d="M24 42S7 31.8 4 19.8C2.1 12.3 6.5 6 13.4 6c4.1 0 7.2 2.2 9 5 1.8-2.8 5.1-5 9.2-5 6.9 0 11.3 6.3 9.4 13.8C38 31.8 24 42 24 42Z"/>
        </svg>
      `,
      cam: `
        <svg viewBox="0 0 48 48" aria-label="Video" role="img">
          <rect x="5" y="13" width="29" height="22" rx="4" fill="#FF1F2D"/>
          <path fill="#FFFFFF" d="m34 21 9-6v18l-9-6v-6Z"/>
        </svg>
      `,
      star: `
        <svg viewBox="0 0 48 48" aria-label="Star" role="img">
          <path fill="#A78BFA" d="m24 5 5.5 12 13.1 1.5-9.7 8.9 2.6 13-11.5-6.6-11.5 6.6 2.6-13-9.7-8.9L18.5 17 24 5Z"/>
        </svg>
      `,
      "youtube-owner": `
        <svg viewBox="0 0 24 24" aria-label="YouTube owner" role="img" preserveAspectRatio="xMidYMid meet">
          <path fill="#22C55E" d="M5 16 3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5Z"/>
          <path fill="#22C55E" d="M5 18h14v2H5v-2Z"/>
        </svg>
      `,
      "youtube-moderator": `
        <svg viewBox="0 0 24 24" aria-label="YouTube moderator" role="img" preserveAspectRatio="xMidYMid meet">
          <path fill="#7DD3FC" d="M22.7 19 13.6 9.9c.9-2.3.4-5-1.5-6.9-1.9-1.9-4.6-2.4-6.9-1.5l4.2 4.2-3.7 3.7L1.5 5.2c-.9 2.3-.4 5 1.5 6.9 1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.4-.4.4-1 0-1.4Z"/>
        </svg>
      `,
      "youtube-member": `
        <svg viewBox="0 0 24 24" aria-label="YouTube member" role="img" preserveAspectRatio="xMidYMid meet">
          <path fill="#2BA640" d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27Z"/>
        </svg>
      `,
      "youtube-verified": `
        <svg viewBox="0 0 24 24" aria-label="YouTube verified" role="img" preserveAspectRatio="xMidYMid meet">
          <path fill="#BFC3CA" d="M9.55 17.65 4.9 13l1.4-1.4 3.25 3.25L17.7 6.7 19.1 8.1l-9.55 9.55Z"/>
        </svg>
      `
    };

    const scene = document.getElementById("scene");
    const chatScroll = document.getElementById("chatScroll");
    const chatStack = document.getElementById("chatStack");

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function safeCssColor(value) {
      const color = String(value || "").trim();
      if (!color) return "";
      const isSafe =
        /^#[0-9a-fA-F]{3,8}$/.test(color) ||
        /^rgb(a)?\([0-9.,%\s]+\)$/.test(color) ||
        /^hsl(a)?\([0-9.,%\s]+\)$/.test(color);
      return isSafe ? color : "";
    }

    function readableNameColor(value) {
      const color = safeCssColor(value);
      if (!color) return "";

      let r = null;
      let g = null;
      let b = null;

      const hex = color.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
      if (hex) {
        let raw = hex[1];
        if (raw.length === 3) {
          raw = raw.split("").map((ch) => ch + ch).join("");
        }
        r = parseInt(raw.slice(0, 2), 16);
        g = parseInt(raw.slice(2, 4), 16);
        b = parseInt(raw.slice(4, 6), 16);
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

      // Regla estricta: solo corregir colores extremadamente oscuros/casi negros.
      // No cambia rojos, azules, morados o verdes oscuros que todavía sean intención del usuario.
      if (luminance <= 28 && r <= 45 && g <= 45 && b <= 45) {
        return "#6b7280";
      }

      return color;
    }

    function currentTime() {
      return new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit"
      });
    }

    function icon(name) {
      return ICONS[name] || "";
    }

    function hydrateStaticIcons() {
      document.querySelectorAll("[data-icon]").forEach((node) => {
        node.innerHTML = icon(node.dataset.icon);
      });
    }

    function avatarNode(url, className = "avatar", item = {}) {
      const safe = String(url || "").trim();
      if (safe && isSafeUrl(safe)) {
        return `<img class="${className}" src="${escapeHtml(safe)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
      }

      const systemAvatar = String(firstValue(item.systemAvatar, item._systemAvatar, "") || "").trim().toLowerCase();
      if (className === "event-avatar" && (systemAvatar || isSystemAvatarEvent(item))) {
        if (systemAvatar === "youtube") {
          return `<span class="${className} ${className}-platform youtube" title="youtube">${icon("youtube")}</span>`;
        }

        return `<img class="${className} ${className}-system-twitch" src="${escapeHtml(SYSTEM_TWITCH_AVATAR_URL)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
      }

      const platform = String(firstValue(item.platform, item.source, item._event && item._event.source, "")).toLowerCase();
      const isSystemEventAvatar = className === "event-avatar" && (platform === "twitch" || platform === "youtube");
      if (isSystemEventAvatar && isSystemAvatarEvent(item)) {
        return `<span class="${className} ${className}-platform ${platform}" title="${escapeHtml(platform)}">${icon(platform)}</span>`;
      }

      return `<span class="${className}-fallback"></span>`;
    }

    function buildFallbackAvatarUrl(item = {}) {
      if (isSystemAvatarEvent(item)) return "";

      const platform = String(item.platform || item.source || "").trim().toLowerCase();
      const username = String(item.username || item.login || item.displayName || item.name || "").trim();
      const userId = String(item.userId || item.id || "").trim();

      if (platform === "twitch") {
        if (userId) return `https://unavatar.io/twitch/${encodeURIComponent(userId)}`;
        if (username) return `https://unavatar.io/twitch/${encodeURIComponent(username)}`;
      }

      if (platform === "youtube") {
        if (userId) return `https://unavatar.io/youtube/${encodeURIComponent(userId)}`;
        if (username) return `https://unavatar.io/youtube/${encodeURIComponent(username)}`;
      }

      return "";
    }

    function resolveAvatar(item = {}) {
      if (isSystemAvatarEvent(item)) return "";

      const direct = String(firstValue(
        item.avatar,
        item.avatarUrl,
        item.profileImage,
        item.profileImageUrl,
        item.userProfileImageUrl,
        item.userProfileImage
      ) || "").trim();

      if (direct && isSafeUrl(direct)) return direct;

      const fallback = buildFallbackAvatarUrl(item);
      return fallback && isSafeUrl(fallback) ? fallback : "";
    }

    async function fetchExternalAvatar(identity = {}) {
      const platform = String(identity.platform || "").trim().toLowerCase();
      const username = String(identity.username || "").trim();
      const key = String(identity.key || avatarLookupKey(platform, username, identity.userId)).trim();

      if (!key) return "";
      const cached = getCachedAvatar(key);
      if (cached) return cached;

      if (avatarLookupInFlight.has(key)) return avatarLookupInFlight.get(key);

      const promise = (async () => {
        try {
          // Nutty Multichat no depende del avatar dentro del payload de Streamer.bot:
          // para Twitch consulta Decapi con el login y cachea el resultado.
          if (platform === "twitch" && username) {
            const response = await fetch(`https://decapi.me/twitch/avatar/${encodeURIComponent(username)}`, {
              cache: "force-cache"
            });
            if (!response.ok) return "";
            const text = String(await response.text()).trim();
            if (isSafeUrl(text)) {
              return text;
            }
          }
        } catch (error) {
          if (CONFIG.websocket.debugPayload) {
            console.warn("[Hipe Multichat] Avatar lookup failed", { platform, username, error });
          }
        } finally {
          avatarLookupInFlight.delete(key);
        }

        return "";
      })();

      avatarLookupInFlight.set(key, promise);
      return promise;
    }

    function hydrateExternalAvatars(root = document) {
      if (!CONFIG.showAvatar) return;
      const nodes = Array.from(root.querySelectorAll("[data-avatar-lookup='1']"));

      nodes.forEach((node) => {
        const identity = {
          platform: node.dataset.avatarPlatform,
          username: node.dataset.avatarUsername,
          userId: node.dataset.avatarUserId,
          key: node.dataset.avatarKey
        };
        const usernameLower = String(identity.username || "").trim().toLowerCase();
        if (!identity.username || usernameLower === "moderación" || usernameLower.includes("tren del hype")) return;

        const className = node.dataset.avatarClass || "avatar";

        fetchExternalAvatar(identity).then((url) => {
          if (!url || !node.isConnected) return;
          const img = new Image();
          img.className = className;
          img.alt = "";
          img.loading = "lazy";
          img.referrerPolicy = "no-referrer";
          img.onload = () => {
            if (node.isConnected) node.replaceWith(img);
          };
          img.src = url;
        });
      });
    }

    function renderBadges(badges = []) {
      if (!CONFIG.showBadges) return "";
      if (!Array.isArray(badges) || !badges.length) return "";

      return badges
        .map((badge) => {
          const name = typeof badge === "string"
            ? badge
            : firstValue(badge.name, badge.type, badge.id, badge.title);

          const title = typeof badge === "object"
            ? firstValue(badge.title, badge.name, badge.type, badge.id)
            : name;

          const imageUrl = typeof badge === "object"
            ? firstValue(badge.imageUrl, badge.url, badge.src)
            : "";

          if (name === "twitch" || name === "youtube") return "";

          if (imageUrl && isSafeUrl(imageUrl)) {
            return `<span class="badge-icon"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" title="${escapeHtml(title)}" loading="lazy"></span>`;
          }

          if (icon(name)) {
            const badgeClass = String(name || "")
              .toLowerCase()
              .replace(/[^a-z0-9_-]+/g, "-")
              .replace(/^-+|-+$/g, "");
            return `<span class="badge-icon${badgeClass ? ` badge-${escapeHtml(badgeClass)}` : ""}" title="${escapeHtml(title)}">${icon(name)}</span>`;
          }

          return "";
        })
        .join("");
    }

    function isSafeUrl(value) {
      const url = String(value || "").trim();
      return /^https?:\/\//i.test(url) || /^data:image\//i.test(url) || /^\.?\//.test(url);
    }

    function upgradeEmoteUrl(url = "") {
      const safeUrl = String(url || "").trim();
      if (!safeUrl) return "";

      // v4: Twitch no sirve todos los emotes en 4.0.
      // Streamer.bot puede mandar 2.0 en emotes y 3.0 en parts; horizontal estaba
      // forzando 4.0 y eso provocaba imagen rota solo aquí. Conservamos 3.0 como
      // tamaño máximo seguro, igual que vertical.
      if (/static-cdn\.jtvnw\.net\/emoticons\/v2\//i.test(safeUrl)) {
        return safeUrl.replace(/\/(default\/(?:dark|light))\/(1\.0|2\.0|4\.0)(?=$|[/?#])/i, "/$1/3.0");
      }

      return safeUrl;
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

    function buildKickEmoteTokenLookup(emotes = []) {
      const byName = new Map();
      const byId = new Map();

      (Array.isArray(emotes) ? emotes : []).forEach((emote) => {
        const name = String(emote?.name || "").trim().toLowerCase();
        const id = String(emote?.id || emote?.emoteId || "").trim();
        if (name && !byName.has(name)) byName.set(name, emote);
        if (id && !byId.has(id)) byId.set(id, emote);
      });

      return { byName, byId };
    }

    function kickTokenIsEmoteOnly(value = "") {
      const clean = String(value || "")
        .replace(/\[emote:([^:\]\s]+):([^\]]+)\]/gi, "")
        .replace(/\s+/g, "")
        .trim();

      return clean.length === 0 && hasKickEmoteTokens(value);
    }

    function renderKickEmoteTokensWithImages(value = "", emotes = []) {
      const raw = String(value || "");
      const { byName, byId } = buildKickEmoteTokenLookup(emotes);
      const tokenPattern = /\[emote:([^:\]\s]+):([^\]]+)\]/gi;
      let cursor = 0;
      let html = "";
      let match;

      while ((match = tokenPattern.exec(raw))) {
        const [token, id, label] = match;
        const cleanId = String(id || "").trim();
        const cleanLabel = String(label || "").trim();
        const emote = byId.get(cleanId) || byName.get(cleanLabel.toLowerCase());

        html += escapeHtml(raw.slice(cursor, match.index));

        if (emote?.url) {
          const alt = cleanLabel || emote.name || "Kick emote";
          html += `<img class="emote-img" src="${escapeHtml(emote.url)}" alt="${escapeHtml(alt)}" title="${escapeHtml(alt)}" loading="lazy" referrerpolicy="no-referrer">`;
        } else {
          const safeLabel = cleanLabel || "emote";
          html += `<span class="kick-emote-fallback" data-kick-emote-id="${escapeHtml(cleanId)}" title="${escapeHtml(`Kick emote ${cleanId}`)}">${escapeHtml(safeLabel)}</span>`;
        }

        cursor = match.index + token.length;
      }

      html += escapeHtml(raw.slice(cursor));
      return html;
    }

    function renderKickGigantifyTokenContent(value = "", emotes = []) {
      const raw = String(value || "");
      const { byName, byId } = buildKickEmoteTokenLookup(emotes);
      const tokenPattern = /\[emote:([^:\]\s]+):([^\]]+)\]/gi;
      const textParts = [];
      const largeEmoteParts = [];
      let cursor = 0;
      let match;

      while ((match = tokenPattern.exec(raw))) {
        const [token, id, label] = match;
        const cleanId = String(id || "").trim();
        const cleanLabel = String(label || "").trim();
        const emote = byId.get(cleanId) || byName.get(cleanLabel.toLowerCase());

        const before = raw.slice(cursor, match.index);
        if (before) textParts.push(before);

        if (emote?.url) {
          const alt = cleanLabel || emote.name || "Kick emote";
          largeEmoteParts.push(`<img class="emote-img" src="${escapeHtml(emote.url)}" alt="${escapeHtml(alt)}" title="${escapeHtml(alt)}" loading="lazy" referrerpolicy="no-referrer">`);
        } else if (cleanLabel) {
          textParts.push(cleanLabel);
        }

        cursor = match.index + token.length;
      }

      const after = raw.slice(cursor);
      if (after) textParts.push(after);

      const cleanText = textParts
        .join("")
        .replace(/\s+/g, " ")
        .trim();

      return {
        textHtml: cleanText ? `<span class="gigantify-text">${escapeHtml(cleanText)}</span>` : "",
        largeEmotesHtml: largeEmoteParts.join("")
      };
    }

    function normalizeEmotes(emotes = []) {
      if (!CONFIG.customEmotes) return [];
      if (!Array.isArray(emotes)) return [];

      return emotes
        .map((emote) => {
          const rawStart = firstValue(emote.start, emote.startIndex);
          const rawEnd = firstValue(emote.end, emote.endIndex);
          const hasStart = rawStart !== "";
          const hasEnd = rawEnd !== "";
          const url = String(firstValue(emote.url, emote.imageUrl, emote.src)).trim();

          return {
            id: String(firstValue(emote.id, emote.emoteId)).trim(),
            name: String(firstValue(emote.name, emote.code, emote.text, emote.id)).trim(),
            url: upgradeEmoteUrl(url),
            provider: String(firstValue(emote.provider, emote.source, emote.type)).trim(),
            start: hasStart ? Number(rawStart) : NaN,
            end: hasEnd ? Number(rawEnd) : NaN,
            width: Number(emote.width),
            height: Number(emote.height),
            pixel: Boolean(emote.pixel || emote.pixelated)
          };
        })
        .filter((emote) => emote.name && emote.url && isSafeUrl(emote.url));
    }

    function detectEmoteOnly(messageRaw, emotes, forceLarge = false) {
      if (!forceLarge || !CONFIG.gigantifyEmotes || !emotes.length) return false;
      const clean = String(messageRaw || "").trim();
      if (!clean || clean.length > CONFIG.emoteOnlyMaxTextLength) return false;

      const names = emotes
        .map((emote) => emote.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .filter(Boolean);

      if (!names.length) return false;
      const pattern = new RegExp(`^(?:${names.join("|")})(?:\\s+(?:${names.join("|")}))*$`, "i");
      return pattern.test(clean);
    }

    function renderMessageContent(messageRaw, emotes = [], options = {}) {
      const normalizedEmotes = normalizeEmotes(emotes);
      const text = String(messageRaw || "");
      const forceLarge = Boolean(options.forceLarge);
      const emoteOnly = Boolean(options.emoteOnly ?? detectEmoteOnly(text, normalizedEmotes, forceLarge));
      const pixel = normalizedEmotes.some((emote) => emote.pixel);

      if (!normalizedEmotes.length) {
        return {
          html: hasKickEmoteTokens(text) ? renderKickEmoteTokenFallback(text) : escapeHtml(text),
          emoteOnly: false,
          pixel: false
        };
      }

      if (hasKickEmoteTokens(text)) {
        return {
          html: renderKickEmoteTokensWithImages(text, normalizedEmotes),
          emoteOnly: emoteOnly || kickTokenIsEmoteOnly(text),
          pixel
        };
      }

      // Caso 1: emotes con posiciones start/end estilo Twitch.
      // YouTube a veces manda startIndex/endIndex desfasados cuando el emoji viene
      // como token tipo :face-red-droopy-eyes:. Si el rango no coincide con el token
      // real, se ignora ese rango y cae al reemplazo por nombre exacto para no dejar
      // sobrantes como "py-eyes:" después del emote.
      const withPositions = normalizedEmotes
        .filter((emote) => {
          if (!Number.isFinite(emote.start) || !Number.isFinite(emote.end)) return false;

          const provider = String(emote.provider || emote.source || emote.type || "").toLowerCase();
          const name = String(emote.name || "");
          if (provider.includes("twemoji")) return false;
          if (provider.includes("youtube") && /^:[^\s:][\s\S]*:$/.test(name)) return false;

          const sliced = text.slice(Math.max(0, emote.start), Math.max(emote.start, emote.end) + 1);

          if (
            provider.includes("youtube") &&
            name &&
            name.includes(":") &&
            sliced !== name &&
            text.includes(name)
          ) {
            return false;
          }

          return true;
        })
        .sort((a, b) => a.start - b.start);

      if (withPositions.length) {
        let cursor = 0;
        let html = "";

        withPositions.forEach((emote) => {
          const start = Math.max(0, emote.start);
          const end = Math.max(start, emote.end);
          if (start < cursor) return;

          html += escapeHtml(text.slice(cursor, start));
          html += `<img class="emote-img" src="${escapeHtml(emote.url)}" alt="${escapeHtml(emote.name)}" title="${escapeHtml(emote.name)}" loading="lazy" referrerpolicy="no-referrer">`;
          cursor = end + 1;
        });

        html += escapeHtml(text.slice(cursor));

        return {
          html,
          emoteOnly,
          pixel
        };
      }

      // Caso 2: resolver por tokens, útil para BTTV / FFZ / 7TV y para YouTube
      // cuando el token viene pegado al texto: "ve:face-red-droopy-eyes:".
      const tokenEmotes = [];
      const seenTokenEmotes = new Set();

      normalizedEmotes
        .filter((emote) => emote.name && text.includes(emote.name))
        .sort((a, b) => String(b.name).length - String(a.name).length)
        .forEach((emote) => {
          const key = String(emote.name || "").toLowerCase();
          if (!key || seenTokenEmotes.has(key)) return;
          seenTokenEmotes.add(key);
          tokenEmotes.push(emote);
        });

      if (tokenEmotes.length) {
        let html = escapeHtml(text);

        tokenEmotes.forEach((emote) => {
          const token = escapeHtml(emote.name);
          const img = `<img class="emote-img" src="${escapeHtml(emote.url)}" alt="${escapeHtml(emote.name)}" title="${escapeHtml(emote.name)}" loading="lazy" referrerpolicy="no-referrer">`;
          html = html.split(token).join(img);
        });

        return {
          html,
          emoteOnly,
          pixel
        };
      }

      const emoteMap = new Map(normalizedEmotes.map((emote) => [emote.name.toLowerCase(), emote]));
      const parts = text.split(/(\s+)/);

      const html = parts.map((part) => {
        const emote = emoteMap.get(part.toLowerCase());
        if (!emote) return escapeHtml(part);
        return `<img class="emote-img" src="${escapeHtml(emote.url)}" alt="${escapeHtml(emote.name)}" title="${escapeHtml(emote.name)}" loading="lazy" referrerpolicy="no-referrer">`;
      }).join("");

      return {
        html,
        emoteOnly,
        pixel
      };
    }

    function renderGigantifyTextSlice(fragment = "") {
      const clean = String(fragment || "");
      if (!clean) return "";
      return `<span class="gigantify-text">${escapeHtml(clean)}</span>`;
    }

    function renderGigantifyContent(messageRaw, emotes = []) {
      const normalizedEmotes = normalizeEmotes(emotes);
      const text = String(messageRaw || "");
      const pixel = normalizedEmotes.some((emote) => emote.pixel);

      if (!normalizedEmotes.length) {
        return {
          textHtml: text ? `<span class="gigantify-text">${hasKickEmoteTokens(text) ? renderKickEmoteTokenFallback(text) : escapeHtml(text)}</span>` : "",
          inlineEmotesHtml: "",
          largeEmotesHtml: "",
          pixel
        };
      }

      if (hasKickEmoteTokens(text)) {
        const kickTokenContent = renderKickGigantifyTokenContent(text, normalizedEmotes);
        return {
          textHtml: kickTokenContent.textHtml,
          inlineEmotesHtml: "",
          largeEmotesHtml: kickTokenContent.largeEmotesHtml,
          pixel
        };
      }

      const textParts = [];
      const smallEmoteParts = [];
      const largeEmoteParts = [];

      const pushText = (fragment = "") => {
        if (fragment) textParts.push(fragment);
      };

      const pushEmote = (emote) => {
        const emoteHtml = `<img class="emote-img" src="${escapeHtml(emote.url)}" alt="${escapeHtml(emote.name)}" title="${escapeHtml(emote.name)}" loading="lazy" referrerpolicy="no-referrer">`;
        smallEmoteParts.push(emoteHtml);
        largeEmoteParts.push(emoteHtml);
      };

      const withPositions = normalizedEmotes
        .filter((emote) => {
          if (!Number.isFinite(emote.start) || !Number.isFinite(emote.end)) return false;

          const provider = String(emote.provider || emote.source || emote.type || "").toLowerCase();
          const name = String(emote.name || "");
          if (provider.includes("youtube") && /^:[^\s:][\s\S]*:$/.test(name)) return false;
          const sliced = text.slice(Math.max(0, emote.start), Math.max(emote.start, emote.end) + 1);

          if (
            provider.includes("youtube") &&
            name &&
            name.includes(":") &&
            sliced !== name &&
            text.includes(name)
          ) {
            return false;
          }

          return true;
        })
        .sort((a, b) => a.start - b.start);

      if (withPositions.length) {
        let cursor = 0;

        withPositions.forEach((emote) => {
          const start = Math.max(0, emote.start);
          const end = Math.max(start, emote.end);
          if (start < cursor) return;

          pushText(text.slice(cursor, start));
          pushEmote(emote);
          cursor = end + 1;
        });

        pushText(text.slice(cursor));
      } else {
        const emoteMap = new Map(normalizedEmotes.map((emote) => [emote.name.toLowerCase(), emote]));
        const parts = text.split(/(\s+)/);

        parts.forEach((part) => {
          const emote = emoteMap.get(part.toLowerCase());
          if (emote) {
            pushEmote(emote);
            return;
          }
          pushText(part);
        });
      }

      const cleanText = textParts
        .join("")
        .replace(/\s+/g, " ")
        .trim();

      return {
        textHtml: cleanText ? `<span class="gigantify-text">${escapeHtml(cleanText)}</span>` : "",
        // En Power-Up/Gigantify evitamos duplicar el emote en pequeño.
        inlineEmotesHtml: "",
        largeEmotesHtml: largeEmoteParts.join(""),
        pixel
      };
    }

    function explicitGigantifyFromStreamerBotPayload(raw = {}) {
      const event = raw.event || {};
      const data = raw.data || raw;
      const eventType = String(firstValue(event.type, raw.type, "")).toLowerCase();
      const rewardType = String(firstValue(data.reward_type, data.rewardType, raw.reward_type, raw.rewardType, "")).toLowerCase();

      if (!eventType.includes("automaticrewardredemption") && !eventType.includes("custompowerupredemption")) return null;
      if (rewardType !== "gigantify_an_emote") return null;

      const emote = data.gigantified_emote || data.gigantifiedEmote || data.message_emotes?.[0] || data.messageEmotes?.[0];
      if (!emote || typeof emote !== "object") return null;

      const imageUrl = String(firstValue(emote.imageUrl, emote.image_url, emote.url, emote.src, "")).trim();
      if (!imageUrl || !isSafeUrl(imageUrl)) return null;

      return {
        platform: "twitch",
        username: firstValue(data.user_name, data.userName, data.user_login, data.userLogin, ""),
        message: firstValue(data.message_text, data.messageText, data.user_input, data.userInput, emote.name, "Gigantify"),
        emotes: [{
          name: firstValue(emote.name, emote.text, emote.code, "Gigantify"),
          imageUrl,
          type: "Twitch",
          source: "Twitch",
          fromExplicitGigantify: true
        }],
        time: normalizeTime(firstValue(raw.timeStamp, raw.timestamp, data.redeemed_at, data.redeemedAt)),
        kind: "gigantifyEffect",
        category: "chatMessages"
      };
    }

    function isGigantifyPowerUp(item = {}) {
      const type = String(firstValue(item.powerUpType, item.powerupType, item.power_up, item.powerUp, item.type, item.kind, item.eventType, item.actionType)).toLowerCase();
      const rawHint = String(firstValue(item.powerUpName, item.powerupName, item.powerUpTitle, item.rewardTitle, item.title, item.actionName)).toLowerCase();
      const messageHint = String(firstValue(item.message, item.text, item.rawInput)).toLowerCase();
      return (
        Boolean(item.gigantify || item.isGigantify || item.gigantified) ||
        type.includes("gigantify") ||
        rawHint.includes("gigantify") ||
        messageHint.includes("gigantify") ||
        type.includes("giant") ||
        rawHint.includes("giant") ||
        type.includes("power-up:gigantify") ||
        type.includes("powerup:gigantify") ||
        type.includes("gigantificar") ||
        rawHint.includes("gigantificar") ||
        messageHint.includes("gigantificar")
      );
    }

    function looksLikeGigantifyChat(mapped = {}, messageObj = {}, metaObj = {}) {
      const platform = String(mapped.platform || "").toLowerCase();
      if (platform !== "twitch") return false;

      // v147: NO inferir Gigantify por "un solo emote" ni por ausencia de clientNonce.
      // En Streamer.bot 1.0.5 alpha los mensajes normales pueden venir sin clientNonce,
      // por eso esa heurística convertía emotes normales en Power-Up.
      // Gigantify solo debe activarse si viene señal explícita.
      const explicitType = String(firstValue(
        mapped.powerUpType,
        mapped.powerupType,
        mapped.power_up,
        mapped.powerUp,
        mapped.eventType,
        mapped.actionType,
        messageObj.powerUpType,
        messageObj.powerupType,
        messageObj.power_up,
        messageObj.powerUp,
        metaObj.powerUpType,
        metaObj.powerupType
      )).toLowerCase();

      const explicitName = String(firstValue(
        mapped.powerUpName,
        mapped.powerupName,
        mapped.powerUpTitle,
        mapped.rewardTitle,
        mapped.actionName,
        messageObj.powerUpName,
        messageObj.powerupName,
        messageObj.powerUpTitle,
        messageObj.rewardTitle,
        messageObj.actionName
      )).toLowerCase();

      return (
        Boolean(mapped.gigantify || mapped.isGigantify || mapped.gigantified || messageObj.gigantify || messageObj.isGigantify || messageObj.gigantified || metaObj.gigantify) ||
        explicitType.includes("gigantify") ||
        explicitType.includes("gigantificar") ||
        explicitType.includes("power-up:gigantify") ||
        explicitType.includes("powerup:gigantify") ||
        explicitName.includes("gigantify") ||
        explicitName.includes("gigantificar")
      );
    }

    function renderImages(images = []) {
      if (!Array.isArray(images) || !images.length) return "";
      return images
        .filter((url) => isSafeUrl(url))
        .map((url) => `<img class="message-media" src="${escapeHtml(url)}" alt="" loading="lazy">`)
        .join("");
    }

    function findFirstImageUrl(value, depth = 0, seen = new Set()) {
      if (!value || depth > 7) return "";

      if (typeof value === "string") {
        const text = value.trim();
        if (isSafeUrl(text) && /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i.test(text)) return text;
        if (isSafeUrl(text) && /(?:ytimg|googleusercontent|ggpht|twimg|jtvnw|cdn|image|sticker|emoji)/i.test(text)) return text;
        return "";
      }

      if (typeof value !== "object") return "";
      if (seen.has(value)) return "";
      seen.add(value);

      const preferredKeys = [
        "stickerImageUrl",
        "sticker_image_url",
        "superStickerImageUrl",
        "super_sticker_image_url",
        "imageUrl",
        "image_url",
        "image",
        "url",
        "src",
        "thumbnailUrl",
        "thumbnail_url"
      ];

      for (const key of preferredKeys) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          const found = findFirstImageUrl(value[key], depth + 1, seen);
          if (found) return found;
        }
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          const found = findFirstImageUrl(item, depth + 1, seen);
          if (found) return found;
        }
        return "";
      }

      for (const key of Object.keys(value)) {
        if (preferredKeys.includes(key)) continue;
        const found = findFirstImageUrl(value[key], depth + 1, seen);
        if (found) return found;
      }

      return "";
    }

    function isLikelyProfileImageUrl(url = "") {
      const text = String(url || "").toLowerCase();
      return (
        text.includes("profile_image") ||
        text.includes("jtv_user_pictures") ||
        text.includes("=s88-") ||
        text.includes("s88-c") ||
        text.includes("no-rj")
      );
    }

    function findYouTubeSuperStickerObjectImage(value, depth = 0, seen = new Set()) {
      if (!value || depth > 8) return "";

      if (typeof value === "string") {
        const text = value.trim();
        if (!isSafeUrl(text)) return "";
        if (isLikelyProfileImageUrl(text)) return "";
        return text;
      }

      if (typeof value !== "object") return "";
      if (seen.has(value)) return "";
      seen.add(value);

      if (Array.isArray(value)) {
        for (const item of value) {
          const found = findYouTubeSuperStickerObjectImage(item, depth + 1, seen);
          if (found) return found;
        }
        return "";
      }

      const alternativeText = String(firstValue(value.alternativeText, value.altText, value.alt, "")).trim();
      const imageUrl = String(firstValue(value.imageUrl, value.image_url, value.url, value.src, "")).trim();

      if (alternativeText && imageUrl && isSafeUrl(imageUrl) && !isLikelyProfileImageUrl(imageUrl)) {
        return imageUrl;
      }

      const blockedKeys = new Set([
        "user",
        "_user",
        "author",
        "authorDetails",
        "broadcast",
        "avatar",
        "profileImageUrl",
        "profile_image_url",
        "authorProfileImageUrl",
        "mediaUrl",
        "soundUrl"
      ]);

      for (const key of Object.keys(value)) {
        if (blockedKeys.has(key)) continue;
        const found = findYouTubeSuperStickerObjectImage(value[key], depth + 1, seen);
        if (found) return found;
      }

      return "";
    }

    function findSuperStickerImageUrl(value, depth = 0, seen = new Set()) {
      if (!value || depth > 7) return "";

      if (typeof value === "string") {
        const text = value.trim();
        if (!isSafeUrl(text)) return "";
        if (isLikelyProfileImageUrl(text)) return "";
        if (/(?:googleusercontent|ggpht|ytimg|sticker|emoji|image)/i.test(text)) return text;
        return "";
      }

      if (typeof value !== "object") return "";
      if (seen.has(value)) return "";
      seen.add(value);

      if (Array.isArray(value)) {
        for (const item of value) {
          const found = findSuperStickerImageUrl(item, depth + 1, seen);
          if (found) return found;
        }
        return "";
      }

      // YouTube SuperSticker real suele venir como objeto con alternativeText + imageUrl.
      if (
        Object.prototype.hasOwnProperty.call(value, "alternativeText") &&
        Object.prototype.hasOwnProperty.call(value, "imageUrl")
      ) {
        const found = findSuperStickerImageUrl(value.imageUrl, depth + 1, seen);
        if (found) return found;
      }

      const preferredStickerKeys = [
        "stickerImageUrl",
        "sticker_image_url",
        "superStickerImageUrl",
        "super_sticker_image_url",
        "sticker",
        "superSticker",
        "super_sticker"
      ];

      for (const key of preferredStickerKeys) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          const found = findSuperStickerImageUrl(value[key], depth + 1, seen);
          if (found) return found;
        }
      }

      const blockedKeys = new Set([
        "avatar",
        "profileImageUrl",
        "profile_image_url",
        "authorProfileImageUrl",
        "author_profile_image_url",
        "user",
        "author",
        "authorDetails",
        "broadcast",
        "thumbnail",
        "thumbnailUrl",
        "thumbnails",
        "mediaUrl",
        "soundUrl"
      ]);

      for (const key of Object.keys(value)) {
        if (blockedKeys.has(key)) continue;
        if (preferredStickerKeys.includes(key)) continue;
        const child = value[key];

        // Evita agarrar objetos de usuario por accidente.
        if (child && typeof child === "object") {
          const maybeName = String(child.name || child.displayName || child.profileImageUrl || "").toLowerCase();
          if (maybeName && (Object.prototype.hasOwnProperty.call(child, "profileImageUrl") || Object.prototype.hasOwnProperty.call(child, "isModerator"))) {
            continue;
          }
        }

        const found = findSuperStickerImageUrl(child, depth + 1, seen);
        if (found) return found;
      }

      return "";
    }

    /* --- Ajuste v136: previews de links YouTube + Twitch con miniatura cuando el proveedor lo permite --- */
    const youtubePreviewCache = new Map();
    const twitchPreviewCache = new Map();

    function extractYouTubeVideoId(value = "") {
      const text = String(value || "");
      const match = text.match(/https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?[^\s<>"]*v=|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/i);
      if (!match) return null;
      return match[1].slice(0, 32);
    }

    function extractFirstYouTubeUrl(value = "") {
      const text = String(value || "");
      const match = text.match(/https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?[^\s<>"]*v=[a-zA-Z0-9_-]{6,}[^\s<>"]*|shorts\/[a-zA-Z0-9_-]{6,}[^\s<>"]*|live\/[a-zA-Z0-9_-]{6,}[^\s<>"]*)|youtu\.be\/[a-zA-Z0-9_-]{6,}[^\s<>"]*)/i);
      return match ? match[0] : "";
    }

    function cleanPreviewUrl(url = "") {
      return String(url || "").trim().replace(/[),.;!?]+$/g, "");
    }

    function extractFirstTwitchUrl(value = "") {
      const text = String(value || "");
      const match = text.match(/(?:https?:\/\/)?(?:www\.|m\.)?(?:clips\.twitch\.tv\/[A-Za-z0-9_-]+|twitch\.tv\/(?:videos\/\d+|[^\s\/<>"]+\/clip\/[A-Za-z0-9_-]+|clip\/[A-Za-z0-9_-]+))[^\s<>"]*/i);
      if (!match) return "";
      const rawUrl = cleanPreviewUrl(match[0]);
      return /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    }

    function getTwitchPreviewKind(url = "") {
      const lower = String(url || "").toLowerCase();
      if (lower.includes("/videos/")) return "video";
      if (lower.includes("clips.twitch.tv") || lower.includes("/clip/")) return "clip";
      return "link";
    }

    function getTwitchCanonicalPreviewUrl(url = "") {
      const text = String(url || "").trim();
      const clipMatch = text.match(/(?:clips\.twitch\.tv\/|twitch\.tv\/[^\s\/<>"]+\/clip\/|twitch\.tv\/clip\/)([A-Za-z0-9_-]+)/i);
      if (!clipMatch) return text;
      return `https://clips.twitch.tv/${clipMatch[1]}`;
    }

    function buildYouTubePreviewFromText(message = "") {
      if (!CONFIG.showYouTubeLinkPreviews) return null;

      const url = extractFirstYouTubeUrl(message);
      const videoId = extractYouTubeVideoId(url);
      if (!url || !videoId) return null;

      return {
        type: "youtube",
        url,
        videoId,
        previewId: `yt-${videoId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: "Cargando video...",
        channel: "YouTube",
        site: "YouTube",
        thumbnail: `https://img.youtube.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`,
        needsHydration: true
      };
    }

    function buildTwitchPreviewFromText(message = "") {
      if (!CONFIG.showYouTubeLinkPreviews) return null;

      const url = extractFirstTwitchUrl(message);
      if (!url) return null;

      const kind = getTwitchPreviewKind(url);

      return {
        type: "twitch",
        url,
        twitchKind: kind,
        previewId: `tw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: "",
        channel: "",
        site: "Twitch",
        thumbnail: "",
        needsHydration: true,
        pendingThumbnail: true
      };
    }

    function buildLinkPreviewFromText(message = "") {
      return buildYouTubePreviewFromText(message) || buildTwitchPreviewFromText(message);
    }

    function renderLinkPreview(preview) {
      if (!preview || typeof preview !== "object") return "";

      if (preview.type === "twitch" && preview.pendingThumbnail && !preview.thumbnail) {
        return `<div class="link-preview twitch-preview pending-preview" data-preview-id="${escapeHtml(preview.previewId)}" data-url="${escapeHtml(preview.url || "")}" style="display:none"></div>`;
      }

      const previewType = String(preview.type || preview.site || "").toLowerCase();
      const isYoutube = previewType.includes("youtube") || Boolean(preview.videoId);
      const isTwitch = previewType.includes("twitch") || Boolean(preview.twitchKind);
      const previewClass = isYoutube ? " youtube-preview" : (isTwitch ? " twitch-preview" : "");
      const thumbnail = preview.thumbnail && isSafeUrl(preview.thumbnail)
        ? `<img src="${escapeHtml(preview.thumbnail)}" alt="" loading="lazy">`
        : "";
      const title = escapeHtml(preview.title || preview.url || "Link");
      const site = escapeHtml(preview.channel || preview.author || preview.authorName || preview.site || "Link");
      const previewIdAttr = preview.previewId ? ` data-preview-id="${escapeHtml(preview.previewId)}"` : "";
      const videoIdAttr = preview.videoId ? ` data-video-id="${escapeHtml(preview.videoId)}"` : "";
      const urlAttr = preview.url ? ` data-url="${escapeHtml(preview.url)}"` : "";

      return `
        <div class="link-preview${previewClass}"${previewIdAttr}${videoIdAttr}${urlAttr}>
          ${thumbnail}
          <div>
            <div class="link-preview-title">${title}</div>
            <div class="link-preview-site">${site}</div>
          </div>
        </div>
      `;
    }

    function updateLinkPreviewNode(node, data = {}) {
      if (!node) return;
      const titleEl = node.querySelector(".link-preview-title");
      const siteEl = node.querySelector(".link-preview-site");
      const imgEl = node.querySelector("img");

      if (titleEl && data.title) titleEl.textContent = data.title;
      if (siteEl && (data.channel || data.author_name || data.authorName || data.site)) {
        siteEl.textContent = data.channel || data.author_name || data.authorName || data.site;
      }

      if (data.thumbnail_url && isSafeUrl(data.thumbnail_url)) {
        if (imgEl) {
          imgEl.src = data.thumbnail_url;
        } else {
          node.insertAdjacentHTML("afterbegin", `<img src="${escapeHtml(data.thumbnail_url)}" alt="" loading="lazy">`);
        }
      }

      schedulePreviewHydrationScroll(node);
    }

    function normalizeTwitchPreviewDisplay(data = {}) {
      let title = String(firstValue(data.title, "Clip de Twitch")).trim();
      let channel = String(firstValue(data.channel, data.publisher, data.author, data.author_name, data.authorName, data.site, "Twitch")).trim();

      // Microlink a veces devuelve "canal - título" como title y "Twitch" como provider.
      // También puede venir de localStorage con el formato viejo. Lo limpiamos siempre aquí.
      const split = title.match(/^(.{2,40}?)\s*[-–—:]\s*(.{4,})$/);
      if (split && (!channel || channel.toLowerCase() === "twitch")) {
        channel = split[1].trim();
        title = split[2].trim();
      } else if (split && channel && split[1].trim().toLowerCase() === channel.toLowerCase()) {
        title = split[2].trim();
      }

      return {
        title: title || "Clip de Twitch",
        channel: channel || "Twitch"
      };
    }

    function activateTwitchPreviewNode(node, data = {}) {
      if (!node || !data.thumbnail_url || !isSafeUrl(data.thumbnail_url)) return;

      const display = normalizeTwitchPreviewDisplay(data);
      const title = escapeHtml(display.title);
      const channel = escapeHtml(display.channel);
      const thumb = escapeHtml(data.thumbnail_url);

      node.style.display = "";
      node.classList.remove("pending-preview");
      node.innerHTML = `
        <img src="${thumb}" alt="" loading="lazy">
        <div>
          <div class="link-preview-title">${title}</div>
          <div class="link-preview-site">${channel}</div>
        </div>
      `;

      schedulePreviewHydrationScroll(node);
    }

    async function hydrateYouTubePreview(preview, rootNode) {
      if (!preview || !preview.videoId || !preview.url || !preview.previewId || !rootNode) return;

      const node = rootNode.querySelector(`[data-preview-id="${cssEscapeValue(preview.previewId)}"]`);
      if (!node) return;

      try {
        let data = youtubePreviewCache.get(preview.videoId);

        if (!data) {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 4500);
          const endpoint = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(preview.url)}`;

          const response = await fetch(endpoint, {
            method: "GET",
            signal: controller.signal
          });
          clearTimeout(timer);

          if (!response.ok) throw new Error(`oEmbed status ${response.status}`);
          data = await response.json();
          youtubePreviewCache.set(preview.videoId, data);
        }

        updateLinkPreviewNode(node, {
          title: data.title,
          channel: data.author_name,
          thumbnail_url: data.thumbnail_url
        });
      } catch (error) {
        if (CONFIG.websocket.debugPayload) {
          console.warn("[Hipe Multichat] No se pudo cargar preview de YouTube", error);
        }
      }
    }

    async function hydrateTwitchPreview(preview, rootNode) {
      if (!preview || !preview.url || !preview.previewId || !rootNode) return;

      const node = rootNode.querySelector(`[data-preview-id="${cssEscapeValue(preview.previewId)}"]`);
      if (!node) return;

      function extractMicrolinkImage(microData = {}) {
        return firstValue(
          microData?.image?.url,
          microData?.screenshot?.url,
          microData?.thumbnail_url,
          ""
        );
      }

      function isUsefulTwitchImage(image = "") {
        const value = String(image || "");
        if (!value || !isSafeUrl(value)) return false;
        if (/logo|favicon|brand|twimg\.com\/profile_images|ttv-static-metadata\/twitch_logo/i.test(value)) return false;
        return true;
      }

      function isGenericTwitchMetadata(microData = {}) {
        const title = String(microData?.title || "").trim().toLowerCase();
        const description = String(microData?.description || "").trim().toLowerCase();
        const image = String(extractMicrolinkImage(microData) || "").toLowerCase();
        return (
          title === "twitch" ||
          (description.includes("world") && description.includes("gamers")) ||
          image.includes("ttv-static-metadata/twitch_logo")
        );
      }

      function getTwitchPreviewCacheKey(url = "") {
        const canonical = getTwitchCanonicalPreviewUrl(url);
        return `hipeMultichat.twitchPreview.${canonical}`;
      }

      function readStoredTwitchPreview(url = "") {
        try {
          const raw = localStorage.getItem(getTwitchPreviewCacheKey(url));
          if (!raw) return null;
          const stored = JSON.parse(raw);
          const maxAge = 1000 * 60 * 60 * 24 * 14; // 14 días
          if (!stored || !stored.thumbnail_url || Date.now() - Number(stored.savedAt || 0) > maxAge) return null;
          if (!isUsefulTwitchImage(stored.thumbnail_url)) return null;
          const display = normalizeTwitchPreviewDisplay(stored);
          return {
            ...stored,
            title: display.title,
            channel: display.channel
          };
        } catch (_) {
          return null;
        }
      }

      function saveStoredTwitchPreview(url = "", data = {}, image = "") {
        if (!isUsefulTwitchImage(image)) return;
        try {
          const display = normalizeTwitchPreviewDisplay({
            title: data.title || "Clip de Twitch",
            channel: data.channel || data.publisher || data.author || data.provider || "Twitch"
          });
          localStorage.setItem(getTwitchPreviewCacheKey(url), JSON.stringify({
            title: display.title,
            channel: display.channel,
            thumbnail_url: image,
            savedAt: Date.now()
          }));
        } catch (_) {}
      }

      async function fetchMicrolinkData(targetUrl, options = {}) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 18000);
        const params = new URLSearchParams();
        params.set("url", targetUrl);
        params.set("meta", "true");

        if (options.screenshot) params.set("screenshot", "true");
        if (options.force) params.set("force", "true");

        const endpoint = `https://api.microlink.io/?${params.toString()}`;

        try {
          const response = await fetch(endpoint, {
            method: "GET",
            signal: controller.signal
          });

          if (!response.ok) {
            const err = new Error(`Microlink status ${response.status}`);
            err.status = response.status;
            err.endpoint = endpoint;
            throw err;
          }

          const json = await response.json();
          return json?.data || {};
        } finally {
          clearTimeout(timer);
        }
      }

      try {
        const canonicalUrl = getTwitchCanonicalPreviewUrl(preview.url);
        const storedPreview = readStoredTwitchPreview(canonicalUrl) || readStoredTwitchPreview(preview.url);

        if (storedPreview) {
          activateTwitchPreviewNode(node, storedPreview);
          return;
        }

        const candidates = Array.from(new Set([canonicalUrl, preview.url].filter(Boolean)));

        let data = twitchPreviewCache.get(canonicalUrl) || twitchPreviewCache.get(preview.url);
        let image = data ? extractMicrolinkImage(data) : "";

        if (!isUsefulTwitchImage(image) || isGenericTwitchMetadata(data)) {
          data = null;
          image = "";

          const attempts = [
            { screenshot: false, force: false, label: "normal" },
            { screenshot: false, force: true, label: "force" },
            { screenshot: true, force: false, label: "screenshot" },
            { screenshot: true, force: true, label: "screenshot-force" }
          ];

          for (const targetUrl of candidates) {
            for (const attempt of attempts) {
              let current = null;
              let currentImage = "";

              try {
                current = await fetchMicrolinkData(targetUrl, attempt);
                currentImage = extractMicrolinkImage(current);
              } catch (attemptError) {
                if (CONFIG.websocket.debugPayload) {
                  console.warn("[Hipe Multichat] Intento Microlink falló, se probará el siguiente", {
                    url: targetUrl,
                    attempt,
                    error: String(attemptError?.message || attemptError)
                  });
                }
                continue;
              }

              if (isUsefulTwitchImage(currentImage) && !isGenericTwitchMetadata(current)) {
                data = current;
                image = currentImage;
                twitchPreviewCache.set(targetUrl, current);
                twitchPreviewCache.set(canonicalUrl, current);
                saveStoredTwitchPreview(targetUrl, current, currentImage);
                saveStoredTwitchPreview(canonicalUrl, current, currentImage);
                break;
              }

              if (CONFIG.websocket.debugPayload) {
                console.warn("[Hipe Multichat] Microlink devolvió metadata genérica o sin miniatura útil", {
                  url: targetUrl,
                  attempt,
                  title: current?.title,
                  description: current?.description,
                  image: currentImage
                });
              }
            }

            if (data && image) break;
          }
        }

        if (!data || !isUsefulTwitchImage(image)) {
          const retryCount = Number(preview.retryCount || 0);
          if (retryCount < 1) {
            setTimeout(() => {
              const retryNode = rootNode.querySelector(`[data-preview-id="${cssEscapeValue(preview.previewId)}"]`);
              if (!retryNode) return;
              hydrateTwitchPreview({ ...preview, retryCount: retryCount + 1 }, rootNode);
            }, 7000);
          }
          return;
        }

        const display = normalizeTwitchPreviewDisplay({
          title: data.title || (preview.twitchKind === "video" ? "Video de Twitch" : "Clip de Twitch"),
          channel: data.channel || data.publisher || data.author || data.provider || "Twitch"
        });

        const resolvedPreview = {
          title: display.title,
          channel: display.channel,
          thumbnail_url: image
        };

        saveStoredTwitchPreview(canonicalUrl, resolvedPreview, image);
        activateTwitchPreviewNode(node, resolvedPreview);
      } catch (error) {
        if (CONFIG.websocket.debugPayload) {
          console.warn("[Hipe Multichat] No se pudo cargar preview de Twitch con Microlink", error);
        }
      }
    }

    function hydrateYouTubePreviews(rootNode, item = {}) {
      if (!CONFIG.showYouTubeLinkPreviews || !rootNode || !item.linkPreview) return;
      if (item.linkPreview.needsHydration && item.linkPreview.videoId) {
        hydrateYouTubePreview(item.linkPreview, rootNode);
      } else if (item.linkPreview.needsHydration && String(item.linkPreview.type || "").toLowerCase() === "twitch") {
        hydrateTwitchPreview(item.linkPreview, rootNode);
      }
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
      ].filter((candidate) => candidate && typeof candidate === "object");

      const source = candidates[0] || {};
      const sourceUser = firstValue(
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

      const rawUser = firstValue(
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

      const text = firstValue(
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
        item.isReply ||
        item.reply ||
        item.replyInfo ||
        item.replyParent ||
        item.replyMessage ||
        item.parentMessage ||
        item.repliedTo ||
        item.replyUser ||
        item.replyUsername ||
        item.replyParentUsername ||
        item.replyToUsername ||
        (item._message && item._message.isReply) ||
        (item._data && item._data.isReply)
      );

      return {
        isReply: hasReply,
        user: String(rawUser || "").trim().replace(/^@+/, ""),
        text: String(text || "").trim()
      };
    }



    function renderReplyPreview(item = {}) {
      const reply = resolveReplyInfo(item);
      if (!reply.isReply) return "";

      const userHtml = reply.user
        ? `<span class="reply-preview-user">@${escapeHtml(reply.user)}</span>`
        : `<span class="reply-preview-user">Respuesta</span>`;

      const textHtml = reply.text
        ? `<span class="reply-preview-text">${escapeHtml(reply.text)}</span>`
        : `<span class="reply-preview-text">Mensaje anterior</span>`;

      return `<div class="reply-preview">${userHtml}${textHtml}</div>`;
    }

    /* --- Ajuste v90: helpers para borrar mensajes moderados por messageId --- */
    function resolvePayloadMessageId(item = {}) {
      return String(firstValue(
        item.messageId,
        item.msgId,
        item.id,
        item.targetMessageId,
        item.target_message_id,
        item._message && item._message.msgId,
        item._message && item._message.messageId,
        item._data && item._data.messageId,
        item._data && item._data.message_id,
        item._data && item._data.msgId,
        item._data && item._data.message && item._data.message.msgId,
        item._data && item._data.message && item._data.message.messageId,
        ""
      ) || "").trim();
    }

    function messageIdAttr(item = {}) {
      const id = resolvePayloadMessageId(item);
      return id ? ` data-message-id="${escapeHtml(id)}"` : "";
    }

    /* --- Ajuste v92: conservar userId para borrar mensajes al ban/timeout --- */
    function resolvePayloadUserId(item = {}) {
      return String(firstValue(
        item.userId,
        item.user_id,
        item.id,
        item._user && item._user.id,
        item._message && item._message.userId,
        item._message && item._message.user_id,
        item._data && item._data.user && item._data.user.id,
        item._data && item._data.message && item._data.message.userId,
        item._data && item._data.message && item._data.message.user_id,
        ""
      ) || "").trim();
    }

    function userIdAttr(item = {}) {
      const id = resolvePayloadUserId(item);
      return id ? ` data-user-id="${escapeHtml(id)}"` : "";
    }

    function isUnicodeEmojiOnlyMessage(value = "") {
      const raw = String(value || "").trim();
      if (!raw) return false;

      // v36: YouTube/Twemoji puede venir como emoji unicode normal. En esos casos no siempre
      // coincide con nombres de emote tipo "ButtonMash"; si el mensaje es solo emojis,
      // debe salir en su propia línea y no apretarse junto a nombres largos.
      const withoutWhitespace = raw.replace(/\s+/g, "");
      if (!withoutWhitespace) return false;

      const withoutEmojiPresentation = withoutWhitespace
        .replace(/[\uFE0E\uFE0F]/g, "")
        .replace(/\u200D/g, "");

      if (!withoutEmojiPresentation) return false;
      if (/[\p{L}\p{N}]/u.test(withoutEmojiPresentation)) return false;

      const emojiMatches = withoutWhitespace.match(/\p{Extended_Pictographic}/gu) || [];
      return emojiMatches.length > 0;
    }

    function messageTemplate(item = {}) {
      const platform = normalizePlatform(item.platform);
      const messageRaw = String(item.message || "");
      const isGigantify = isGigantifyPowerUp(item);

      const emoteRender = renderMessageContent(messageRaw, item.emotes || [], {
        forceLarge: false,
        emoteOnly: false
      });

      const gigantifyRender = isGigantify ? renderGigantifyContent(messageRaw, item.emotes || []) : null;
      const hasMedia = Array.isArray(item.images) && item.images.length > 0;
      const hasPreview = Boolean(item.linkPreview);
      const hasAnyEmote = Array.isArray(item.emotes) && item.emotes.length > 0;
      const normalizeEmoteLayoutToken = (value) => String(value || "")
        .trim()
        .toLowerCase()
        .replace(/^:+|:+$/g, "");
      const emoteNamesForLayout = new Set(
        normalizeEmotes(item.emotes || [])
          .flatMap((emote) => {
            const name = normalizeEmoteLayoutToken(emote.name);
            const id = normalizeEmoteLayoutToken(emote.id);
            return [name, id].filter(Boolean);
          })
      );
      const emoteOnlyByTokens = hasAnyEmote && Boolean(messageRaw.trim()) && messageRaw.trim().split(/\s+/).every((part) => {
        const token = normalizeEmoteLayoutToken(part);
        return token && emoteNamesForLayout.has(token);
      });
      const normalizedEmotesForLayout = normalizeEmotes(item.emotes || []);
      const emoteOnlyByExactJoin = hasAnyEmote && (() => {
        const normalizedMessage = normalizeEmoteLayoutToken(messageRaw).replace(/:+/g, "").replace(/\s+/g, "");
        const normalizedEmoteSequence = normalizedEmotesForLayout
          .map((emote) => normalizeEmoteLayoutToken(emote.name).replace(/:+/g, ""))
          .filter(Boolean)
          .join("");
        return Boolean(normalizedMessage && normalizedEmoteSequence && normalizedMessage === normalizedEmoteSequence);
      })();
      const emoteOnlyByRanges = hasAnyEmote && (() => {
        let rest = String(messageRaw || "");
        normalizedEmotesForLayout
          .slice()
          .sort((a, b) => Number(b.start ?? -1) - Number(a.start ?? -1))
          .forEach((emote) => {
            const start = Number(emote.start);
            const end = Number(emote.end);
            if (Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end >= start) {
              rest = rest.slice(0, start) + rest.slice(end + 1);
            }
          });
        return Boolean(rest.trim() === "" && normalizedEmotesForLayout.length);
      })();
      const emoteOnlyByUnicodeEmoji = hasAnyEmote && isUnicodeEmojiOnlyMessage(messageRaw);
      const emoteOnlyMessage = emoteOnlyByTokens || emoteOnlyByExactJoin || emoteOnlyByRanges || emoteOnlyByUnicodeEmoji;
      const emoteOnlyCount = emoteOnlyMessage ? normalizedEmotesForLayout.length : 0;
      const emoteOnlyNeedsOwnLine = emoteOnlyMessage && emoteOnlyCount > 5;
      const replyInfo = resolveReplyInfo(item);
      const longMessage = !isGigantify && (
        replyInfo.isReply ||
        emoteOnlyNeedsOwnLine ||
        !CONFIG.inlineChat ||
        hasMedia ||
        hasPreview ||
        (!emoteOnlyMessage && messageRaw.length > CONFIG.longMessageThreshold) ||
        (!CONFIG.inlineChat && !emoteOnlyMessage && hasAnyEmote && messageRaw.length > 24)
      );
      const nameColor = readableNameColor(item.nameColor || item.userColor || item.color);
      const nameStyle = nameColor ? ` style="color:${escapeHtml(nameColor)}"` : "";
      const hasAvatar = CONFIG.showAvatar;
      const showUsername = CONFIG.showUsername;
      const pronouns = String(item.pronouns || "").trim();

      const avatarHtml = hasAvatar ? avatarNode(resolveAvatar(item), "avatar", item) : "";
      const timeHtml = CONFIG.showTimestamp ? `<span class="time-pill">${escapeHtml(item.time || currentTime())}</span>` : "";
      const platformHtml = CONFIG.showPlatform ? `<span class="platform-icon platform-${escapeHtml(platform)}">${icon(platform)}</span>` : "";
      const badgesHtml = renderBadges(item.badges);
      const badgeStateClass = badgesHtml ? " has-badges" : " no-badges";
      const pronounsHtml = CONFIG.showPronouns && pronouns ? `<span class="pronouns">${escapeHtml(pronouns)}</span>` : "";
      const usernameHtml = showUsername ? `<span class="username-wrap"><span class="name"${nameStyle}>${escapeHtml(item.username || "Usuario")}</span><span class="separator">:</span></span>` : "";
      /* --- Ajuste v120: inline fluido; el texto ocupa el ancho disponible y baja solo cuando topa --- */
      // v58: emote-only normal usa el mismo layout que "hola" (.message-flow).
      // Antes se mandaba a .message-head por !emoteOnlyMessage y cambiaba el espaciado entre hora/badges.
      const simpleTextFlow = !isGigantify && !replyInfo.isReply && !hasMedia && !hasPreview && CONFIG.inlineChat;
      const messageClass = `message-content${emoteRender.emoteOnly ? " emote-only" : ""}${longMessage ? "" : " inline"}`;
      const mediaHtml = renderImages(item.images);
      const previewHtml = renderLinkPreview(item.linkPreview);
      const mentionClass = shouldHighlightMention(messageRaw) ? " highlight-mention" : "";
      const bubbleClass = CONFIG.chatBubbles ? " chat-bubble" : "";
      const firstMessageClass = item.firstMessage ? " first-message" : "";
      const firstMessageHtml = item.firstMessage ? `<span class="first-message-pill">Primer mensaje</span>` : "";
      const messageIdHtmlAttr = messageIdAttr(item);
      const replyClass = replyInfo.isReply ? " reply-row" : "";
      const replyPillHtml = "";
      const replyPreviewHtml = "";
      const replySection = replyInfo.isReply ? `
            <div class="reply-outer">
              <div class="reply-line">
                <span class="reply-line-arrow">↪</span>
                <span class="reply-line-label">Respondiendo a</span>
                <span class="reply-line-user">${replyInfo.user ? `@${escapeHtml(replyInfo.user)}` : "mensaje anterior"}</span>
                <span class="reply-line-sep">:</span>
                <span class="reply-line-text">${escapeHtml(replyInfo.text || "Mensaje anterior")}</span>
              </div>
            </div>
      ` : "";

      return `
        <article class="chat-row ${platform}${hasAvatar ? "" : " no-avatar"}${badgeStateClass}${isGigantify ? " powerup-gigantify" : ""}${mentionClass}${firstMessageClass}${replyClass}${bubbleClass}${simpleTextFlow ? " simple-text-flow" : ""}" data-platform="${escapeHtml(platform)}" data-user="${escapeHtml(normalizeChatterToken(item.username || ""))}"${userIdAttr(item)}${messageIdHtmlAttr}>
          ${avatarHtml}
          <div class="message-block">
            ${simpleTextFlow ? `
              <div class="message-flow">
                ${timeHtml}
                ${platformHtml}
                ${firstMessageHtml}
                ${badgesHtml}
                ${pronounsHtml}
                ${usernameHtml}
                <span class="message-flow-text"${messageIdHtmlAttr}>${emoteRender.html}</span>
              </div>
            ` : `
              ${replyPreviewHtml}
              <div class="message-head">
                ${timeHtml}
                ${platformHtml}
                ${firstMessageHtml}
                ${replyPillHtml}
                ${badgesHtml}
                ${pronounsHtml}
                ${usernameHtml}
                ${isGigantify ? "" : (longMessage ? "" : `<span class="${messageClass}"${messageIdHtmlAttr}>${emoteRender.html}</span>`)}
              </div>
              ${replySection}
              ${isGigantify && gigantifyRender.textHtml ? `<div class="message-content gigantify-text-line"${messageIdHtmlAttr}>${gigantifyRender.textHtml}</div>` : ""}
              ${isGigantify && gigantifyRender.largeEmotesHtml ? `<div class="gigantify-content${gigantifyRender.pixel ? " big-pixel" : ""}"${messageIdHtmlAttr}>${gigantifyRender.largeEmotesHtml}</div>` : ""}
              ${!isGigantify && longMessage ? `<span class="${messageClass}"${messageIdHtmlAttr}>${emoteRender.html}</span>` : ""}
              ${!isGigantify ? mediaHtml : ""}
              ${!isGigantify ? previewHtml : ""}
            `}
          </div>
        </article>
      `;
    }

    function normalizeRewardTitle(value) {
      const text = String(value ?? "").trim();
      if (!text) return "";
      const lower = text.toLowerCase();
      if (
        lower === "recompensa" ||
        lower === "recompensa canjeada" ||
        lower === "channel point redemption" ||
        lower === "canje" ||
        lower === "canjeó"
      ) return "";
      return text;
    }

    function getRewardTitle(item = {}) {
      const candidates = [
        item.rewardTitle,
        item.rewardName,
        item.redemptionTitle,
        item.title,
        item.reward && item.reward.title,
        item.reward && item.reward.name,
        item._data && item._data.reward && item._data.reward.title,
        item._data && item._data.reward && item._data.reward.name,
        item.data && item.data.reward && item.data.reward.title,
        item.data && item.data.reward && item.data.reward.name
      ];

      for (const candidate of candidates) {
        const clean = normalizeRewardTitle(candidate);
        if (clean) return clean;
      }

      return "";
    }

    function getRewardCost(item = {}) {
      const candidates = [
        item.rewardCost,
        item.cost,
        item.points,
        item.amount,
        item.reward && item.reward.cost,
        item._data && item._data.reward && item._data.reward.cost,
        item.data && item.data.reward && item.data.reward.cost
      ];

      for (const candidate of candidates) {
        const text = String(candidate ?? "").trim();
        if (!text) continue;
        return /puntos?$/i.test(text) ? text : `${text} puntos`;
      }

      return "";
    }

    function buildAmountWithSuffixInlineHtml(displayAmount = "", displayAmountSuffix = "") {
      const amountText = String(displayAmount || "").trim();
      const suffixText = String(displayAmountSuffix || "").trim();
      if (!amountText && !suffixText) return "<strong></strong>";
      return `<strong>${escapeHtml(amountText)}${suffixText ? `<span class="amount-suffix-inline">${escapeHtml(displayAmountSuffix)}</span>` : ""}</strong>`;
    }

    function buildRewardAmountInlineHtml(displayAmount = "") {
      const amountText = String(displayAmount || "").trim();
      if (!amountText) return "<strong></strong>";

      // Prueba visual v25: en canjes, ocultar "por X puntos" para evitar tarjetas demasiado largas.
      // No modifica mapped.amount, rewardCost, cost ni points; solo cambia el HTML mostrado.
      const match = amountText.match(/^(.*?)(\s+por\s+)(.+?\s*puntos?)$/i);
      if (match && match[1]) return `<strong>${escapeHtml(match[1].trim())}</strong>`;

      return `<strong>${escapeHtml(amountText)}</strong>`;
    }

    function eventTemplate(item = {}) {
      const platform = normalizePlatform(item.platform);
      const platformCorner = CONFIG.showPlatform ? `<span class="event-platform-corner">${icon(platform)}</span>` : "";
      /* --- Ajuste v129: no pasar color del usuario a tarjetas de evento --- */
      const eventUserStyle = "";
      const hasAvatar = CONFIG.showAvatar;
      const eventCategoryClass = String(item.category || "")
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .trim();

      /* --- Ajuste v89: traducción visual de eventos Twitch sin cambiar layout --- */
      const eventTypeRaw = String(item.eventType || "Evento");
      const sourceEventRaw = String(firstValue(item._event && item._event.type, item.type, item.eventType, "")).toLowerCase();
      const categoryRaw = String(item.category || "");
      const eventTypeLower = eventTypeRaw.toLowerCase();
      const categoryLower = categoryRaw.toLowerCase();
      const compactEventType = eventTypeLower.replace(/[^a-z0-9]/g, "");
      const compactCategory = categoryLower.replace(/[^a-z0-9]/g, "");
      const compactSourceEvent = sourceEventRaw.replace(/[^a-z0-9]/g, "");

      const eventAmountRaw = String(firstValue(
        item.amount,
        item.total,
        item.communitySubGiftCount,
        item.giftCount,
        item.streak_count,
        item.streakCount,
        item.watchStreakCount,
        item.watchStreak,
        item.streak,
        item.count,
        item._data && item._data.total,
        item._data && item._data.communitySubGiftCount,
        item._data && item._data.giftCount,
        item._data && item._data.streak_count,
        item._data && item._data.streakCount,
        item._data && item._data.watchStreakCount,
        item._data && item._data.watchStreak,
        item._data && item._data.streak,
        item._data && item._data.count,
        ""
      )).trim();
      const resubMonthsRaw = String(firstValue(
        item.cumulativeMonths,
        item.cumulative_months,
        item.durationMonths,
        item.duration_months,
        item.months,
        item._data && item._data.cumulativeMonths,
        item._data && item._data.durationMonths,
        item._data && item._data.duration_months,
        ""
      )).trim();
      const giftRecipientRaw = String(firstValue(
        item.recipient && item.recipient.name,
        item.recipient && item.recipient.login,
        item._data && item._data.recipient && item._data.recipient.name,
        item._data && item._data.recipient && item._data.recipient.login,
        item.recipientName,
        item.recipient,
        /* --- Ajuste v98: en GiftSub v97 el receptor puede venir ya normalizado en amount --- */
        eventAmountRaw,
        ""
      )).trim();

      const isWatchStreakEvent = (
        categoryLower.includes("watchstreak") ||
        categoryLower.includes("streak") ||
        eventTypeLower.includes("watch streak") ||
        eventTypeLower.includes("watchstreak")
      );

      const isChannelPointRedemptionEvent = (
        categoryLower.includes("channelpointredemption") ||
        eventTypeLower.includes("channel point redemption")
      );

      const isMessageEffectEvent = (
        categoryLower.includes("automaticrewards") ||
        categoryLower.includes("messageeffect") ||
        sourceEventRaw === "automaticrewardredemption" ||
        eventTypeLower.includes("message effect")
      );

      const isFollowEvent = categoryLower.includes("newfollowers") || sourceEventRaw === "follow" || eventTypeLower === "follow";
      const isCheerEvent = categoryLower.includes("cheers") || sourceEventRaw === "cheer" || eventTypeLower === "cheer";
      const isRaidEvent = categoryLower.includes("raids") || sourceEventRaw === "raid" || eventTypeLower === "raid";
      /* --- Ajuste v97: GiftSub real no debe caer como Sub normal --- */
      const isGiftSubEvent = (
        sourceEventRaw === "giftsub" ||
        sourceEventRaw === "gift sub" ||
        eventTypeLower === "giftsub" ||
        eventTypeLower === "gift sub" ||
        eventTypeLower.includes("gift sub")
      );
      const isGiftBombEvent = (
        sourceEventRaw === "giftbomb" ||
        sourceEventRaw === "gift bomb" ||
        sourceEventRaw === "communitygift" ||
        eventTypeLower === "giftbomb" ||
        eventTypeLower === "gift bomb" ||
        eventTypeLower.includes("community gift")
      );
      const isReSubEvent = sourceEventRaw === "resub" || sourceEventRaw === "re-sub";
      const isSubEvent = (categoryLower.includes("newsubscribers") || eventTypeLower.includes("membership/sub")) && !isReSubEvent && !isGiftSubEvent && !isGiftBombEvent;
      const isAnnouncementEvent = sourceEventRaw === "announcement" || eventTypeLower.includes("announcement");
      const isKickKicksGiftedEvent = platform === "kick" && (
        sourceEventRaw === "sgifted" ||
        eventTypeLower.includes("sgifted") ||
        eventTypeLower.includes("kicks gifted") ||
        categoryLower.includes("gifts")
      );
      const isYouTubeSuperStickerEvent = (
        platform === "youtube" &&
        (
          compactCategory.includes("superstickers") ||
          compactCategory.includes("supersticker") ||
          compactSourceEvent.includes("superstickers") ||
          compactSourceEvent.includes("supersticker") ||
          compactEventType.includes("superstickers") ||
          compactEventType.includes("supersticker") ||
          Boolean(String(firstValue(
            item.stickerImageUrl,
            item.superStickerImageUrl,
            item.super_sticker_image_url,
            ""
          )).trim())
        )
      );
      const isYouTubeSuperChatEvent = (
        platform === "youtube" &&
        !isYouTubeSuperStickerEvent &&
        (
          compactCategory.includes("superchats") ||
          compactCategory.includes("superchat") ||
          compactSourceEvent.includes("superchats") ||
          compactSourceEvent.includes("superchat") ||
          compactEventType.includes("superchats") ||
          compactEventType.includes("superchat")
        )
      );
      const isYouTubeJewelsGiftedEvent = (
        platform === "youtube" &&
        (
          compactCategory.includes("gifts") ||
          compactSourceEvent.includes("jewelsgifted") ||
          compactEventType.includes("jewelsgifted") ||
          compactEventType.includes("jewelgift")
        )
      );
      const isHypeTrainEventCard = (
        categoryLower.includes("hypetrain") ||
        sourceEventRaw.includes("hypetrain") ||
        eventTypeLower.includes("tren del hype") ||
        eventTypeLower.includes("hype train")
      );
      const isTikTokGiftEvent = platform === "tiktok" && categoryLower.includes("gifts");
      const isTikTokLikeEvent = platform === "tiktok" && categoryLower.includes("likes");
      const isTikTokShareEvent = platform === "tiktok" && categoryLower.includes("shares");

      let displayEventType = eventTypeRaw;
      let displayAmount = String(item.amount || "");
      let displayAmountSuffix = "";
      let displayUsernameForTitle = String(item.username || "").trim();

      if (isWatchStreakEvent) {
        displayEventType = "lleva";
        displayAmount = eventAmountRaw;
        displayAmountSuffix = ` ${eventAmountRaw === "1" ? "stream seguido" : "streams seguidos"}`;
      } else if (isChannelPointRedemptionEvent) {
        displayEventType = "canjeó:";
        displayAmount = String(item.amount || "").trim();
      } else if (isMessageEffectEvent) {
        displayEventType = "activó:";
        displayAmount = String(firstValue(item.amount, "efecto de mensaje")).trim();
      } else if (isFollowEvent) {
        displayEventType = "siguió el canal";
        displayAmount = "";
      } else if (isKickKicksGiftedEvent) {
        displayEventType = "envió";
        displayAmount = eventAmountRaw ? `${eventAmountRaw} Kicks` : String(firstValue(item.message, item._data && item._data.kicks && item._data.kicks.name, "Kicks Gift"));
      } else if (isCheerEvent) {
        displayEventType = "envió";
        displayAmount = eventAmountRaw ? `${eventAmountRaw} ${eventAmountRaw === "1" ? "bit" : "bits"}` : "";
      } else if (isRaidEvent) {
        displayEventType = "llegó con";
        displayAmount = eventAmountRaw ? `${eventAmountRaw} ${eventAmountRaw === "1" ? "viewer" : "viewers"}` : "";
      } else if (isTikTokGiftEvent) {
        displayEventType = "envió";
        displayAmount = eventAmountRaw || displayAmount || String(firstValue(item.giftName, "regalo"));
      } else if (isTikTokLikeEvent) {
        displayEventType = "tocó";
        displayAmount = eventAmountRaw ? `${eventAmountRaw} likes` : "like";
      } else if (isTikTokShareEvent) {
        displayEventType = "compartió";
        displayAmount = "el live";
      } else if (isGiftSubEvent) {
        displayEventType = "regaló una sub";
        if (giftRecipientRaw) {
          displayEventType = "regaló una sub a";
          displayAmount = giftRecipientRaw;
        } else {
          displayAmount = "";
        }
      } else if (isGiftBombEvent) {
        displayEventType = "regaló";
        displayAmount = eventAmountRaw ? `${eventAmountRaw} ${eventAmountRaw === "1" ? "sub" : "subs"}` : "";
      } else if (isReSubEvent) {
        const months = resubMonthsRaw || eventAmountRaw;
        displayEventType = months ? "lleva" : "renovó su suscripción";
        displayAmount = months || "";
        displayAmountSuffix = months ? ` ${months === "1" ? "mes suscrito" : "meses suscrito"}` : "";
      } else if (isSubEvent) {
        displayEventType = "se suscribió";
        displayAmount = "";
      } else if (isAnnouncementEvent) {
        displayUsernameForTitle = "Anuncio";
        displayEventType = "de";
        displayAmount = String(item.username || "").trim();
      } else if (isYouTubeJewelsGiftedEvent) {
        displayEventType = "envió";
        displayAmount = eventAmountRaw || displayAmount || String(firstValue(item.message, "un regalo"));
      } else if (isYouTubeSuperChatEvent) {
        displayEventType = "envió Super Chat";
        displayAmount = eventAmountRaw || displayAmount || "";
      } else if (isYouTubeSuperStickerEvent) {
        displayEventType = "envió Super Sticker";
        displayAmount = eventAmountRaw || displayAmount || "";
      } else if (platform === "youtube" && categoryLower.includes("memberships")) {
        if (sourceEventRaw.includes("membermilestone") || eventTypeLower.includes("member milestone")) {
          displayEventType = "cumplió";
          displayAmount = eventAmountRaw ? `${eventAmountRaw} meses de miembro` : "membresía";
        } else if (sourceEventRaw.includes("membershipgift") || eventTypeLower.includes("membership gift")) {
          displayEventType = "regaló";
          displayAmount = eventAmountRaw ? `${eventAmountRaw} membresías` : "membresías";
        } else if (sourceEventRaw.includes("giftmembershipreceived") || eventTypeLower.includes("gift membership received")) {
          displayEventType = "recibió una membresía de";
          displayAmount = eventAmountRaw || "";
        } else if (sourceEventRaw.includes("newsponsor") || eventTypeLower.includes("new sponsor")) {
          displayEventType = "se hizo miembro";
          displayAmount = "";
        } else {
          displayEventType = "se suscribió";
          displayAmount = eventAmountRaw || "";
        }
      } else if (platform === "youtube" && categoryLower.includes("newsubscribers")) {
        displayEventType = "se suscribió";
        displayAmount = "";
      } else if (isHypeTrainEventCard) {
        displayEventType = eventTypeRaw || "inició";
        displayAmount = eventAmountRaw;
      }

      const messageRender = renderMessageContent(String(item.message || ""), item.emotes || [], {
        forceLarge: false,
        emoteOnly: false
      });
      const eventMessageHtml = messageRender.html
        ? `<div class="event-message">${messageRender.html}</div>`
        : "";

      // v64: si el mapper ya resolvió stickerImageUrl, se pinta directo.
      // No dependemos otra vez de detectar el evento ni de buscar dentro del objeto.
      const superStickerDirectUrl = String(firstValue(
        item.stickerImageUrl,
        item.superStickerImageUrl,
        item.super_sticker_image_url,
        ""
      )).trim();

      const superStickerFallbackUrl = !superStickerDirectUrl && isYouTubeSuperStickerEvent
        ? findSuperStickerImageUrl([
            item.sticker,
            item.superSticker,
            item.super_sticker,
            item._data,
            item.data
          ])
        : "";

      const superStickerImageUrl = String(firstValue(superStickerDirectUrl, superStickerFallbackUrl, "")).trim();
      const shouldRenderSuperStickerImage =
        Boolean(superStickerImageUrl) &&
        isSafeUrl(superStickerImageUrl) &&
        !isLikelyProfileImageUrl(superStickerImageUrl);

      const superStickerHtml = shouldRenderSuperStickerImage
        ? `<div class="event-sticker event-supersticker-image"><img src="${escapeHtml(superStickerImageUrl)}" alt="Super Sticker" loading="eager" referrerpolicy="no-referrer" style="width:96px;height:96px;object-fit:contain;display:block;"></div>`
        : "";

      if (CONFIG.websocket.debugPayload && (isYouTubeSuperStickerEvent || superStickerDirectUrl)) {
        console.log("[Hipe Multichat SuperSticker image]", {
          direct: superStickerDirectUrl,
          fallback: superStickerFallbackUrl,
          final: superStickerImageUrl,
          shouldRender: shouldRenderSuperStickerImage,
          hasHtml: Boolean(superStickerHtml)
        });
      }

      return `
        <article class="event-card ${platform}${eventCategoryClass ? ` event-${eventCategoryClass}` : ""}${hasAvatar ? " has-avatar" : " no-avatar"}"${shouldRenderSuperStickerImage ? ` data-super-sticker-url="${escapeHtml(superStickerImageUrl)}"` : ""}>
          ${platformCorner}
          ${hasAvatar ? avatarNode(resolveAvatar(item), "event-avatar", item) : ""}
          <div>
            <div class="event-title">
              ${CONFIG.showUsername && displayUsernameForTitle ? `<span class="event-user"${eventUserStyle}>${escapeHtml(displayUsernameForTitle)}</span>` : ""}
              ${displayEventType ? `<span class="event-type">${escapeHtml(displayEventType)}</span>` : ""}
              ${isChannelPointRedemptionEvent ? buildRewardAmountInlineHtml(displayAmount) : buildAmountWithSuffixInlineHtml(displayAmount, displayAmountSuffix)}
            </div>
            ${eventMessageHtml}
            ${superStickerHtml}
          </div>
        </article>
      `;
    }

    function removeFallbackRows() {
      chatStack.querySelectorAll(".fallback-row").forEach((node) => node.remove());
    }

    function isNearScrollEnd(buffer = 54) {
      if (!chatScroll) return true;

      if (CONFIG.scrollDirection === "reversed") {
        return chatScroll.scrollTop <= buffer;
      }

      const distanceFromBottom = chatScroll.scrollHeight - chatScroll.scrollTop - chatScroll.clientHeight;
      return distanceFromBottom <= buffer;
    }

    function shouldFollowNewContent() {
      // En fuente OBS no hay lectura manual: siempre seguir el mensaje nuevo.
      if (CONFIG.scrollMode === "hidden") return true;

      // En Dock/Panel, si el usuario subió a leer mensajes viejos, no empujarlo al final.
      return isNearScrollEnd();
    }

    function finishNewContentScroll(shouldFollow) {
      trimMessages(shouldFollow);
      if (shouldFollow) scrollToBottom();
    }

    function schedulePreviewHydrationScroll(previewNode, shouldFollow = null) {
      // v55: los previews de YouTube/Twitch crecen después de insertar el mensaje.
      // En OBS/fuente siempre seguimos abajo.
      // En Dock/Panel seguimos abajo solo si el mensaje nació cuando el usuario estaba al final.
      // Si el usuario estaba leyendo arriba, no forzamos el scroll.
      if (!previewNode || !previewNode.isConnected) return;

      const row = previewNode.closest?.(".chat-row") || previewNode;
      const rowWantsFollow = row?.dataset?.followPreviewScroll === "1";
      const followPreview = shouldFollow ?? (CONFIG.scrollMode === "hidden" || rowWantsFollow || isNearScrollEnd());
      if (!followPreview) return;

      const follow = () => {
        if (!previewNode.isConnected) return;
        scrollToBottom();
      };

      requestAnimationFrame(follow);
      setTimeout(follow, 120);
      setTimeout(follow, 450);
      setTimeout(follow, 900);

      previewNode.querySelectorAll("img").forEach((img) => {
        if (img.complete) {
          requestAnimationFrame(follow);
          return;
        }
        img.addEventListener("load", follow, { once: true });
        img.addEventListener("error", follow, { once: true });
      });
    }

    function addGigantifyEffect(item = {}) {
      if (!shouldShowPayload(item)) return;

      const followNewContent = shouldFollowNewContent();
      if (CONFIG.removeFallback) removeFallbackRows();

      const render = renderGigantifyContent(String(item.message || ""), item.emotes || []);
      if (!render || !render.largeEmotesHtml) return;

      const method = CONFIG.scrollDirection === "reversed" ? "afterbegin" : "beforeend";
      chatStack.insertAdjacentHTML(
        method,
        `<article class="gigantify-effect-row" data-platform="${escapeHtml(normalizePlatform(item.platform))}" data-user="${escapeHtml(normalizeChatterToken(item.username || ""))}">
          <div class="gigantify-content${render.pixel ? " big-pixel" : ""}">${render.largeEmotesHtml}</div>
        </article>`
      );

      const node = CONFIG.scrollDirection === "reversed" ? chatStack.firstElementChild : chatStack.lastElementChild;
      scheduleHide(node, CONFIG.hideAfter);
      finishNewContentScroll(followNewContent);
    }

    async function enrichAvatarBeforeRender(item = {}) {
      if (!CONFIG.showAvatar) return item;
      if (isSystemAvatarEvent(item)) return item;

      const current = resolveAvatar(item);
      if (current) item.avatar = current;

      return item;
    }

    async function addMessage(item = {}) {
      if (!shouldShowPayload(item)) return;

      item = await enrichAvatarBeforeRender(item);

      const followNewContent = shouldFollowNewContent();

      if (CONFIG.removeFallback) removeFallbackRows();

      const last = chatStack.lastElementChild;
      const itemUser = String(item.username || "").trim().toLowerCase();
      const messageIdHtmlAttr = messageIdAttr(item);

      if (
        CONFIG.groupConsecutiveMessages &&
        itemUser &&
        last &&
        last.dataset &&
        last.dataset.user === itemUser &&
        last.dataset.platform === normalizePlatform(item.platform) &&
        !isGigantifyPowerUp(item) &&
        !item.linkPreview &&
        !item.firstMessage &&
        !resolveReplyInfo(item).isReply
      ) {
        /* --- Ajuste v99: no pegar mensajes consecutivos en la misma línea; agruparlos con flecha --- */
        last.querySelector(".message-block")?.insertAdjacentHTML(
          "beforeend",
          `<div class="grouped-message-line"><span class="grouped-message-arrow">↳</span><span class="message-content grouped-message-content"${messageIdHtmlAttr}>${renderMessageContent(String(item.message || ""), item.emotes || []).html}</span></div>`
        );
        scheduleHide(last, CONFIG.hideAfter);
        finishNewContentScroll(followNewContent);
        return;
      }

      const method = CONFIG.scrollDirection === "reversed" ? "afterbegin" : "beforeend";
      chatStack.insertAdjacentHTML(method, messageTemplate(item));
      const node = CONFIG.scrollDirection === "reversed" ? chatStack.firstElementChild : chatStack.lastElementChild;

      if (node && item.linkPreview && followNewContent) {
        node.dataset.followPreviewScroll = "1";
      }

      hydrateExternalAvatars(node);
      hydrateYouTubePreviews(node, item);
      scheduleHide(node, CONFIG.hideAfter);
      finishNewContentScroll(followNewContent);
    }

    function hydrateSuperStickerNode(node, item = {}) {
      if (!node) return;

      const direct = String(firstValue(
        item.stickerImageUrl,
        item.superStickerImageUrl,
        item.super_sticker_image_url,
        ""
      )).trim();

      const fallback = !direct ? findSuperStickerImageUrl([
        item.sticker,
        item.superSticker,
        item.super_sticker,
        item._data,
        item.data,
        item
      ]) : "";

      const url = String(firstValue(direct, fallback, "")).trim();
      const shouldRender =
        Boolean(url) &&
        isSafeUrl(url) &&
        !isLikelyProfileImageUrl(url);

      if (CONFIG.websocket.debugPayload && (direct || fallback || String(item.eventType || "").toLowerCase().includes("super sticker"))) {
        console.log("[Hipe Multichat SuperSticker DOM guard]", {
          direct,
          fallback,
          final: url,
          shouldRender,
          hasExisting: Boolean(node.querySelector(".event-sticker img")),
          category: item.category,
          eventType: item.eventType
        });
      }

      if (!shouldRender) return;

      node.dataset.superStickerUrl = url;

      if (node.querySelector(".event-sticker img")) return;

      const content = node.querySelector(".event-title")?.parentElement || node;
      const sticker = document.createElement("div");
      sticker.className = "event-sticker event-supersticker-image";
      sticker.innerHTML = `<img src="${escapeHtml(url)}" alt="Super Sticker" loading="eager" referrerpolicy="no-referrer" style="width:96px;height:96px;object-fit:contain;display:block;">`;
      content.appendChild(sticker);
    }

    async function addEvent(item = {}) {
      if (!shouldShowPayload(item)) return;

      item = await enrichAvatarBeforeRender(item);

      const followNewContent = shouldFollowNewContent();

      if (CONFIG.removeFallback) removeFallbackRows();

      const method = CONFIG.scrollDirection === "reversed" ? "afterbegin" : "beforeend";
      chatStack.insertAdjacentHTML(method, eventTemplate(item));
      const node = CONFIG.scrollDirection === "reversed" ? chatStack.firstElementChild : chatStack.lastElementChild;

      hydrateSuperStickerNode(node, item);
      hydrateExternalAvatars(node);
      scheduleHide(node, CONFIG.hideAfter);
      finishNewContentScroll(followNewContent);
    }

    function trimMessages(force = true) {
      // Si el usuario está leyendo mensajes antiguos en modo panel, no recortar de inmediato
      // para evitar saltos visuales. Se deja un colchón y se limpia cuando vuelva al final.
      const softLimit = CONFIG.maxMessages + 60;
      if (!force && chatStack.children.length <= softLimit) return;

      while (chatStack.children.length > CONFIG.maxMessages) {
        if (CONFIG.scrollDirection === "reversed") chatStack.lastElementChild?.remove();
        else chatStack.firstElementChild?.remove();
      }
    }

    function scrollToBottom() {
      requestAnimationFrame(() => {
        chatScroll.scrollTop = CONFIG.scrollDirection === "reversed" ? 0 : chatScroll.scrollHeight;
      });
    }

    function clearChat() {
      chatStack.innerHTML = "";
    }

    function hexToRgb(hex) {
      const clean = String(hex || "").replace("#", "").trim();
      const value = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
      const num = parseInt(value, 16);
      if (Number.isNaN(num)) return null;
      return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
    }

    function setPanelBackground(color, opacity) {
      const rgb = hexToRgb(color);
      if (rgb) {
        document.documentElement.style.setProperty("--panel-r", rgb.r);
        document.documentElement.style.setProperty("--panel-g", rgb.g);
        document.documentElement.style.setProperty("--panel-b", rgb.b);
      }
      const safeOpacity = Math.max(0, Math.min(1, Number(opacity)));
      document.documentElement.style.setProperty("--panel-opacity", Number.isFinite(safeOpacity) ? safeOpacity : CONFIG.canvasOpacity);
    }

    function setBubbleStyle(color, opacity, borderOpacity) {
      const rgb = hexToRgb(color);
      if (rgb) {
        document.documentElement.style.setProperty("--bubble-r", rgb.r);
        document.documentElement.style.setProperty("--bubble-g", rgb.g);
        document.documentElement.style.setProperty("--bubble-b", rgb.b);
      }

      const safeOpacity = Math.max(0, Math.min(1, Number(opacity)));
      if (Number.isFinite(safeOpacity)) {
        document.documentElement.style.setProperty("--bubble-opacity", safeOpacity);
      }

      const safeBorderOpacity = Math.max(0, Math.min(1, Number(borderOpacity)));
      if (Number.isFinite(safeBorderOpacity)) {
        document.documentElement.style.setProperty("--bubble-border-opacity", safeBorderOpacity);
      }
    }

    /* --- Ajuste v109: color de acento global; highlight y previews lo heredan --- */
    function setAccentColor(color) {
      const rgb = hexToRgb(color);
      if (!rgb) return;

      document.documentElement.style.setProperty("--accent-r", rgb.r);
      document.documentElement.style.setProperty("--accent-g", rgb.g);
      document.documentElement.style.setProperty("--accent-b", rgb.b);
      document.documentElement.style.setProperty("--highlight-r", rgb.r);
      document.documentElement.style.setProperty("--highlight-g", rgb.g);
      document.documentElement.style.setProperty("--highlight-b", rgb.b);
    }

    /* --- Ajuste v104: highlight solo permite cambiar color; opacidad/glow quedan fijos --- */
    function setHighlightStyle(color) {
      setAccentColor(color);
      document.documentElement.style.setProperty("--highlight-opacity", 0.16);
      document.documentElement.style.setProperty("--highlight-glow-opacity", 0.18);
    }


    function setChatLayout(options = {}) {
      const width = Number(options.width ?? CONFIG.chatWidth);
      const position = String((options.position ?? CONFIG.chatPosition) || "left").toLowerCase();
      const offsetX = Number(options.offsetX ?? CONFIG.chatOffsetX);
      const offsetY = Number(options.offsetY ?? CONFIG.chatOffsetY);
      const height = options.height ?? CONFIG.chatHeight;

      // v116: el ancho del chat ya no se reduce por default; se controla con el tamaño real de la fuente/canvas.
      // chatWidth queda solo como compatibilidad técnica si alguien lo manda explícitamente.
      if (Number.isFinite(width) && width > 240) {
        document.documentElement.style.setProperty("--chat-width", width + "px");
      } else {
        document.documentElement.style.setProperty("--chat-width", "100vw");
      }

      if (typeof height === "string" && height.trim()) {
        document.documentElement.style.setProperty("--chat-height", height.trim());
      } else if (Number.isFinite(Number(height)) && Number(height) > 120) {
        document.documentElement.style.setProperty("--chat-height", Number(height) + "px");
      }

      if (["left", "right", "center"].includes(position)) {
        scene.dataset.position = position;
      }

      if (Number.isFinite(offsetX)) {
        document.documentElement.style.setProperty("--chat-offset-x", offsetX + "px");
      }

      if (Number.isFinite(offsetY)) {
        document.documentElement.style.setProperty("--chat-offset-y", offsetY + "px");
      }
    }

    function setScrollbar(mode) {
      const safe = ["hidden", "elegant", "hover", "always"].includes(mode) ? mode : "hidden";
      chatScroll.classList.remove("scroll-hidden", "scroll-elegant", "scroll-hover", "scroll-always");
      chatScroll.classList.add("scroll-" + safe);
      CONFIG.scrollMode = safe;

      // v131: corrección; la función real es trimMessages(), no trimRows().
      // v130: si el scroll está pensado para dock/panel, conservar más historial.
      // hidden = fuente de OBS -> 80 mensajes. Modos con scroll visible -> 200 mensajes.
      CONFIG.maxMessages = safe === "hidden" ? 80 : 200;
      trimMessages();
    }

    chatScroll.addEventListener("scroll", () => {
      if (CONFIG.scrollMode !== "hidden" && isNearScrollEnd()) {
        trimMessages(true);
      }
    }, { passive: true });

    function startDemoLoop() {
      // v74: demo loop desactivado en versión de producción.
      return null;
    }

    /*
      Hipe Multichat - contrato de entrada v1

      Mensaje normal:
      {
        kind: "message" | "chat" | undefined,
        platform: "twitch" | "youtube" | "kick",
        username/displayName/user/name: string,
        message/text/rawInput: string,
        avatar/avatarUrl/profileImage/profileImageUrl/userProfileImageUrl: string,
        nameColor/userColor/color: "#hex",
        badges: ["heart","star","cam"] | [],
        pronouns: "él/ella/elle",
        emotes: [{ name/code/text, url/imageUrl/src, provider, start, end, pixel }],
        powerUpType/powerUp/power_up: "gigantify" | "message_effect" | "celebration",
        gigantify/isGigantify/gigantified: boolean,
        time/timestamp: string | number | Date
      }

      Evento destacado dentro del chat:
      {
        kind/type: "event" | "action" | "superchat" | "raid" | "sub" | "donation",
        platform: "twitch" | "youtube" | "kick",
        username/displayName/user/name: string,
        eventType/actionType: "Super Chat" | "Raid" | "Sub" | "Donation",
        amount: "50 MXN",
        message/text: string,
        avatar/avatarUrl/profileImage/profileImageUrl/userProfileImageUrl: string,
        nameColor/userColor/color: "#hex"
      }

      Config visual por URL o por JS:
      showPlatform, showAvatar, showTimestamp/showTimestamps, showBadges, showPronouns, showUsername
      font, fontSize, lineSpacing, chatBubbles, background/bg, backgroundOpacity/opacity
      hideAfter, excludeCommands, ignoreChatters, scrollDirection, groupConsecutiveMessages
      inlineChat, highlightMentions, embedImages, showYouTubeLinkPreviews
      scroll: hidden | elegant | hover | always
      position: left | right | center
      chatWidth/w, chatHeight/height/h, offsetX/x, offsetY/y, bg, opacity
      filtros URL: twitch.chatMessages=1, twitch.raids=0, youtube.superChats=1, kick.enabled=0
      WebSocket URL: connect=1, sbHost=127.0.0.1, sbPort=8080, wsUrl=ws://127.0.0.1:8080/, debugWS=1, debugPayload=1
    */

    function firstValue(...values) {
      for (const value of values) {
        if (value !== undefined && value !== null && String(value).trim() !== "") return value;
      }
      return "";
    }

    function deepFirstValue(...values) {
      for (const value of values) {
        if (value !== undefined && value !== null && String(value).trim() !== "") return value;
      }
      return "";
    }

    function normalizeBadgeList(value) {
      if (Array.isArray(value)) {
        return value
          .map((badge) => {
            if (typeof badge === "string") return { name: badge, imageUrl: "" };
            return {
              name: firstValue(badge.name, badge.title, badge.type, badge.id, badge.setId),
              imageUrl: firstValue(badge.imageUrl, badge.url, badge.src),
              version: firstValue(badge.version),
              info: firstValue(badge.info)
            };
          })
          .filter((badge) => badge.name || badge.imageUrl);
      }

      if (value && typeof value === "object") {
        return Object.keys(value)
          .filter(Boolean)
          .map((name) => ({ name, imageUrl: "" }));
      }

      return [];
    }

    function flagIsTrue(value) {
      if (value === true || value === 1) return true;
      const text = String(value ?? "").trim().toLowerCase();
      return text === "true" || text === "1" || text === "yes" || text === "y" || text === "on";
    }

    function youtubeRoleBadges(source = {}) {
      const user = source.user || {};
      const authorDetails = source.authorDetails || {};
      const badges = [];

      const isOwner = flagIsTrue(firstValue(
        user.isOwner,
        user.isChatOwner,
        user.IsOwner,
        user.IsChatOwner,
        authorDetails.isChatOwner,
        authorDetails.isOwner,
        source.isOwner,
        source.isChatOwner,
        source.IsChatOwner
      ));

      const isModerator = flagIsTrue(firstValue(
        user.isModerator,
        user.isChatModerator,
        user.IsModerator,
        user.IsChatModerator,
        authorDetails.isChatModerator,
        authorDetails.isModerator,
        source.isModerator,
        source.isChatModerator,
        source.IsChatModerator
      ));

      const isSponsor = flagIsTrue(firstValue(
        user.isSponsor,
        user.isChatSponsor,
        user.isMember,
        user.IsSponsor,
        user.IsChatSponsor,
        authorDetails.isChatSponsor,
        authorDetails.isSponsor,
        authorDetails.isMember,
        source.isSponsor,
        source.isChatSponsor,
        source.isMember,
        source.IsChatSponsor
      ));

      const isVerified = flagIsTrue(firstValue(
        user.isVerified,
        user.IsVerified,
        authorDetails.isVerified,
        source.isVerified,
        source.IsVerified
      ));

      if (isOwner) badges.push({ name: "youtube-owner", title: "Creador" });
      if (isModerator) badges.push({ name: "youtube-moderator", title: "Moderador" });
      if (isSponsor) badges.push({ name: "youtube-member", title: "Miembro" });
      if (isVerified) badges.push({ name: "youtube-verified", title: "Verificado" });

      return badges;
    }

    function normalizeEmoteList(value, parts = []) {
      const base = [];

      const partUrlByName = new Map();

      if (Array.isArray(parts)) {
        parts
          .filter((part) => String(part.type || "").toLowerCase() === "emote")
          .forEach((part) => {
            const name = String(firstValue(part.text, part.name)).trim();
            const url = String(firstValue(part.imageUrl, part.url, part.src)).trim();
            if (name && url) partUrlByName.set(name.toLowerCase(), url);

            base.push({
              name,
              imageUrl: url,
              source: firstValue(part.source, part.provider),
              zeroWidth: Boolean(part.zeroWidth),
              fromParts: true
            });
          });
      }

      if (Array.isArray(value)) {
        base.push(...value.map((emote) => ({ ...emote, fromParts: false })));
      } else if (value && typeof value === "object") {
        base.push(...Object.values(value).flat().filter(Boolean).map((emote) => ({ ...emote, fromParts: false })));
      }

      const normalized = base
        .filter((emote) => emote && typeof emote === "object")
        .map((emote) => {
          const name = String(firstValue(emote.name, emote.code, emote.text, emote.id)).trim();
          const lowerName = name.toLowerCase();
          const rawUrl = String(firstValue(emote.url, emote.imageUrl, emote.src)).trim();

          const startRaw = firstValue(emote.start, emote.startIndex);
          const endRaw = firstValue(emote.end, emote.endIndex);
          const providerHint = String(firstValue(emote.provider, emote.source, emote.type)).toLowerCase();
          const isTwemoji = providerHint.includes("twemoji");
          const isYouTubeColonToken =
            providerHint.includes("youtube") &&
            /^:[^\s:][\s\S]*:$/.test(name);

          // v34: Twemoji no debe cortarse por startIndex/endIndex porque emojis como 😅 pueden ocupar
          // varias unidades internas y el corte puede dejar caracteres rotos tipo �.
          // v56: YouTube puede mandar tokens tipo :face-red-droopy-eyes: con start/end desfasados.
          // Para esos emotes se ignora siempre el rango y se reemplaza por token textual.
          const hasRange = startRaw !== "" && endRaw !== "" && !isTwemoji && !isYouTubeColonToken;

          // Streamer.bot 1.0.5 alpha manda el mismo emote en "emotes" con 2.0
          // y en "parts" con 3.0. Conservamos el rango real, pero usamos la URL 3.0
          // cuando existe para que Gigantify/PowerUp se vea nítido.
          const upgradedUrl = !emote.fromParts && partUrlByName.has(lowerName)
            ? partUrlByName.get(lowerName)
            : rawUrl;

          const id = String(firstValue(emote.id, emote.emoteId)).trim();

          return {
            ...emote,
            name,
            imageUrl: upgradedUrl,
            id,
            _keyName: lowerName,
            _range: hasRange ? `${startRaw}-${endRaw}` : "no-range",
            _hasRange: hasRange
          };
        })
        .filter((emote) => emote.name && emote.imageUrl);

      const namesWithRange = new Set(
        normalized
          .filter((emote) => emote._hasRange)
          .map((emote) => emote._keyName)
      );

      const seen = new Set();
      return normalized.filter((emote) => {
        // Si el mismo emote ya existe con posición start/end, la copia de parts
        // solo servía para duplicarlo. Se descarta.
        if (emote.fromParts && namesWithRange.has(emote._keyName)) return false;

        const key = emote._hasRange
          ? `${emote._keyName}|${emote._range}`
          : `${emote._keyName}|no-range`;

        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function normalizePlatform(value) {
      const platform = String(value || "").toLowerCase();
      if (platform.includes("tiktok") || platform.includes("tikfinity") || platform === "tt") return "tiktok";
      if (platform.includes("youtube") || platform === "yt") return "youtube";
      if (platform.includes("kick")) return "kick";
      return "twitch";
    }

    function normalizeTime(value) {
      if (!value) return currentTime();

      if (value instanceof Date) {
        return value.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      }

      if (typeof value === "number") {
        return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      }

      const text = String(value || "").trim();

      if (/^\d{10,13}$/.test(text)) {
        const stamp = Number(text);
        const date = new Date(text.length <= 10 ? stamp * 1000 : stamp);
        if (!Number.isNaN(date.getTime())) {
          return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        }
      }

      if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
        const date = new Date(text);
        if (!Number.isNaN(date.getTime())) {
          return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        }
      }

      return text;
    }

    function toCamelFilterName(value) {
      const raw = String(value || "").trim();
      if (!raw) return "";
      const cleaned = raw
        .replace(/[_-]+/g, " ")
        .replace(/[^a-zA-Z0-9 ]/g, " ")
        .trim()
        .toLowerCase();

      return cleaned.replace(/\s+([a-z0-9])/g, (_, char) => char.toUpperCase());
    }

    function normalizeChatterToken(value = "") {
      return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/^@+/, "")
        .replace(/\s+/g, "")
        .replace(/[^a-z0-9_\-.]/g, "");
    }

    function parseList(value) {
      const list = Array.isArray(value) ? value : String(value || "").split(",");
      return list
        .map((item) => normalizeChatterToken(item))
        .filter(Boolean);
    }

    function isIgnoredChatter(username) {
      const name = normalizeChatterToken(username);
      return Boolean(name && CONFIG.ignoreChatters.includes(name));
    }

    function isCommandMessage(message) {
      if (!CONFIG.excludeCommands) return false;
      return String(message || "").trim().startsWith(CONFIG.commandPrefix || "!");
    }

    function getPayloadCategory(payload = {}) {
      return toCamelFilterName(firstValue(
        payload.category,
        payload.messageCategory,
        payload.eventCategory,
        payload.eventName,
        payload.eventType,
        payload.actionType,
        payload.type,
        payload.kind,
        "chatMessages"
      ));
    }

    function shouldShowPayload(payload = {}) {
      const platform = normalizePlatform(firstValue(payload.platform, payload.source));
      const username = firstValue(payload.username, payload.displayName, payload.userName, payload.user, payload.name, payload.author);
      const message = firstValue(payload.message, payload.text, payload.rawInput, payload.comment);
      const category = getPayloadCategory(payload);

      if (isIgnoredChatter(username)) return false;
      if (isCommandMessage(message)) return false;

      const platformFilters = CONFIG.filters[platform];
      if (!platformFilters) return true;

      if (platform === "kick" && platformFilters.enabled === false) return false;
      if (platform === "tiktok" && platformFilters.enabled === false) return false;

      if (Object.prototype.hasOwnProperty.call(platformFilters, category)) {
        const rule = platformFilters[category];
        return rule !== false && rule !== "hide";
      }

      return true;
    }

    function shouldHighlightMention(message) {
      if (!CONFIG.highlightMentions) return false;

      // No resaltar menciones detectadas dentro de links.
      // Ejemplo: twitch.tv/jsmoctezuma/clip/... no debe contar como mención.
      const text = String(message || "")
        .toLowerCase()
        .replace(/https?:\/\/\S+/gi, " ")
        .replace(/\bwww\.\S+/gi, " ");

      return CONFIG.streamerNames.some((name) => {
        const clean = String(name || "").trim().toLowerCase();
        return clean && text.includes(clean);
      });
    }

    function canEmbedImage(payload = {}) {
      const mode = String(CONFIG.embedImages || "off").toLowerCase();
      if (mode === "off" || mode === "0" || mode === "false") return false;
      if (mode === "all") return true;

      const roles = Array.isArray(payload.roles) ? payload.roles.map((role) => String(role).toLowerCase()) : [];
      const badges = Array.isArray(payload.badges) ? payload.badges.map((badge) => String(badge).toLowerCase()) : [];
      const joined = [...roles, ...badges];

      if (mode === "vip") return joined.some((role) => ["vip", "mod", "moderator", "broadcaster"].includes(role));
      if (mode === "mods") return joined.some((role) => ["mod", "moderator", "broadcaster"].includes(role));
      if (mode === "broadcaster") return joined.includes("broadcaster");

      return false;
    }

    function normalizeImages(payload = {}) {
      const images = Array.isArray(payload.images) ? payload.images : [];
      const imageUrl = firstValue(payload.imageUrl, payload.image, payload.mediaUrl);
      const all = imageUrl ? [imageUrl, ...images] : images;

      if (!canEmbedImage(payload)) return [];

      return all
        .map((url) => String(url || "").trim())
        .filter((url) => isSafeUrl(url))
        .slice(0, 4);
    }

    function normalizeLinkPreview(payload = {}) {
      if (!CONFIG.showYouTubeLinkPreviews) return null;

      const preview = payload.linkPreview || payload.youtubePreview || payload.twitchPreview || payload.preview;
      if (preview && typeof preview === "object") {
        const url = firstValue(preview.url, preview.link);
        const title = firstValue(preview.title, preview.text);
        const thumbnail = firstValue(preview.thumbnail, preview.thumbnailUrl, preview.image, preview.imageUrl, preview.thumbnail_url);
        const rawType = String(firstValue(preview.type, preview.site, preview.provider_name, "")).toLowerCase();
        const isTwitch = rawType.includes("twitch") || String(url || "").toLowerCase().includes("twitch.tv");
        const site = firstValue(preview.site, preview.domain, preview.provider_name, isTwitch ? "Twitch" : "YouTube");
        const channel = firstValue(preview.channel, preview.author, preview.authorName, preview.author_name, site);

        if (isTwitch && !thumbnail) return null;
        if (!title && !thumbnail && !url) return null;

        return {
          type: isTwitch ? "twitch" : "youtube",
          url,
          title: title || (isTwitch ? "Link de Twitch" : "Video de YouTube"),
          thumbnail,
          site,
          channel,
          twitchKind: isTwitch ? getTwitchPreviewKind(url) : ""
        };
      }

      const message = firstValue(payload.message, payload.text, payload.rawInput, payload.comment);
      return buildLinkPreviewFromText(message);
    }

    function scheduleHide(node, seconds) {
      const duration = Number(seconds);
      if (!Number.isFinite(duration) || duration <= 0 || !node) return;

      setTimeout(() => {
        node.style.transition = "opacity .35s ease, transform .35s ease";
        node.style.opacity = "0";
        node.style.transform = "translateY(-8px)";
        setTimeout(() => node.remove(), 420);
      }, duration * 1000);
    }

    /* --- Ajuste v128: cargar fuente de Google cuando se pide por URL; OBS no siempre la tiene instalada --- */
    function cssFontName(font) {
      const clean = String(font || "").trim().replace(/[;"<>]/g, "");
      if (!clean) return "Rajdhani";
      return /\s/.test(clean) ? `"${clean}"` : clean;
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

    function applyVisualConfig(options = {}) {
      const font = String((options.font ?? CONFIG.font) || "").trim();
      if (font) {
        CONFIG.font = font;
        loadGoogleFont(font);
        document.documentElement.style.setProperty("--font", `${cssFontName(font)}, Rajdhani, Arial, Helvetica, sans-serif`);
      }

      const fontSize = Number(options.fontSize ?? CONFIG.fontSize);
      if (Number.isFinite(fontSize) && fontSize > 8) {
        CONFIG.fontSize = fontSize;
        document.documentElement.style.setProperty("--font-size", fontSize + "px");
        document.documentElement.style.setProperty("--name-size", Math.round(fontSize * 1.08) + "px");
        document.documentElement.style.setProperty("--time-size", Math.max(14, Math.round(fontSize * .78)) + "px");

        /* --- Ajuste v117/v118: avatar, badges, iconos y tarjetas escalan con fontSize --- */
        /* --- Ajuste v118: avatars más compactos; las tarjetas/eventos ya no conservan avatar fijo gigante --- */
        /* --- Ajuste v121: el chat normal sigue compacto; eventos recuperan jerarquía visual --- */
        document.documentElement.style.setProperty("--avatar-size", Math.max(32, Math.round(fontSize * 1.62)) + "px");
        document.documentElement.style.setProperty("--event-avatar-size", Math.max(36, Math.round(fontSize * 1.95)) + "px");
        document.documentElement.style.setProperty("--badge-size", Math.max(17, Math.round(fontSize * .90)) + "px");
        document.documentElement.style.setProperty("--icon-size", Math.max(18, Math.round(fontSize * .95)) + "px");
        document.documentElement.style.setProperty("--event-platform-size", Math.max(18, Math.round(fontSize * .95)) + "px");
      }

      const lineSpacing = Number(options.lineSpacing ?? CONFIG.lineSpacing);
      if (Number.isFinite(lineSpacing) && lineSpacing > .7) {
        CONFIG.lineSpacing = lineSpacing;
        document.documentElement.style.setProperty("--line-height", lineSpacing);
        document.documentElement.style.setProperty("--row-gap", Math.max(6, Math.round(fontSize * Math.max(.42, lineSpacing * .5))) + "px");
      }

      const messageSpacing = Number(options.messageSpacing ?? CONFIG.messageSpacing);
      if (Number.isFinite(messageSpacing) && messageSpacing >= 0) {
        CONFIG.messageSpacing = messageSpacing;
        document.documentElement.style.setProperty("--row-gap", Math.max(0, Math.round(messageSpacing)) + "px");
      }

      if (Object.prototype.hasOwnProperty.call(options, "chatBubbles")) CONFIG.chatBubbles = Boolean(options.chatBubbles);
      if (Object.prototype.hasOwnProperty.call(options, "hideAfter")) CONFIG.hideAfter = Number(options.hideAfter) || 0;
      if (Object.prototype.hasOwnProperty.call(options, "excludeCommands")) CONFIG.excludeCommands = Boolean(options.excludeCommands);
      if (Object.prototype.hasOwnProperty.call(options, "commandPrefix")) CONFIG.commandPrefix = String(options.commandPrefix || "!");
      if (Object.prototype.hasOwnProperty.call(options, "ignoreChatters")) CONFIG.ignoreChatters = parseList(options.ignoreChatters);
      if (Object.prototype.hasOwnProperty.call(options, "scrollDirection")) CONFIG.scrollDirection = String(options.scrollDirection || "normal").toLowerCase();
      if (Object.prototype.hasOwnProperty.call(options, "groupConsecutiveMessages")) CONFIG.groupConsecutiveMessages = Boolean(options.groupConsecutiveMessages);
      if (Object.prototype.hasOwnProperty.call(options, "inlineChat")) CONFIG.inlineChat = Boolean(options.inlineChat);
      if (Object.prototype.hasOwnProperty.call(options, "highlightMentions")) CONFIG.highlightMentions = Boolean(options.highlightMentions);
      if (Object.prototype.hasOwnProperty.call(options, "streamerNames")) CONFIG.streamerNames = parseList(options.streamerNames);
      if (Object.prototype.hasOwnProperty.call(options, "embedImages")) CONFIG.embedImages = options.embedImages;
      if (Object.prototype.hasOwnProperty.call(options, "showYouTubeLinkPreviews")) CONFIG.showYouTubeLinkPreviews = Boolean(options.showYouTubeLinkPreviews);
    }

    function setFilter(platform, name, value) {
      const key = normalizePlatform(platform);
      if (!CONFIG.filters[key]) CONFIG.filters[key] = {};
      CONFIG.filters[key][toCamelFilterName(name)] = value;
    }

    function setFilters(filters = {}) {
      Object.entries(filters || {}).forEach(([platform, platformFilters]) => {
        Object.entries(platformFilters || {}).forEach(([name, value]) => {
          setFilter(platform, name, value);
        });
      });
    }

    function normalizeMessagePayload(payload = {}) {
      return {
        platform: normalizePlatform(firstValue(payload.platform, payload.source)),
        username: firstValue(payload.username, payload.displayName, payload.userName, payload.user, payload.name, payload.author),
        message: firstValue(payload.message, payload.text, payload.rawInput, payload.comment),
        avatar: firstValue(payload.avatar, payload.avatarUrl, payload.profileImage, payload.profileImageUrl, payload.profilePicture, payload.userProfileImageUrl),
        nameColor: firstValue(payload.nameColor, payload.userColor, payload.color),
        badges: Array.isArray(payload.badges) ? payload.badges : [],
        pronouns: firstValue(payload.pronouns, payload.pronoun),
        emotes: Array.isArray(payload.emotes) ? payload.emotes : [],
        images: normalizeImages(payload),
        linkPreview: normalizeLinkPreview(payload),
        roles: Array.isArray(payload.roles) ? payload.roles : [],
        powerUpType: firstValue(payload.powerUpType, payload.powerupType, payload.power_up, payload.powerUp),
        gigantify: Boolean(payload.gigantify || payload.isGigantify || payload.gigantified),
        time: normalizeTime(firstValue(payload.time, payload.timestamp, payload.createdAt)),
        category: getPayloadCategory(payload),

        // Reply real de Twitch/Streamer.bot: conservarlo al pasar por normalizeMessagePayload.
        firstMessage: Boolean(payload.firstMessage),
        isReply: Boolean(payload.isReply || payload.reply || payload.replyUser || payload.replyText),
        reply: payload.reply || "",
        replyUser: payload.replyUser || "",
        replyText: payload.replyText || "",
        _message: payload._message,
        _data: payload._data,
        _event: payload._event
      };
    }

    function normalizeEventPayload(payload = {}) {
      const currency = firstValue(payload.currency, payload.currencyCode);
      const numericAmount = firstValue(payload.amount, payload.value);
      const amount = firstValue(payload.amountText, payload.amountFormatted, numericAmount && currency ? `${numericAmount} ${currency}` : numericAmount);

      return {
        platform: normalizePlatform(firstValue(payload.platform, payload.source)),
        /* --- Ajuste v105: conservar category para que filtros de eventos funcionen (ej. twitch.cheers=0) --- */
        category: firstValue(payload.category, payload.messageCategory, payload.eventCategory, payload.eventName, payload.eventType, payload.actionType, payload.type, payload.kind),
        username: firstValue(payload.username, payload.displayName, payload.userName, payload.user, payload.name, payload.author),
        eventType: firstValue(payload.eventType, payload.actionType, payload.typeLabel, payload.title, "Evento"),
        amount,
        message: firstValue(payload.message, payload.text, payload.rawInput, payload.comment),
        avatar: firstValue(payload.avatar, payload.avatarUrl, payload.profileImage, payload.profileImageUrl, payload.profilePicture, payload.userProfileImageUrl),
        nameColor: firstValue(payload.nameColor, payload.userColor, payload.color),

        // v67: conservar datos especiales de eventos.
        // Antes normalizeEventPayload reconstruía el objeto y tiraba stickerImageUrl,
        // por eso SuperSticker llegaba al renderer sin imagen aunque el mapper sí la tuviera.
        stickerImageUrl: firstValue(payload.stickerImageUrl, payload.superStickerImageUrl, payload.super_sticker_image_url),
        superStickerImageUrl: firstValue(payload.superStickerImageUrl, payload.stickerImageUrl, payload.super_sticker_image_url),
        super_sticker_image_url: firstValue(payload.super_sticker_image_url, payload.superStickerImageUrl, payload.stickerImageUrl),
        sticker: payload.sticker,
        superSticker: payload.superSticker,
        super_sticker: payload.super_sticker,
        imageUrl: firstValue(payload.imageUrl, payload.image_url, payload.giftImageUrl, payload.gift_image_url, payload.url),
        giftImageUrl: firstValue(payload.giftImageUrl, payload.gift_image_url, payload.imageUrl, payload.image_url, payload.url),
        giftName: firstValue(payload.giftName, payload.gift_name, payload.giftTitle, payload.gift_title, payload.name, payload.altText),
        giftCount: firstValue(payload.giftCount, payload.gift_count, payload.quantity, payload.count, payload.comboCount),
        jewels: firstValue(payload.jewels, payload.jewelsAmount, payload.jewels_amount, payload.jewelCount, payload.jewel_count),
        rubies: firstValue(payload.rubies, payload.rubyCount, payload.ruby_count),
        images: payload.images,
        data: payload.data,
        _data: payload._data,
        _event: payload._event
      };
    }

    function isEventPayload(payload = {}) {
      const kind = String(firstValue(payload.kind, payload.type, payload.eventType, payload.actionType)).toLowerCase();
      return (
        kind.includes("event") ||
        kind.includes("action") ||
        kind.includes("superchat") ||
        kind.includes("super_chat") ||
        kind.includes("raid") ||
        kind.includes("sub") ||
        kind.includes("donation") ||
        kind.includes("jewel") ||
        kind.includes("gifted") ||
        kind.includes("gift") ||
        kind.includes("cheer") ||
        kind.includes("bits")
      );
    }

    function push(payload = {}) {
      if (isEventPayload(payload)) {
        const normalizedEvent = normalizeEventPayload(payload);

        if (
          CONFIG.websocket.debugPayload &&
          String(firstValue(normalizedEvent.eventType, normalizedEvent.category, payload.eventType, payload.category, "")).toLowerCase().includes("super")
        ) {
          console.log("[Hipe Multichat Event normalize]", {
            eventType: normalizedEvent.eventType,
            category: normalizedEvent.category,
            stickerImageUrl: normalizedEvent.stickerImageUrl,
            superStickerImageUrl: normalizedEvent.superStickerImageUrl,
            originalStickerImageUrl: payload.stickerImageUrl || payload.superStickerImageUrl || ""
          });
        }

        addEvent(normalizedEvent);
      } else {
        addMessage(normalizeMessagePayload(payload));
      }
    }

    function configure(options = {}) {
      applyVisualConfig(options);
      if (options.filters) setFilters(options.filters);

      if (Object.prototype.hasOwnProperty.call(options, "showPlatform")) CONFIG.showPlatform = Boolean(options.showPlatform);
      if (Object.prototype.hasOwnProperty.call(options, "showAvatar")) CONFIG.showAvatar = Boolean(options.showAvatar);
      if (Object.prototype.hasOwnProperty.call(options, "showTimestamp")) CONFIG.showTimestamp = Boolean(options.showTimestamp);
      if (Object.prototype.hasOwnProperty.call(options, "showBadges")) CONFIG.showBadges = Boolean(options.showBadges);
      if (Object.prototype.hasOwnProperty.call(options, "showPronouns")) CONFIG.showPronouns = Boolean(options.showPronouns);
      if (Object.prototype.hasOwnProperty.call(options, "showUsername")) CONFIG.showUsername = Boolean(options.showUsername);
      if (Object.prototype.hasOwnProperty.call(options, "customEmotes")) CONFIG.customEmotes = Boolean(options.customEmotes);
      if (Object.prototype.hasOwnProperty.call(options, "enlargeEmotes")) CONFIG.enlargeEmotes = Boolean(options.enlargeEmotes);
      if (Object.prototype.hasOwnProperty.call(options, "gigantifyEmotes")) CONFIG.gigantifyEmotes = Boolean(options.gigantifyEmotes);

      if (options.emoteSize) {
        CONFIG.emoteSize = Number(options.emoteSize);
        document.documentElement.style.setProperty("--emote-size", Number(options.emoteSize) + "px");
      }

      if (options.emoteLargeSize) {
        CONFIG.emoteLargeSize = Number(options.emoteLargeSize);
        document.documentElement.style.setProperty("--emote-large-size", Number(options.emoteLargeSize) + "px");
      }

      if (options.bg || Object.prototype.hasOwnProperty.call(options, "opacity")) {
        setPanelBackground(options.bg || CONFIG.canvasColor, options.opacity ?? CONFIG.canvasOpacity);
      }

      setChatLayout({
        width: options.chatWidth ?? options.width ?? CONFIG.chatWidth,
        position: options.position ?? CONFIG.chatPosition,
        offsetX: options.offsetX ?? CONFIG.chatOffsetX,
        offsetY: options.offsetY ?? CONFIG.chatOffsetY,
        height: options.chatHeight ?? options.height ?? CONFIG.chatHeight
      });

      if (options.scroll) setScrollbar(options.scroll);
    }

    const wsDebug = document.getElementById("wsDebug");
    const wsDebugText = document.getElementById("wsDebugText");
    const connectionStatus = document.getElementById("connectionStatus");
    const connectionStatusText = document.getElementById("connectionStatusText");
    let connectionStatusTimer = null;

    let streamerBotSocket = null;
    let reconnectTimer = null;
    let reconnectAttempts = 0;
    let tikfinitySocket = null;
    let tikfinityReconnectTimer = null;
    const tiktokLikeCache = new Map();

    function safeJson(value) {
      try {
        return JSON.stringify(value, null, 2);
      } catch (error) {
        return String(value);
      }
    }

    function wsLog(...args) {
      if (!CONFIG.websocket.debug) return;

      const printable = args.map((arg) => {
        if (arg && typeof arg === "object") return JSON.parse(JSON.stringify(arg));
        return arg;
      });

      console.log("[Hipe Multichat WS]", ...printable);

      if (CONFIG.websocket.debugPayload) {
        args.forEach((arg) => {
          if (arg && typeof arg === "object") {
            console.log("[Hipe Multichat WS JSON]\\n" + safeJson(arg));
          }
        });
      }
    }

    function setConnectionState(state, label) {
      updateConnectionStatusBubble(state);

      if (!wsDebug || !wsDebugText) return;

      wsDebug.classList.toggle("show", CONFIG.websocket.debug);
      wsDebug.classList.remove("connected", "connecting", "disconnected");
      wsDebug.classList.add(state);

      wsDebugText.textContent = label || state.toUpperCase();
    }

    /* --- Ajuste v114: estado visible al centro del overlay cuando conecta/reconecta --- */
    function updateConnectionStatusBubble(state) {
      if (!connectionStatus || !connectionStatusText) return;

      clearTimeout(connectionStatusTimer);
      connectionStatus.classList.remove("is-visible", "is-connected", "is-connecting", "is-disconnected");

      if (state === "connected") {
        connectionStatusText.textContent = "Conectado";
        connectionStatus.classList.add("is-visible", "is-connected");

        connectionStatusTimer = setTimeout(() => {
          connectionStatus.classList.remove("is-visible", "is-connected");
        }, 1400);
        return;
      }

      connectionStatusText.textContent = "Conectando...";
      connectionStatus.classList.add("is-visible", state === "connecting" ? "is-connecting" : "is-disconnected");
    }

    function getStreamerBotWsUrl(options = {}) {
      const directUrl = String(options.url || CONFIG.websocket.url || "").trim();
      if (directUrl) return directUrl;

      const host = String(options.host || CONFIG.websocket.host || "127.0.0.1").trim();
      const port = Number(options.port || CONFIG.websocket.port || 8080);
      return `ws://${host}:${port}/`;
    }

    function sendStreamerBotRequest(payload) {
      if (!streamerBotSocket || streamerBotSocket.readyState !== WebSocket.OPEN) return false;

      try {
        streamerBotSocket.send(JSON.stringify(payload));
        wsLog("sent", payload);
        return true;
      } catch (error) {
        console.warn("[Hipe Multichat WS] No se pudo enviar request:", error);
        return false;
      }
    }

    function subscribeStreamerBotEvents() {
      if (!CONFIG.websocket.subscribe) return;

      // Suscripción tentativa y segura. Si Streamer.bot responde error, el overlay no se rompe.
      sendStreamerBotRequest({
        request: "Subscribe",
        id: "hipe-multichat-subscribe",
        events: {
          Twitch: [
            "ChatMessage",
            "Cheer",
            "Follow",
            "Sub",
            "ReSub",
            "GiftSub",
            "GiftBomb",
            "Raid",
            "Announcement",
            "RewardRedemption",
            "AutomaticRewardRedemption",
            "CustomPowerUpRedemption",
            "PowerUp",
            "WatchStreak",
            "WatchStreaks",
            "ChatMessageDeleted",
            "ChatCleared",
            "SharedChatMessageDeleted",
            "UserBanned",
            "UserTimedOut",
            "SharedChatUserBanned",
            "SharedChatUserTimedout",
            "ChatEmoteModeOn",
            "ChatEmoteModeOff",
            "ChatFollowerModeOn",
            "ChatFollowerModeOff",
            "ChatFollowerModeChanged",
            "ChatSlowModeOn",
            "ChatSlowModeOff",
            "ChatSlowModeChanged",
            "ChatSubscriberModeOn",
            "ChatSubscriberModeOff",
            "ChatUniqueModeOn",
            "ChatUniqueModeOff",
            "ShieldModeBegin",
            "ShieldModeEnd",
            "HypeTrainStart",
            "HypeTrainUpdate",
            "HypeTrainLevelUp",
            "HypeTrainEnd"
          ],
          YouTube: [
            "Message",
            "MessageDeleted",
            "UserBanned",
            "UserTimedout",
            "SuperChat",
            "SuperSticker",
            "JewelsGifted",
            "NewSponsor",
            "NewSubscriber",
            "MemberMilestone",
            "MembershipGift",
            "GiftMembershipReceived"
          ],
          Kick: [
            "ChatMessage",
            "Follow",
            "Subscription",
            "Resubscription",
            "GiftSubscription",
            "MassGiftSubscription",
            "RewardRedemption",
            "sGifted",
            "KicksGifted",
            "UserTimedOut",
            "UserBanned",
            "ViewerCountUpdate"
          ],
          General: [
            "Custom"
          ]
        }
      });
    }

    function extractUsefulPayload(raw) {
      if (!raw || typeof raw !== "object") return {};

      const event = raw.event || raw.data || raw.payload || raw.args || raw.message || raw;
      if (event && typeof event === "object") return event;

      return raw;
    }

    function flattenCandidatePayload(raw) {
      const root = raw && typeof raw === "object" ? raw : {};
      const rootEvent = root.event && typeof root.event === "object" ? root.event : {};
      const rootData = root.data && typeof root.data === "object" ? root.data : {};

      // v79: algunas pruebas/emulaciones de Kick llegan envueltas como:
      // General.Custom -> data.event = { source:"Kick", type:"Follow" } / data.data = payload real.
      // Si no se desempaqueta aquí, Hipe ve "General Custom" y lo bloquea como evento interno.
      const nestedEvent = rootData.event && typeof rootData.event === "object" ? rootData.event : {};
      const nestedData = rootData.data && typeof rootData.data === "object" ? rootData.data : {};
      const nestedSource = String(nestedEvent.source || "").toLowerCase();
      const shouldUnwrapNestedPlatformEvent =
        String(rootEvent.source || "").toLowerCase() === "general" &&
        String(rootEvent.type || "").toLowerCase() === "custom" &&
        nestedEvent.type &&
        (nestedSource === "kick" || nestedSource === "twitch" || nestedSource === "youtube");

      const event = shouldUnwrapNestedPlatformEvent ? nestedEvent : rootEvent;
      const data = shouldUnwrapNestedPlatformEvent ? nestedData : rootData;

      const messageObj = data.message && typeof data.message === "object" ? data.message : {};
      const userObj = data.user && typeof data.user === "object" ? data.user : {};
      const metaObj = data.meta && typeof data.meta === "object" ? data.meta : {};
      const args = root.args && typeof root.args === "object" ? root.args : {};
      const payload = root.payload && typeof root.payload === "object" ? root.payload : {};

      return {
        ...root,
        ...payload,
        ...event,
        ...data,
        ...args,

        _wrappedEvent: shouldUnwrapNestedPlatformEvent ? rootEvent : null,
        _wrappedData: shouldUnwrapNestedPlatformEvent ? rootData : null,
        _event: event,
        _data: data,
        _message: messageObj,
        _user: userObj,
        _meta: metaObj
      };
    }

    function inferPlatformFromPayload(payload = {}) {
      const explicit = firstValue(payload.platform, payload.source, payload.broadcastPlatform, payload.provider);
      if (explicit) return normalizePlatform(explicit);

      const text = JSON.stringify(payload).toLowerCase();
      if (text.includes("youtube")) return "youtube";
      if (text.includes("kick")) return "kick";
      return "twitch";
    }

    function getConfiguredAvatar(username, userId) {
      const login = String(username || "").trim().toLowerCase();
      const id = String(userId || "").trim();
      const map = CONFIG.avatarMap || {};

      return firstValue(
        login ? map[login] : "",
        id ? map[id] : "",
        CONFIG.defaultAvatarUrl
      );
    }

    /* --- Ajuste v93: tarjetas especiales para estados del chat y Hype Train --- */
    function streamerDisplayName() {
      return firstValue(
        CONFIG.streamerName,
        CONFIG.channelName,
        CONFIG.username,
        CONFIG.displayName,
        "Estado del chat"
      );
    }

    function streamerDisplayAvatar() {
      return firstValue(
        CONFIG.streamerAvatar,
        CONFIG.avatar,
        CONFIG.defaultAvatarUrl
      );
    }

    function titleCaseWords(value) {
      return String(value || "")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
    }

    function chatStateLabelFromEvent(lowerEvent = "", raw = {}) {
      const data = (raw && raw.data && typeof raw.data === "object") ? raw.data : {};
      const payload = (raw && raw.payload && typeof raw.payload === "object") ? raw.payload : {};
      const minutes = firstValue(
        data.follow_duration_minutes,
        data.followDurationMinutes,
        data.follower_mode_duration_minutes,
        data.followerModeDurationMinutes,
        data.wait_time_seconds,
        data.waitTimeSeconds,
        data.slowModeWaitTimeSeconds,
        data.duration,
        data.durationMinutes,
        data.slowModeDuration,
        data.slowModeDelay,
        data.delay,
        payload.follow_duration_minutes,
        payload.followDurationMinutes,
        payload.follower_mode_duration_minutes,
        payload.followerModeDurationMinutes,
        payload.wait_time_seconds,
        payload.waitTimeSeconds,
        payload.slowModeWaitTimeSeconds,
        payload.duration,
        payload.durationMinutes,
        payload.slowModeDuration,
        payload.slowModeDelay,
        payload.delay,
        ""
      );
      const minuteText = minutes ? `${minutes} ${Number(minutes) === 1 ? "minuto" : "minutos"}` : "";
      const secondText = minutes ? `${minutes} ${Number(minutes) === 1 ? "segundo" : "segundos"}` : "";

      if (lowerEvent.includes("chatemotemodeon")) return "modo solo emotes activado";
      if (lowerEvent.includes("chatemotemodeoff")) return "modo solo emotes desactivado";

      if (lowerEvent.includes("chatfollowermodechanged")) {
        return minuteText ? `modo seguidores cambiado a ${minuteText}` : "modo seguidores cambiado";
      }
      if (lowerEvent.includes("chatfollowermodeon")) {
        return minuteText ? `modo seguidores activado (${minuteText})` : "modo seguidores activado";
      }
      if (lowerEvent.includes("chatfollowermodeoff")) return "modo seguidores desactivado";

      if (lowerEvent.includes("chatslowmodechanged")) {
        return secondText ? `modo lento cambiado a ${secondText}` : "modo lento cambiado";
      }
      if (lowerEvent.includes("chatslowmodeon")) {
        return secondText ? `modo lento activado (${secondText})` : "modo lento activado";
      }
      if (lowerEvent.includes("chatslowmodeoff")) return "modo lento desactivado";

      if (lowerEvent.includes("chatsubscribermodeon")) return "modo solo suscriptores activado";
      if (lowerEvent.includes("chatsubscribermodeoff")) return "modo solo suscriptores desactivado";

      if (lowerEvent.includes("chatuniquemodeon")) return "modo único activado";
      if (lowerEvent.includes("chatuniquemodeoff")) return "modo único desactivado";

      if (lowerEvent.includes("shieldmodebegin")) return "modo escudo activado";
      if (lowerEvent.includes("shieldmodeend")) return "modo escudo desactivado";

      return "estado actualizado";
    }

    function isChatStateEvent(lowerEvent = "") {
      return (
        lowerEvent.includes("chatemotemode") ||
        lowerEvent.includes("chatfollowermode") ||
        lowerEvent.includes("chatslowmode") ||
        lowerEvent.includes("chatsubscribermode") ||
        lowerEvent.includes("chatuniquemode") ||
        lowerEvent.includes("shieldmode")
      );
    }

    function isHypeTrainEvent(lowerEvent = "") {
      return lowerEvent.includes("hypetrain");
    }

    function hypeTrainDisplayFromEvent(lowerEvent = "", payload = {}, dataObj = {}) {
      const level = firstValue(
        dataObj.level,
        dataObj.currentLevel,
        dataObj.levelNumber,
        payload.level,
        payload.currentLevel,
        payload.levelNumber,
        ""
      );
      const progress = firstValue(
        dataObj.progress,
        dataObj.total,
        payload.progress,
        payload.total,
        ""
      );
      const goal = firstValue(
        dataObj.goal,
        dataObj.target,
        payload.goal,
        payload.target,
        ""
      );

      const topList = Array.isArray(dataObj.top_contributions)
        ? dataObj.top_contributions
        : (Array.isArray(payload.top_contributions) ? payload.top_contributions : []);
      const top = topList[0] || {};
      const topName = firstValue(top.user_name, top.user_login, top.username, top.name, "");
      const topTypeRaw = String(firstValue(top.type, "")).toLowerCase();
      const topType = topTypeRaw.includes("sub") ? "suscripción" : (topTypeRaw.includes("bits") ? "bits" : topTypeRaw);
      const topText = topName ? `Top: ${topName}${topType ? ` · ${topType}` : ""}` : "";
      const progressText = progress && goal ? `${progress} / ${goal}` : (progress ? `${progress}` : "");
      const amountText = [level ? `Nivel ${level}` : "", progressText].filter(Boolean).join(" · ");

      if (lowerEvent.includes("hypetrainstart")) {
        return {
          type: "inició",
          amount: amountText,
          message: topText
        };
      }

      if (lowerEvent.includes("hypetrainlevelup")) {
        return {
          type: "subió de nivel",
          amount: level ? `Nivel ${level}` : amountText,
          message: topText || (progressText ? `Progreso: ${progressText}` : "")
        };
      }

      if (lowerEvent.includes("hypetrainend")) {
        return {
          type: "terminó",
          amount: amountText,
          message: topText
        };
      }

      return {
        type: "avanzó",
        amount: amountText || (progress ? `${progress}%` : ""),
        message: topText || (progressText ? `Progreso: ${progressText}` : "")
      };
    }

    function mapStreamerBotPayload(raw) {
      const payload = flattenCandidatePayload(raw);

      const eventObj = payload._event || {};
      const dataObj = payload._data || {};
      const messageObj = payload._message || {};
      const userObj = payload._user || {};
      const metaObj = payload._meta || {};
      const rewardObj = dataObj.reward && typeof dataObj.reward === "object" ? dataObj.reward : {};
      const eventSourceRaw = String(eventObj.source || payload.eventSource || payload.source || "").toLowerCase();
      const eventTypeRaw = String(eventObj.type || payload.eventType || payload.type || "").toLowerCase();
      const isGeneralCustom = eventSourceRaw === "general" && eventTypeRaw === "custom";
      const dataAction = String(dataObj.action || payload.action || "").toLowerCase();
      const dataType = String(dataObj.type || payload.type || "").toLowerCase();
      const dataWidget = String(dataObj.widget || payload.widget || "").toLowerCase();

      // Hipe Multichat no debe convertir eventos internos/telemetría en tarjetas de chat.
      // Streamer.bot puede mandar goalUpdate/streamState/viewers por General Custom,
      // y Kick puede mandar ViewerCountUpdate como evento directo.
      // Si los dejamos pasar, terminan como "Usuario ViewerCountUpdate".
      const isSilentInfrastructureEvent = (
        eventTypeRaw === "viewercountupdate" ||
        eventTypeRaw === "presentviewers" ||
        eventTypeRaw === "broadcasterchatconnected" ||
        eventTypeRaw === "broadcasterchatdisconnected" ||
        dataType === "hipe:viewers" ||
        dataAction === "viewerupdate" ||
        dataAction === "viewercountupdate"
      );

      const isInternalCustomEvent = isGeneralCustom && (
        dataAction === "goalupdate" ||
        dataAction === "bitsupdate" ||
        dataAction === "streamstate" ||
        dataAction === "categoryupdate" ||
        dataAction === "titleupdate" ||
        dataAction === "showfirstwords" ||
        dataAction === "showfic" ||
        dataAction === "showvip" ||
        dataType === "hipe:viewers" ||
        dataType === "hipe:alert" ||
        dataType === "hipe:activity" ||
        dataType === "follows" ||
        dataType === "subs" ||
        dataWidget === "metawidget" ||
        dataWidget === "goalwidget" ||
        dataWidget === "firstwordshud" ||
        dataWidget === "fichud" ||
        dataWidget === "viphud"
      );

      if (isSilentInfrastructureEvent || isInternalCustomEvent) {
        return null;
      }

      const eventName = firstValue(
        eventObj.type,
        eventObj.name,
        payload.eventName,
        payload.eventType,
        payload.actionType,
        payload.type,
        payload.name,
        payload.request,
        payload.eventSource
      );

      const lowerEvent = String(eventName || "").toLowerCase();

      const messageText = firstValue(
        messageObj.message,
        messageObj.text,
        messageObj.rawInput,
        messageObj.displayText,
        messageObj.body,
        messageObj.content,
        dataObj.text,
        dataObj.user_input,
        payload.rawInput,
        payload.message,
        payload.text,
        payload.comment,
        payload.userInput
      );

      const platform = normalizePlatform(firstValue(
        payload.platform,
        payload.source,
        payload.broadcastPlatform,
        payload.provider,
        eventObj.source
      ));

      const username = firstValue(
        messageObj.displayName,
        messageObj.username,
        messageObj.userName,
        dataObj.user_name,
        dataObj.user_login,
        dataObj.username,
        dataObj.displayName,
        userObj.displayName,
        userObj.name,
        userObj.login,
        userObj.userName,
        userObj.username,
        dataObj.targetUser && dataObj.targetUser.name,
        dataObj.targetUser && dataObj.targetUser.login,
        payload.targetUser && payload.targetUser.name,
        payload.targetUser && payload.targetUser.login,
        payload.username,
        payload.userName,
        payload.displayName,
        payload.user,
        payload.name,
        payload.author,
        payload.from
      );

      const userId = firstValue(
        messageObj.userId,
        dataObj.user_id,
        userObj.id,
        dataObj.user && dataObj.user.id,
        dataObj.redeemer && dataObj.redeemer.id,
        dataObj.targetUser && dataObj.targetUser.id,
        payload.user && payload.user.id,
        payload.redeemer && payload.redeemer.id,
        payload.targetUser && payload.targetUser.id,
        payload.userId,
        payload.user_id
      );

      const mapped = {
        ...payload,
        platform,
        username,
        userId,
        message: messageText,
        avatar: firstValue(
          messageObj.profileImageUrl,
          messageObj.profileImage,
          messageObj.avatar,
          messageObj.avatarUrl,
          dataObj.profileImageUrl,
          dataObj.profileImage,
          dataObj.avatar,
          dataObj.avatarUrl,
          dataObj.user && dataObj.user.profilePicture,
          dataObj.redeemer && dataObj.redeemer.profilePicture,
          userObj.profileImageUrl,
          userObj.profileImage,
          userObj.profilePicture,
          userObj.avatar,
          userObj.avatarUrl,
          payload.avatar,
          payload.avatarUrl,
          payload.profileImage,
          payload.profileImageUrl,
          payload.profilePicture,
          payload.userProfileImageUrl,
          payload.userProfileImage,
          getConfiguredAvatar(username, userId)
        ),
        nameColor: firstValue(
          messageObj.color,
          messageObj.nameColor,
          messageObj.userColor,
          userObj.color,
          userObj.nameColor,
          userObj.userColor,
          payload.nameColor,
          payload.userColor,
          payload.color,
          payload.displayColor
        ),
        badges: [
          ...normalizeBadgeList(firstValue(
            messageObj.badges,
            userObj.badges,
            metaObj.badges,
            payload.badges
          )),
          ...(platform === "youtube" ? youtubeRoleBadges({
            ...payload,
            ...dataObj,
            user: {
              ...(payload.user && typeof payload.user === "object" ? payload.user : {}),
              ...(dataObj.user && typeof dataObj.user === "object" ? dataObj.user : {}),
              ...(userObj && typeof userObj === "object" ? userObj : {})
            },
            authorDetails: firstValue(dataObj.authorDetails, payload.authorDetails, messageObj.authorDetails)
          }) : [])
        ],
        emotes: normalizeEmoteList(firstValue(
          messageObj.emotes,
          messageObj.cheerEmotes,
          dataObj.emotes,
          metaObj.emotes,
          payload.emotes
        ), dataObj.parts),
        pronouns: firstValue(messageObj.pronouns, userObj.pronouns, userObj.pronoun, payload.pronouns, payload.pronoun),
        time: normalizeTime(firstValue(payload.time, payload.timestamp, payload.timeStamp, raw.timeStamp, dataObj.redeemed_at, payload.createdAt)),
        category: getPayloadCategory({
          ...payload,
          type: eventObj.type || payload.type,
          eventType: eventObj.type || payload.eventType
        }),
        firstMessage: Boolean(
          messageObj.firstMessage ||
          metaObj.firstMessage ||
          dataObj.firstMessage ||
          payload.firstMessage
        ),
        isReply: Boolean(
          messageObj.isReply ||
          metaObj.isReply ||
          dataObj.isReply ||
          payload.isReply ||
          messageObj.reply ||
          dataObj.reply ||
          payload.reply
        ),
        reply: firstValue(
          messageObj.reply,
          messageObj.replyInfo,
          messageObj.replyParent,
          messageObj.replyMessage,
          dataObj.reply,
          dataObj.replyInfo,
          dataObj.replyParent,
          payload.reply,
          payload.replyInfo,
          payload.replyParent
        ),
        replyUser: firstValue(
          messageObj.replyUser,
          messageObj.replyUsername,
          messageObj.replyUserName,
          messageObj.replyParentUsername,
          messageObj.replyParentDisplayName,
          dataObj.replyUser,
          dataObj.replyUsername,
          payload.replyUser,
          payload.replyUsername,
          payload.replyToUsername
        ),
        replyText: firstValue(
          messageObj.replyText,
          messageObj.replyMessageText,
          messageObj.replyParentMessage,
          messageObj.replyParentText,
          dataObj.replyText,
          dataObj.replyMessageText,
          payload.replyText,
          payload.replyMessageText,
          payload.replyParentMessage
        )
      };

      if (isChatStateEvent(lowerEvent)) {
        mapped.kind = "event";
        mapped.category = "chatState";
        mapped.eventType = "de Chat:";
        mapped.amount = chatStateLabelFromEvent(lowerEvent, raw);
        mapped.message = "";
        mapped.username = "Moderación";
        mapped.avatar = "";
        mapped.userId = "";
        mapped.badges = [];
        mapped.nameColor = "";
        mapped.systemAvatar = "twitch";
        return mapped;
      }

      if (isHypeTrainEvent(lowerEvent)) {
        const hype = hypeTrainDisplayFromEvent(lowerEvent, payload, dataObj);
        mapped.kind = "event";
        mapped.category = "hypeTrain";
        mapped.eventType = hype.type;
        mapped.amount = hype.amount;
        mapped.message = firstValue(
          hype.message,
          mapped.message,
          dataObj.message,
          dataObj.systemMessage,
          payload.message,
          payload.systemMessage,
          ""
        );
        mapped.username = "🚂 Tren del Hype";
        mapped.avatar = "";
        mapped.systemAvatar = "twitch";
      }

      if (lowerEvent.includes("chatmessage") || lowerEvent.includes("message")) {
        mapped.kind = "message";
        mapped.category = "chatMessages";
      }

      if (lowerEvent.includes("superchat") || lowerEvent.includes("super_chat")) {
        mapped.kind = "event";
        mapped.eventType = "Super Chat";
        mapped.category = "superChats";
      }

      if (lowerEvent.includes("supersticker") || lowerEvent.includes("super_sticker")) {
        mapped.kind = "event";
        mapped.eventType = "Super Sticker";
        mapped.category = "superStickers";
        const explicitStickerImageUrl = String(firstValue(
          dataObj.stickerImageUrl,
          dataObj.superStickerImageUrl,
          dataObj.super_sticker_image_url,
          dataObj.imageUrl,
          dataObj.image_url,
          payload.stickerImageUrl,
          payload.superStickerImageUrl,
          payload.super_sticker_image_url,
          payload.imageUrl,
          payload.image_url,
          ""
        )).trim();

        const objectStickerImageUrl = findYouTubeSuperStickerObjectImage([
          dataObj,
          payload,
          dataObj.sticker,
          dataObj.superSticker,
          dataObj.super_sticker,
          payload.sticker,
          payload.superSticker,
          payload.super_sticker
        ]);

        const resolvedStickerImageUrl =
          explicitStickerImageUrl && isSafeUrl(explicitStickerImageUrl) && !isLikelyProfileImageUrl(explicitStickerImageUrl)
            ? explicitStickerImageUrl
            : String(firstValue(
                objectStickerImageUrl,
                findSuperStickerImageUrl([
                  dataObj.sticker,
                  dataObj.superSticker,
                  dataObj.super_sticker,
                  payload.sticker,
                  payload.superSticker,
                  payload.super_sticker,
                  dataObj,
                  payload
                ]),
                ""
              )).trim();

        mapped.stickerImageUrl = resolvedStickerImageUrl;
        mapped.superStickerImageUrl = resolvedStickerImageUrl;

        if (CONFIG.websocket.debugPayload) {
          console.log("[Hipe Multichat SuperSticker mapper lock]", {
            explicit: explicitStickerImageUrl,
            object: objectStickerImageUrl,
            resolved: resolvedStickerImageUrl,
            hasDataSticker: Boolean(dataObj.stickerImageUrl),
            hasPayloadSticker: Boolean(payload.stickerImageUrl),
            dataKeys: dataObj && typeof dataObj === "object" ? Object.keys(dataObj).slice(0, 20) : [],
            payloadKeys: payload && typeof payload === "object" ? Object.keys(payload).slice(0, 20) : []
          });
        }
        mapped.message = firstValue(
          mapped.message,
          dataObj.message,
          dataObj.messageText,
          dataObj.text,
          payload.message,
          payload.messageText,
          payload.text,
          ""
        );
        mapped.amount = firstValue(
          mapped.amount,
          dataObj.amountText,
          dataObj.amountFormatted,
          payload.amountText,
          payload.amountFormatted,
          dataObj.amount && dataObj.currency ? `${dataObj.amount} ${dataObj.currency}` : "",
          payload.amount && payload.currency ? `${payload.amount} ${payload.currency}` : "",
          dataObj.amount,
          payload.amount
        );
      }

      if (platform === "youtube" && lowerEvent.includes("jewelsgifted")) {
        const giftObj = firstValue(
          dataObj.gift,
          dataObj.jewelGift,
          dataObj.jewelsGift,
          dataObj.virtualGift,
          dataObj.item,
          payload.gift,
          payload.jewelGift,
          payload.jewelsGift,
          payload.virtualGift,
          payload.item,
          {}
        );

        const senderObj = firstValue(
          dataObj.user,
          dataObj.sender,
          dataObj.author,
          dataObj.fromUser,
          payload.user,
          payload.sender,
          payload.author,
          payload.fromUser,
          {}
        );

        const giftName = firstValue(
          giftObj && giftObj.name,
          giftObj && giftObj.title,
          giftObj && giftObj.displayName,
          giftObj && giftObj.label,
          dataObj.giftName,
          dataObj.gift_name,
          dataObj.giftTitle,
          dataObj.gift_title,
          dataObj.itemName,
          dataObj.item_name,
          dataObj.title,
          dataObj.name,
          payload.giftName,
          payload.gift_name,
          payload.giftTitle,
          payload.gift_title,
          payload.itemName,
          payload.item_name,
          payload.title,
          payload.name,
          "regalo"
        );

        const giftCount = firstValue(
          dataObj.giftCount,
          dataObj.gift_count,
          dataObj.quantity,
          dataObj.count,
          payload.giftCount,
          payload.gift_count,
          payload.quantity,
          payload.count,
          ""
        );

        const jewelAmount = firstValue(
          dataObj.jewels,
          dataObj.jewelsAmount,
          dataObj.jewels_amount,
          dataObj.jewelCount,
          dataObj.jewel_count,
          dataObj.amount,
          dataObj.value,
          payload.jewels,
          payload.jewelsAmount,
          payload.jewels_amount,
          payload.jewelCount,
          payload.jewel_count,
          payload.amount,
          payload.value,
          ""
        );

        const rubyAmount = firstValue(
          dataObj.rubies,
          dataObj.rubyCount,
          dataObj.ruby_count,
          payload.rubies,
          payload.rubyCount,
          payload.ruby_count,
          ""
        );

        const explicitGiftImage = String(firstValue(
          giftObj && giftObj.imageUrl,
          giftObj && giftObj.image_url,
          giftObj && giftObj.image,
          giftObj && giftObj.thumbnailUrl,
          giftObj && giftObj.thumbnail_url,
          giftObj && giftObj.url,
          dataObj.giftImageUrl,
          dataObj.gift_image_url,
          dataObj.imageUrl,
          dataObj.image_url,
          dataObj.url,
          payload.giftImageUrl,
          payload.gift_image_url,
          payload.imageUrl,
          payload.image_url,
          payload.url,
          ""
        )).trim();

        const foundGiftImage = String(firstValue(
          explicitGiftImage,
          findFirstImageUrl([giftObj, dataObj.url, payload.url, dataObj.giftImage, payload.giftImage, dataObj.images, payload.images]),
          ""
        )).trim();

        const resolvedGiftImage =
          foundGiftImage && isSafeUrl(foundGiftImage) && !isLikelyProfileImageUrl(foundGiftImage)
            ? foundGiftImage
            : "";

        mapped.kind = "event";
        mapped.eventType = "JewelsGifted";
        mapped.category = "gifts";
        mapped.username = firstValue(
          senderObj && senderObj.name,
          senderObj && senderObj.displayName,
          senderObj && senderObj.login,
          dataObj.userName,
          dataObj.user_name,
          dataObj.displayName,
          dataObj.authorName,
          dataObj.author_name,
          payload.userName,
          payload.user_name,
          payload.displayName,
          payload.authorName,
          payload.author_name,
          mapped.username,
          "Usuario"
        );
        mapped.userId = firstValue(
          senderObj && senderObj.id,
          senderObj && senderObj.channelId,
          senderObj && senderObj.channel_id,
          dataObj.userId,
          dataObj.user_id,
          dataObj.authorChannelId,
          dataObj.author_channel_id,
          payload.userId,
          payload.user_id,
          payload.authorChannelId,
          payload.author_channel_id,
          mapped.userId
        );
        mapped.avatar = firstValue(
          senderObj && senderObj.profilePicture,
          senderObj && senderObj.profileImageUrl,
          senderObj && senderObj.profileImage,
          senderObj && senderObj.avatar,
          senderObj && senderObj.avatarUrl,
          dataObj.profileImageUrl,
          dataObj.profileImage,
          dataObj.avatar,
          dataObj.avatarUrl,
          mapped.avatar
        );
        mapped.amount = giftCount && giftName
          ? `${giftCount}× ${giftName}`
          : String(giftName || "");
        mapped.message = firstValue(
          dataObj.userInput,
          dataObj.user_input,
          dataObj.message,
          dataObj.text,
          payload.userInput,
          payload.user_input,
          payload.message,
          payload.text,
          jewelAmount ? `${jewelAmount} ${Number(jewelAmount) === 1 ? "joya" : "joyas"}` : ""
        );
        mapped.giftName = giftName;
        mapped.giftCount = giftCount;
        mapped.jewels = jewelAmount;
        mapped.jewelsAmount = jewelAmount;
        mapped.rubies = rubyAmount;
        mapped.giftImageUrl = resolvedGiftImage;
        mapped.stickerImageUrl = resolvedGiftImage;
        mapped.superStickerImageUrl = resolvedGiftImage;

      }

      if (lowerEvent.includes("raid")) {
        mapped.kind = "event";
        mapped.eventType = "Raid";
        mapped.category = "raids";
        /* --- Ajuste v89: Raid toma canal y viewers reales de Streamer.bot --- */
        mapped.username = firstValue(
          mapped.username,
          dataObj.from_broadcaster_user_name,
          dataObj.from_broadcaster_user_login,
          payload.from_broadcaster_user_name,
          payload.from_broadcaster_user_login,
          dataObj.raider,
          payload.raider,
          "Usuario"
        );
        mapped.userId = firstValue(
          mapped.userId,
          dataObj.from_broadcaster_user_id,
          payload.from_broadcaster_user_id
        );
        mapped.amount = firstValue(
          mapped.amount,
          dataObj.viewers,
          payload.viewers,
          dataObj.viewerCount,
          payload.viewerCount,
          dataObj.count,
          payload.count
        );
      }

      if (lowerEvent.includes("cheer") || lowerEvent.includes("bits")) {
        mapped.kind = "event";
        mapped.eventType = "Cheer";
        mapped.category = "cheers";
      }

      if (lowerEvent.includes("announcement")) {
        /* --- Ajuste v107: mapear anuncios reales de Twitch como evento filtrable --- */
        mapped.kind = "event";
        mapped.eventType = "Announcement";
        mapped.category = "announcements";
        mapped.message = firstValue(
          mapped.message,
          dataObj.text,
          dataObj.message,
          payload.text,
          payload.message,
          dataObj.systemMessage,
          payload.systemMessage
        );
        mapped.amount = "";
      }

      if (
        lowerEvent.includes("watchstreak") ||
        lowerEvent.includes("watch streak") ||
        lowerEvent.includes("racha") ||
        lowerEvent.includes("streak")
      ) {
        mapped.kind = "event";
        mapped.eventType = "Watch Streak";
        mapped.category = "watchStreaks";
        mapped.message = firstValue(
          mapped.message,
          payload.streakText,
          dataObj.streakText,
          dataObj.message,
          dataObj.text,
          payload.message,
          payload.text
        );
        mapped.amount = firstValue(
          mapped.amount,
          payload.streak_count,
          dataObj.streak_count,
          payload.streakCount,
          dataObj.streakCount,
          payload.watchStreakCount,
          dataObj.watchStreakCount,
          payload.streak,
          payload.watchStreak,
          dataObj.streak,
          dataObj.watchStreak,
          dataObj.count,
          payload.count
        );
      }

      if (lowerEvent.includes("follow")) {
        mapped.kind = "event";
        mapped.eventType = "Follow";
        mapped.category = "newFollowers";
        mapped.username = firstValue(
          mapped.username,
          dataObj.targetUser && dataObj.targetUser.name,
          dataObj.targetUser && dataObj.targetUser.login,
          payload.targetUser && payload.targetUser.name,
          payload.targetUser && payload.targetUser.login,
          dataObj.user_name,
          dataObj.user_login,
          payload.user_name,
          payload.user_login,
          "Usuario"
        );
        mapped.userId = firstValue(
          mapped.userId,
          dataObj.targetUser && dataObj.targetUser.id,
          payload.targetUser && payload.targetUser.id,
          dataObj.user_id,
          payload.user_id
        );
        mapped.message = "";
        mapped.amount = "";
      }

      if (platform === "kick" && lowerEvent.includes("massgiftsubscription")) {
        mapped.kind = "event";
        mapped.eventType = "GiftBomb";
        mapped.category = "newSubscribers";
        mapped.username = firstValue(
          mapped.username,
          dataObj.user && dataObj.user.name,
          dataObj.user && dataObj.user.login,
          dataObj.gifter && dataObj.gifter.name,
          dataObj.gifter && dataObj.gifter.login,
          payload.user && payload.user.name,
          payload.user && payload.user.login,
          payload.gifter && payload.gifter.name,
          payload.gifter && payload.gifter.login,
          "Usuario"
        );
        mapped.amount = firstValue(
          dataObj.total,
          dataObj.count,
          dataObj.giftCount,
          dataObj.gift_count,
          dataObj.totalGiftedCount,
          dataObj.total_gifted_count,
          Array.isArray(dataObj.recipients) ? dataObj.recipients.length : "",
          payload.total,
          payload.count,
          payload.giftCount,
          payload.gift_count,
          payload.totalGiftedCount,
          payload.total_gifted_count,
          Array.isArray(payload.recipients) ? payload.recipients.length : "",
          mapped.amount
        );
        mapped.message = firstValue(
          dataObj.message,
          dataObj.text,
          payload.message,
          payload.text,
          mapped.amount ? `regaló ${mapped.amount} ${Number(mapped.amount) === 1 ? "sub" : "subs"}` : ""
        );
      } else if (platform === "kick" && lowerEvent.includes("giftsubscription")) {
        mapped.kind = "event";
        mapped.eventType = "GiftSub";
        mapped.category = "newSubscribers";
        mapped.username = firstValue(
          mapped.username,
          dataObj.user && dataObj.user.name,
          dataObj.user && dataObj.user.login,
          dataObj.gifter && dataObj.gifter.name,
          dataObj.gifter && dataObj.gifter.login,
          payload.user && payload.user.name,
          payload.user && payload.user.login,
          payload.gifter && payload.gifter.name,
          payload.gifter && payload.gifter.login,
          "Usuario"
        );
        mapped.recipientName = firstValue(
          dataObj.recipient && dataObj.recipient.name,
          dataObj.recipient && dataObj.recipient.login,
          dataObj.receiver && dataObj.receiver.name,
          dataObj.receiver && dataObj.receiver.login,
          dataObj.targetUser && dataObj.targetUser.name,
          dataObj.targetUser && dataObj.targetUser.login,
          payload.recipient && payload.recipient.name,
          payload.recipient && payload.recipient.login,
          payload.receiver && payload.receiver.name,
          payload.receiver && payload.receiver.login,
          payload.targetUser && payload.targetUser.name,
          payload.targetUser && payload.targetUser.login,
          dataObj.recipientName,
          payload.recipientName,
          ""
        );
        mapped.amount = firstValue(mapped.recipientName, mapped.amount);
        mapped.message = firstValue(dataObj.message, dataObj.text, payload.message, payload.text, "");
      } else if (platform === "kick" && lowerEvent.includes("resubscription")) {
        mapped.kind = "event";
        mapped.eventType = "ReSub";
        mapped.category = "newSubscribers";
        mapped.amount = firstValue(
          dataObj.months,
          dataObj.monthStreak,
          dataObj.streakMonths,
          dataObj.cumulativeMonths,
          dataObj.durationMonths,
          dataObj.duration,
          dataObj.user && dataObj.user.monthsSubscribed,
          payload.months,
          payload.monthStreak,
          payload.streakMonths,
          payload.cumulativeMonths,
          payload.durationMonths,
          payload.duration,
          payload.user && payload.user.monthsSubscribed,
          mapped.amount
        );
        mapped.message = firstValue(dataObj.message, dataObj.text, payload.message, payload.text, "");
      } else if (platform === "kick" && lowerEvent.includes("subscription")) {
        mapped.kind = "event";
        mapped.eventType = "Subscription";
        mapped.category = "newSubscribers";
        mapped.amount = firstValue(
          dataObj.months,
          dataObj.monthStreak,
          dataObj.streakMonths,
          dataObj.cumulativeMonths,
          dataObj.durationMonths,
          dataObj.duration,
          dataObj.user && dataObj.user.monthsSubscribed,
          payload.months,
          payload.monthStreak,
          payload.streakMonths,
          payload.cumulativeMonths,
          payload.durationMonths,
          payload.duration,
          payload.user && payload.user.monthsSubscribed,
          ""
        );
        mapped.message = firstValue(dataObj.message, dataObj.text, payload.message, payload.text, "");
      } else if (lowerEvent.includes("giftsub") || lowerEvent.includes("gift sub")) {
        const fromCommunityGift = Boolean(firstValue(
          dataObj.fromCommunitySubGift,
          payload.fromCommunitySubGift,
          false
        ));

        const communityGiftCount = Number(firstValue(
          dataObj.communitySubGiftCount,
          payload.communitySubGiftCount,
          0
        ));

        // v31: si el GiftSub viene como parte de un GiftBomb, no se muestra como tarjeta individual.
        // El evento principal GiftBomb ya muestra "regaló X subs" y el total acumulado.
        if (fromCommunityGift || communityGiftCount > 1) {
          return null;
        }

        mapped.kind = "event";
        mapped.eventType = "GiftSub";
        mapped.category = "newSubscribers";
        mapped.username = firstValue(mapped.username, dataObj.user && dataObj.user.name, dataObj.user && dataObj.user.login, payload.user && payload.user.name, payload.user && payload.user.login, dataObj.gifter, payload.gifter, "Usuario");
        mapped.nameColor = firstValue(mapped.nameColor, dataObj.user && dataObj.user.color, payload.user && payload.user.color);
        mapped.recipientName = firstValue(dataObj.recipient && dataObj.recipient.name, dataObj.recipient && dataObj.recipient.login, payload.recipient && payload.recipient.name, payload.recipient && payload.recipient.login, dataObj.recipientName, payload.recipientName, dataObj.recipient, payload.recipient, "");
        mapped.amount = firstValue(mapped.recipientName, mapped.amount);

        const giftTotal = firstValue(
          dataObj.cumlativeTotal,
          payload.cumlativeTotal,
          dataObj.cumulativeTotal,
          payload.cumulativeTotal,
          dataObj.cumulative_total,
          payload.cumulative_total,
          dataObj.communitySubGiftCumulativeTotal,
          payload.communitySubGiftCumulativeTotal,
          ""
        );

        const parsedGiftTotal = giftTotal && Number(giftTotal) > 0
          ? giftTotal
          : "";

        mapped.message = parsedGiftTotal ? `Ha regalado ${parsedGiftTotal} ${Number(parsedGiftTotal) === 1 ? "sub" : "subs"} en total` : "";
      } else if (lowerEvent.includes("giftbomb") || lowerEvent.includes("gift bomb") || lowerEvent.includes("communitygift") || lowerEvent.includes("community gift")) {
        mapped.kind = "event";
        mapped.eventType = "GiftBomb";
        mapped.category = "newSubscribers";
        mapped.amount = firstValue(
          dataObj.communitySubGiftCount,
          payload.communitySubGiftCount,
          dataObj.total,
          payload.total,
          dataObj.totalGiftedCount,
          payload.totalGiftedCount,
          dataObj.giftCount,
          payload.giftCount,
          dataObj.count,
          payload.count,
          mapped.amount
        );

        const giftBombTotal = firstValue(
          dataObj.communitySubGiftCumulativeTotal,
          dataObj.cumulativeTotal,
          dataObj.cumlativeTotal,
          dataObj.cumulative_total,
          payload.communitySubGiftCumulativeTotal,
          payload.cumulativeTotal,
          payload.cumlativeTotal,
          payload.cumulative_total,
          ""
        );
        mapped.message = giftBombTotal && Number(giftBombTotal) > 0 ? `Ha regalado ${giftBombTotal} ${Number(giftBombTotal) === 1 ? "sub" : "subs"} en total` : "";
      } else if (lowerEvent.includes("resub") || lowerEvent.includes("re-sub")) {
        mapped.kind = "event";
        mapped.eventType = "ReSub";
        mapped.category = "newSubscribers";
        // ReSub: la tarjeta visual ya sabe mostrar "lleva X meses suscrito"
        // si recibe mapped.amount. Antes los meses venían en el payload,
        // pero el mapper no los pasaba a amount.
        mapped.amount = firstValue(
          dataObj.cumulativeMonths,
          dataObj.cumulative_months,
          dataObj.months,
          dataObj.monthStreak,
          dataObj.streakMonths,
          dataObj.streak_months,
          dataObj.durationMonths,
          dataObj.duration_months,
          dataObj.user && dataObj.user.monthsSubscribed,
          dataObj.user && dataObj.user.cumulativeMonths,
          dataObj.message && dataObj.message.monthsSubscribed,
          dataObj.message && dataObj.message.cumulativeMonths,
          dataObj.message && dataObj.message.months,
          payload.cumulativeMonths,
          payload.cumulative_months,
          payload.months,
          payload.monthStreak,
          payload.streakMonths,
          payload.streak_months,
          payload.durationMonths,
          payload.duration_months,
          payload.user && payload.user.monthsSubscribed,
          payload.user && payload.user.cumulativeMonths,
          payload.message && payload.message.monthsSubscribed,
          payload.message && payload.message.cumulativeMonths,
          payload.message && payload.message.months,
          ""
        );
      } else if (platform === "youtube" && (lowerEvent.includes("membermilestone") || lowerEvent.includes("member_milestone"))) {
        mapped.kind = "event";
        mapped.eventType = "Member Milestone";
        mapped.category = "memberships";
        mapped.amount = firstValue(
          dataObj.memberMonths,
          dataObj.months,
          dataObj.cumulativeMonths,
          dataObj.cumulative_months,
          payload.memberMonths,
          payload.months,
          payload.cumulativeMonths,
          payload.cumulative_months,
          mapped.amount
        );
      } else if (platform === "youtube" && (lowerEvent.includes("membershipgift") || lowerEvent.includes("membership_gift"))) {
        mapped.kind = "event";
        mapped.eventType = "Membership Gift";
        mapped.category = "memberships";
        mapped.amount = firstValue(
          dataObj.count,
          dataObj.amount,
          dataObj.giftCount,
          dataObj.gift_count,
          payload.count,
          payload.amount,
          payload.giftCount,
          payload.gift_count,
          mapped.amount
        );
      } else if (platform === "youtube" && (lowerEvent.includes("giftmembershipreceived") || lowerEvent.includes("gift_membership_received"))) {
        mapped.kind = "event";
        mapped.eventType = "Gift Membership Received";
        mapped.category = "memberships";
        mapped.amount = firstValue(
          dataObj.gifterName,
          dataObj.gifter_name,
          dataObj.gifter && dataObj.gifter.name,
          dataObj.gifter && dataObj.gifter.login,
          dataObj.senderName,
          dataObj.sender_name,
          payload.gifterName,
          payload.gifter_name,
          payload.gifter && payload.gifter.name,
          payload.gifter && payload.gifter.login,
          payload.senderName,
          payload.sender_name,
          ""
        );
      } else if (platform === "youtube" && (lowerEvent.includes("newsponsor") || lowerEvent.includes("new_sponsor"))) {
        mapped.kind = "event";
        mapped.eventType = "New Sponsor";
        mapped.category = "memberships";
        mapped.amount = "";
      } else if (platform === "youtube" && (lowerEvent.includes("newsubscriber") || lowerEvent.includes("new_subscriber"))) {
        mapped.kind = "event";
        mapped.eventType = "New Subscriber";
        mapped.category = "newSubscribers";
        mapped.amount = "";
      } else if (lowerEvent.includes("sub") || lowerEvent.includes("sponsor") || lowerEvent.includes("membership")) {
        mapped.kind = "event";
        mapped.eventType = firstValue(mapped.eventType, "Membership/Sub");
        mapped.category = lowerEvent.includes("membership") || lowerEvent.includes("sponsor") ? "memberships" : "newSubscribers";
      }

      const automaticRewardType = String(firstValue(
        dataObj.reward_type,
        dataObj.rewardType,
        dataObj.type,
        payload.reward_type,
        payload.rewardType,
        payload.type,
        ""
      )).toLowerCase();

      if (
        (lowerEvent.includes("automaticrewardredemption") || lowerEvent.includes("automatic reward")) &&
        (
          automaticRewardType === "send_highlighted_message" ||
          automaticRewardType === "send highlighted message" ||
          automaticRewardType === "highlighted_message" ||
          automaticRewardType === "highlighted message"
        )
      ) {
        // v38: el mensaje resaltado ya llega como ChatMessage normal con meta.isHighlighted.
        // Ignoramos este canje automático para no duplicar ni mostrar "recompensa".
        mapped.__ignore = true;
      } else if (
        (lowerEvent.includes("automaticrewardredemption") || lowerEvent.includes("automatic reward")) &&
        (automaticRewardType === "message_effect" || automaticRewardType === "message effect")
      ) {
        mapped.kind = "event";
        mapped.eventType = "Message Effect";
        mapped.category = "automaticRewards";
        mapped.username = firstValue(mapped.username, dataObj.user_name, dataObj.user_login, dataObj.user && dataObj.user.name, dataObj.user && dataObj.user.login, "Usuario");
        mapped.userId = firstValue(mapped.userId, dataObj.user_id, payload.user_id, dataObj.user && dataObj.user.id, mapped.userId);
        mapped.amount = "efecto de mensaje";
        mapped.message = firstValue(
          dataObj.message_text,
          dataObj.messageText,
          dataObj.user_input,
          dataObj.userInput,
          payload.message_text,
          payload.messageText,
          payload.user_input,
          payload.userInput,
          mapped.message
        );
      } else if (lowerEvent.includes("reward") || lowerEvent.includes("redemption")) {
        mapped.kind = "event";
        mapped.eventType = "Channel Point Redemption";
        mapped.category = "channelPointRedemptions";
        mapped.username = firstValue(
          mapped.username,
          dataObj.user_name,
          dataObj.user_login,
          dataObj.user && dataObj.user.name,
          dataObj.user && dataObj.user.login,
          dataObj.redeemer && dataObj.redeemer.name,
          dataObj.redeemer && dataObj.redeemer.login,
          payload.user_name,
          payload.user_login,
          payload.user && payload.user.name,
          payload.user && payload.user.login,
          payload.redeemer && payload.redeemer.name,
          payload.redeemer && payload.redeemer.login,
          "Usuario"
        );
        mapped.userId = firstValue(
          mapped.userId,
          dataObj.user_id,
          dataObj.user && dataObj.user.id,
          dataObj.redeemer && dataObj.redeemer.id,
          payload.user_id,
          payload.user && payload.user.id,
          payload.redeemer && payload.redeemer.id,
          mapped.userId
        );

        const rewardTitle = firstValue(
          rewardObj.title,
          rewardObj.name,
          dataObj.rewardTitle,
          dataObj.rewardName,
          dataObj.redemptionTitle,
          dataObj.title,
          dataObj.reward && dataObj.reward.title,
          dataObj.reward && dataObj.reward.name,
          payload.rewardTitle,
          payload.rewardName,
          payload.redemptionTitle,
          payload.title,
          payload.reward && payload.reward.title,
          payload.reward && payload.reward.name
        );

        const rewardCost = firstValue(
          rewardObj.cost,
          dataObj.rewardCost,
          dataObj.cost,
          dataObj.points,
          dataObj.reward && dataObj.reward.cost,
          dataObj.reward && dataObj.reward.points,
          payload.rewardCost,
          payload.cost,
          payload.points,
          payload.reward && payload.reward.cost,
          payload.reward && payload.reward.points
        );

        const rewardTitleText = normalizeRewardTitle(rewardTitle);
        const rewardCostText = String(rewardCost || "").replace(/\s*puntos?\s*$/i, "").trim();

        if (rewardTitleText) {
          mapped.rewardTitle = rewardTitleText;
          mapped.rewardName = rewardTitleText;
          mapped.redemptionTitle = rewardTitleText;
          mapped.title = rewardTitleText;
        }

        if (rewardCostText) {
          mapped.rewardCost = rewardCostText;
          mapped.cost = rewardCostText;
          mapped.points = rewardCostText;
        }

        if (rewardTitleText && rewardCostText) {
          mapped.amount = `${rewardTitleText} por ${rewardCostText} puntos`;
        } else if (rewardTitleText) {
          mapped.amount = rewardTitleText;
        } else if (rewardCostText) {
          mapped.amount = `recompensa por ${rewardCostText} puntos`;
        } else {
          mapped.amount = "recompensa";
        }

        mapped.message = firstValue(dataObj.userInput, dataObj.user_input, payload.userInput, payload.user_input, rewardObj.prompt, mapped.message);
      }

      if (platform === "kick" && (lowerEvent.includes("sgifted") || lowerEvent.includes("kicksgifted") || lowerEvent.includes("kicks gifted"))) {
        mapped.kind = "event";
        mapped.eventType = "sGifted";
        mapped.category = "gifts";
        mapped.username = firstValue(
          mapped.username,
          dataObj.user && dataObj.user.name,
          dataObj.user && dataObj.user.login,
          payload.user && payload.user.name,
          payload.user && payload.user.login,
          "Usuario"
        );
        mapped.userId = firstValue(
          mapped.userId,
          dataObj.user && dataObj.user.id,
          payload.user && payload.user.id,
          mapped.userId
        );
        const kicksObj = dataObj.kicks && typeof dataObj.kicks === "object" ? dataObj.kicks : {};
        mapped.amount = firstValue(
          kicksObj.amount,
          dataObj.amount,
          payload.kicks && payload.kicks.amount,
          payload.amount,
          ""
        );
        mapped.message = firstValue(
          dataObj.rawInput,
          dataObj.rawInputEscaped,
          payload.rawInput,
          payload.rawInputEscaped,
          kicksObj.name,
          "Kicks Gift"
        );
        mapped.kicks = kicksObj;
      }

      if (lowerEvent.includes("powerup") || lowerEvent.includes("power-up") || lowerEvent.includes("gigantify")) {
        mapped.powerUpType = firstValue(payload.powerUpType, payload.powerupType, payload.power_up, payload.powerUp, dataObj.powerUpType, dataObj.powerupType, dataObj.power_up, dataObj.powerUp, eventName);
        mapped.powerUpName = firstValue(payload.powerUpName, payload.powerupName, payload.powerUpTitle, dataObj.powerUpName, dataObj.powerupName, dataObj.powerUpTitle, payload.title, dataObj.title);
        mapped.gigantify = lowerEvent.includes("gigantify") || Boolean(payload.gigantify || payload.isGigantify || payload.gigantified || dataObj.gigantify || dataObj.isGigantify || dataObj.gigantified);
        mapped.category = "powerUpRedemptions";
      }

      mapped.amount = firstValue(
        mapped.amount,
        payload.amountText,
        payload.amountFormatted,
        payload.amount && payload.currency ? `${payload.amount} ${payload.currency}` : "",
        payload.amount,
        payload.bits,
        payload.value,
        dataObj.amount,
        dataObj.bits,
        dataObj.value,
        messageObj.bits
      );

      if (looksLikeGigantifyChat(mapped, messageObj, metaObj)) {
        mapped.gigantify = true;
        mapped.powerUpType = "gigantify";
      }

      return mapped;
    }

    /* --- Ajuste v90: moderación Twitch, borrar mensaje y limpiar chat --- */
    function getRawEventInfo(raw = {}) {
      const root = raw && typeof raw === "object" ? raw : {};
      const rootEvent = root.event && typeof root.event === "object" ? root.event : {};
      const rootData = root.data && typeof root.data === "object" ? root.data : {};
      const nestedEvent = rootData.event && typeof rootData.event === "object" ? rootData.event : {};
      const nestedData = rootData.data && typeof rootData.data === "object" ? rootData.data : {};
      const nestedSource = String(nestedEvent.source || "").toLowerCase();

      const shouldUnwrapNestedPlatformEvent =
        String(rootEvent.source || "").toLowerCase() === "general" &&
        String(rootEvent.type || "").toLowerCase() === "custom" &&
        nestedEvent.type &&
        (nestedSource === "kick" || nestedSource === "twitch" || nestedSource === "youtube");

      const event = shouldUnwrapNestedPlatformEvent ? nestedEvent : rootEvent;
      const data = shouldUnwrapNestedPlatformEvent ? nestedData : rootData;
      const payload = root.payload && typeof root.payload === "object" ? root.payload : {};
      const type = String(firstValue(event.type, root.eventType, root.type, payload.type, data.type, "")).toLowerCase();
      const source = String(firstValue(event.source, root.eventSource, root.source, payload.source, data.source, "")).toLowerCase();
      return { root, event, data, payload, type, source, wrapped: shouldUnwrapNestedPlatformEvent };
    }

    function escapeRegExp(value = "") {
      return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function cssEscapeValue(value) {
      const raw = String(value || "");
      if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(raw);
      return raw.replace(/["\\]/g, "\\$&");
    }

    function removeRowIfEmpty(row) {
      if (!row || !row.classList || !row.classList.contains("chat-row")) return;
      const hasContent = row.querySelector(
        ".message-content, .message-flow-text, .gigantify-content, .message-media, .link-preview"
      );
      if (!hasContent) row.remove();
    }

    function normalizeModerationPlatform(value = "") {
      const platform = String(value || "").trim().toLowerCase();
      if (platform === "twitch" || platform === "youtube" || platform === "kick") return platform;
      return "";
    }

    function moderationPlatformFromInfo(info = {}) {
      return normalizeModerationPlatform(info.source || (info.event && info.event.source) || "");
    }

    function nodeMatchesModerationPlatform(node, platform = "") {
      const scopedPlatform = normalizeModerationPlatform(platform);
      if (!scopedPlatform) return true;
      const host = node && node.closest ? node.closest(".chat-row, .gigantify-effect-row") : node;
      const nodePlatform = normalizeModerationPlatform(host && host.dataset && host.dataset.platform);
      return nodePlatform === scopedPlatform;
    }

    function deleteChatMessageById(messageId, platform = "") {
      const id = String(messageId || "").trim();
      if (!id) return false;

      const selector = `[data-message-id="${cssEscapeValue(id)}"]`;
      const targets = Array.from(chatStack.querySelectorAll(selector))
        .filter((target) => nodeMatchesModerationPlatform(target, platform));
      if (!targets.length) return false;

      targets.forEach((target) => {
        const row = target.closest(".chat-row, .gigantify-effect-row");
        if (target.classList && (target.classList.contains("chat-row") || target.classList.contains("gigantify-effect-row"))) {
          target.remove();
          return;
        }

        const groupedLine = target.closest(".grouped-message-line");
        if (groupedLine) groupedLine.remove();
        else target.remove();
        removeRowIfEmpty(row);
      });

      return true;
    }

    function clearChatRowsOnly(platform = "") {
      const scopedPlatform = normalizeModerationPlatform(platform);

      if (!scopedPlatform) {
        chatStack.innerHTML = "";
        scrollToBottom();
        return true;
      }

      const targets = Array.from(chatStack.querySelectorAll(".chat-row, .gigantify-effect-row"))
        .filter((row) => normalizeModerationPlatform(row.dataset && row.dataset.platform) === scopedPlatform);

      targets.forEach((row) => row.remove());
      scrollToBottom();
      return targets.length > 0;
    }

    function normalizeModerationUserToken(value) {
      return normalizeChatterToken(value);
    }

    function getTargetUserFromRaw(raw = {}) {
      const info = getRawEventInfo(raw);
      const data = info.data || {};
      const payload = info.payload || {};
      const root = info.root || {};
      const target = (
        (data.targetUser && typeof data.targetUser === "object" ? data.targetUser : null) ||
        (data.target && typeof data.target === "object" ? data.target : null) ||
        (data.bannedUser && typeof data.bannedUser === "object" ? data.bannedUser : null) ||
        (data.timedOutUser && typeof data.timedOutUser === "object" ? data.timedOutUser : null) ||
        (payload.targetUser && typeof payload.targetUser === "object" ? payload.targetUser : null) ||
        (payload.target && typeof payload.target === "object" ? payload.target : null) ||
        (payload.bannedUser && typeof payload.bannedUser === "object" ? payload.bannedUser : null) ||
        (payload.timedOutUser && typeof payload.timedOutUser === "object" ? payload.timedOutUser : null) ||
        (root.targetUser && typeof root.targetUser === "object" ? root.targetUser : null) ||
        (data.user && typeof data.user === "object" ? data.user : null) ||
        (payload.user && typeof payload.user === "object" ? payload.user : null) ||
        {}
      );

      return {
        id: String(firstValue(
          target.id,
          target.userId,
          target.user_id,
          data.userId,
          data.user_id,
          data.targetUserId,
          data.target_user_id,
          payload.userId,
          payload.user_id,
          payload.targetUserId,
          payload.target_user_id,
          root.userId,
          root.user_id,
          ""
        ) || "").trim(),
        login: normalizeModerationUserToken(firstValue(
          target.login,
          target.userName,
          target.username,
          data.userName,
          data.user_name,
          data.userLogin,
          data.user_login,
          data.targetUserName,
          data.target_user_name,
          data.targetUserLogin,
          data.target_user_login,
          payload.userName,
          payload.user_name,
          payload.userLogin,
          payload.user_login,
          payload.targetUserName,
          payload.target_user_name,
          payload.targetUserLogin,
          payload.target_user_login,
          root.userName,
          root.user_name,
          ""
        )),
        name: normalizeModerationUserToken(firstValue(
          target.name,
          target.displayName,
          data.user,
          data.displayName,
          data.targetUserDisplayName,
          payload.user,
          payload.displayName,
          payload.targetUserDisplayName,
          root.user,
          root.displayName,
          ""
        ))
      };
    }

    function deleteChatMessagesByUser(targetUser = {}, platform = "") {
      const id = String(targetUser.id || "").trim();
      const login = normalizeModerationUserToken(targetUser.login);
      const name = normalizeModerationUserToken(targetUser.name);
      const scopedPlatform = normalizeModerationPlatform(platform);

      if (!id && !login && !name) return 0;

      const rows = Array.from(chatStack.querySelectorAll(".chat-row, .gigantify-effect-row"));
      let removed = 0;

      rows.forEach((row) => {
        const rowPlatform = normalizeModerationPlatform(row.dataset && row.dataset.platform);
        if (scopedPlatform && rowPlatform !== scopedPlatform) return;

        const rowUser = normalizeModerationUserToken(row.dataset && row.dataset.user);
        const rowUserId = String((row.dataset && row.dataset.userId) || "").trim();

        if (
          (id && rowUserId === id) ||
          (login && rowUser === login) ||
          (name && rowUser === name)
        ) {
          row.remove();
          removed += 1;
        }
      });

      scrollToBottom();
      return removed;
    }

    function getDeletedMessageIdFromRaw(raw = {}) {
      const info = getRawEventInfo(raw);
      const data = info.data || {};
      const payload = info.payload || {};
      const root = info.root || {};
      const message = data.message && typeof data.message === "object" ? data.message : {};
      const deletedMessage = data.deletedMessage && typeof data.deletedMessage === "object" ? data.deletedMessage : {};
      const targetMessage = data.targetMessage && typeof data.targetMessage === "object" ? data.targetMessage : {};

      return firstValue(
        data.messageId,
        data.message_id,
        data.msgId,
        data.id,
        data.targetMessageId,
        data.target_message_id,
        data.deletedMessageId,
        data.deleted_message_id,
        deletedMessage.id,
        deletedMessage.messageId,
        deletedMessage.message_id,
        targetMessage.id,
        targetMessage.messageId,
        targetMessage.message_id,
        message.id,
        message.messageId,
        message.msgId,
        payload.messageId,
        payload.message_id,
        payload.msgId,
        payload.id,
        payload.targetMessageId,
        payload.target_message_id,
        root.messageId,
        root.message_id,
        root.msgId,
        ""
      );
    }

    function handleTwitchModerationEvent(raw = {}) {
      const info = getRawEventInfo(raw);
      const type = info.type;
      const platform = moderationPlatformFromInfo(info);

      const isDeleted = (
        type.includes("chatmessagedeleted") ||
        type.includes("sharedchatmessagedeleted") ||
        type.includes("messagedeleted") ||
        type.includes("message_deleted") ||
        type.includes("delete_message")
      );

      const isCleared = (
        type.includes("chatcleared") ||
        type.includes("chat_cleared") ||
        type.includes("clearchat") ||
        type.includes("clear_chat")
      );

      const isUserBanOrTimeout = (
        type.includes("userbanned") ||
        type.includes("user_banned") ||
        type.includes("userban") ||
        type.includes("usertimedout") ||
        type.includes("user_timed_out") ||
        type.includes("timeout")
      );

      if (isDeleted) {
        const messageId = getDeletedMessageIdFromRaw(raw);
        const removed = deleteChatMessageById(messageId, platform);
        wsLog("moderation delete", { platform, messageId, removed });
        return true;
      }

      if (isCleared) {
        const removed = clearChatRowsOnly(platform);
        wsLog("moderation clear", { platform: platform || "all", removed });
        return true;
      }

      if (isUserBanOrTimeout) {
        const targetUser = getTargetUserFromRaw(raw);
        const removed = deleteChatMessagesByUser(targetUser, platform);
        wsLog("moderation user purge", { platform, targetUser, removed });
        return true;
      }

      return false;
    }

    function handleStreamerBotMessage(rawMessage) {
      let parsed = rawMessage;

      try {
        if (typeof rawMessage === "string") parsed = JSON.parse(rawMessage);
      } catch (error) {
        wsLog("raw text", rawMessage);
        return;
      }

      wsLog("received", parsed);

      if (handleTwitchModerationEvent(parsed)) {
        return;
      }

      const explicitGigantify = explicitGigantifyFromStreamerBotPayload(parsed);
      if (explicitGigantify) {
        if (CONFIG.websocket.debugPayload) {
          console.groupCollapsed("[Hipe Multichat] Gigantify explícito");
          console.table({
            platform: explicitGigantify.platform,
            username: explicitGigantify.username,
            message: explicitGigantify.message,
            emotes: explicitGigantify.emotes.length
          });
          console.groupEnd();
        }
        addGigantifyEffect(explicitGigantify);
        return;
      }

      const mapped = mapStreamerBotPayload(parsed);

      if (!mapped || mapped.__ignore) {
        return;
      }

      if (
        String(mapped.type || "").toLowerCase().includes("messagedeleted") ||
        String(mapped.eventType || "").toLowerCase().includes("messagedeleted")
      ) {
        return;
      }

      if (!mapped.message && !mapped.eventType && !mapped.amount) {
        return;
      }

      wsLog("mapped", mapped);

      if (CONFIG.websocket.debugPayload) {
        console.table({
          platform: mapped.platform,
          category: mapped.category,
          kind: mapped.kind,
          username: mapped.username,
          message: mapped.message,
          avatar: mapped.avatar,
          nameColor: mapped.nameColor,
          badges: Array.isArray(mapped.badges) ? mapped.badges.map((badge) => badge.name || badge).join(", ") : "",
          emotes: Array.isArray(mapped.emotes) ? mapped.emotes.length : 0,
          firstMessage: Boolean(mapped.firstMessage),
          isReply: Boolean(resolveReplyInfo(mapped).isReply),
          replyUser: resolveReplyInfo(mapped).user,
          gigantify: Boolean(mapped.gigantify || mapped.isGigantify || mapped.gigantified),
          eventType: mapped.eventType,
          amount: mapped.amount,
          stickerImageUrl: mapped.stickerImageUrl || mapped.superStickerImageUrl || ""
        });
      }

      if (!mapped.kind) {
        return;
      }

      push(mapped);
    }

    function shouldShowTikTokLike(data = {}) {
      const user = String(firstValue(data.uniqueId, data.userId, data.nickname, "anon") || "anon").toLowerCase();
      const likeCount = Number(data.likeCount) || 0;
      if (!user || likeCount <= 0) return false;

      const previous = tiktokLikeCache.get(user) || 0;
      const total = previous + likeCount;
      tiktokLikeCache.set(user, total);

      const previousBucket = Math.floor(previous / 1000);
      const nextBucket = Math.floor(total / 1000);
      if (nextBucket <= previousBucket) return false;

      data.__hipeLikeMilestone = nextBucket * 1000;
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
        const rawName = String(firstValue(emote.name, emote.emoteName, emote.emoteId, emote.id, data.emoteName, data.emoteId, "emote")).trim();
        const token = rawName.startsWith("[") ? rawName : `[${rawName}]`;
        const imageUrl = firstValue(
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

      if (!lower || lower === "config" || lower === "roomuser" || lower === "member" || lower === "livestatuschange") return null;

      const base = {
        platform: "tiktok",
        username: firstValue(data.nickname, data.uniqueId, data.username, data.userId, "Usuario TikTok"),
        userId: firstValue(data.userId, data.secUid, data.uniqueId, ""),
        avatar: firstValue(data.profilePictureUrl, data.avatarUrl, data.avatar, ""),
        nameColor: "#25f4ee",
        badges: [],
        emotes: normalizeTikFinityEmotes(data),
        time: normalizeTime(firstValue(data.createTime, data.timestamp, raw.timestamp, "")),
        _data: data,
        _event: raw
      };

      if (lower === "chat") {
        const emotes = normalizeTikFinityEmotes(data);
        const rawMessage = firstValue(data.comment, data.message, data.text, "");
        const message = emotes.length ? String(rawMessage || "") : normalizeTikTokComment(rawMessage);
        if (!message) return null;

        return {
          ...base,
          kind: "message",
          category: "chatMessages",
          message,
          emotes
        };
      }

      if (lower === "emote") {
        const emotes = normalizeTikFinityEmotes(data);
        if (!emotes.length) return null;
        return {
          ...base,
          kind: "message",
          category: "chatMessages",
          message: emotes.map((emote) => emote.name).join(" "),
          emotes
        };
      }

      if (lower === "gift") {
        const groupId = String(firstValue(data.groupId, "") || "");
        if (groupId && groupId !== "0" && data.repeatEnd === false) return null;

        const giftName = firstValue(data.giftName, data.originalName, data.gift && data.gift.name, "regalo");
        const repeatCount = firstValue(data.repeatCount, data.count, "");
        const diamonds = firstValue(data.diamondCount, data.coins, "");
        const amount = repeatCount ? `${repeatCount}× ${giftName}` : giftName;
        const detail = diamonds ? `${diamonds} diamonds` : firstValue(data.describe, data.label, "");

        return {
          ...base,
          kind: "event",
          category: "gifts",
          eventType: "Gift",
          amount,
          message: detail,
          giftName,
          giftCount: repeatCount,
          giftImageUrl: firstValue(data.giftPictureUrl, data.imageUrl, ""),
          stickerImageUrl: firstValue(data.giftPictureUrl, data.imageUrl, "")
        };
      }

      if (lower === "like") {
        if (!shouldShowTikTokLike(data)) return null;
        return {
          ...base,
          kind: "event",
          category: "likes",
          eventType: "Like",
          amount: firstValue(data.likeCount, "1"),
          message: `${data.__hipeLikeMilestone || 1000} likes totales`
        };
      }

      if (lower === "share") {
        return { ...base, kind: "event", category: "shares", eventType: "Share", amount: "compartió el live", message: "" };
      }

      if (lower === "follow") {
        return { ...base, kind: "event", category: "newFollowers", eventType: "Follow", amount: "", message: "" };
      }

      if (lower === "subscribe") {
        return { ...base, kind: "event", category: "newSubscribers", eventType: "Subscribe", amount: firstValue(data.subMonth, data.months, ""), message: "" };
      }

      return null;
    }

    function handleTikFinityMessage(rawMessage) {
      let parsed = rawMessage;
      try {
        if (typeof rawMessage === "string") parsed = JSON.parse(rawMessage);
      } catch (error) {
        wsLog("tikfinity raw text", rawMessage);
        return;
      }

      const mapped = mapTikFinityPayload(parsed);
      if (!mapped) return;
      wsLog("tikfinity mapped", mapped);
      push(mapped);
    }

    function connectTikFinity(options = {}) {
      CONFIG.tiktok = { ...CONFIG.tiktok, ...options, enabled: true };
      const url = String(options.url || CONFIG.tiktok.url || "ws://localhost:21213/").trim();

      if (tikfinitySocket && tikfinitySocket.readyState === WebSocket.OPEN) return tikfinitySocket;
      clearTimeout(tikfinityReconnectTimer);

      try {
        tikfinitySocket = new WebSocket(url);
      } catch (error) {
        console.warn("[Hipe Multichat TikFinity] No se pudo crear WebSocket:", error);
        scheduleReconnectTikFinity(options);
        return null;
      }

      tikfinitySocket.addEventListener("open", () => wsLog("tikfinity connected", url));
      tikfinitySocket.addEventListener("message", (event) => handleTikFinityMessage(event.data));
      tikfinitySocket.addEventListener("close", () => {
        wsLog("tikfinity closed");
        if (CONFIG.tiktok.reconnect) scheduleReconnectTikFinity(options);
      });
      tikfinitySocket.addEventListener("error", (error) => wsLog("tikfinity error", error));

      return tikfinitySocket;
    }

    function scheduleReconnectTikFinity(options = {}) {
      if (!CONFIG.tiktok.reconnect) return;
      clearTimeout(tikfinityReconnectTimer);
      tikfinityReconnectTimer = setTimeout(() => connectTikFinity(options), CONFIG.tiktok.reconnectDelay);
    }

    function connectStreamerBot(options = {}) {
      CONFIG.websocket = {
        ...CONFIG.websocket,
        ...options,
        enabled: true
      };

      const url = getStreamerBotWsUrl(options);

      if (streamerBotSocket && streamerBotSocket.readyState === WebSocket.OPEN) {
        return streamerBotSocket;
      }

      clearTimeout(reconnectTimer);
      setConnectionState("connecting", "WS CONNECTING");
      wsLog("connecting", url);

      try {
        streamerBotSocket = new WebSocket(url);
      } catch (error) {
        console.warn("[Hipe Multichat WS] No se pudo crear WebSocket:", error);
        setConnectionState("disconnected", "WS ERROR");
        scheduleReconnectStreamerBot(options);
        return null;
      }

      streamerBotSocket.addEventListener("open", () => {
        reconnectAttempts = 0;
        setConnectionState("connected", "WS OK");
        wsLog("connected", url);
        subscribeStreamerBotEvents();
      });

      streamerBotSocket.addEventListener("message", (event) => {
        handleStreamerBotMessage(event.data);
      });

      streamerBotSocket.addEventListener("close", () => {
        setConnectionState("disconnected", "WS OFF");
        wsLog("closed");

        if (CONFIG.websocket.reconnect) {
          scheduleReconnectStreamerBot(options);
        }
      });

      streamerBotSocket.addEventListener("error", (error) => {
        setConnectionState("disconnected", "WS ERROR");
        wsLog("error", error);
      });

      return streamerBotSocket;
    }

    function scheduleReconnectStreamerBot(options = {}) {
      if (!CONFIG.websocket.reconnect) return;

      clearTimeout(reconnectTimer);
      reconnectAttempts += 1;

      reconnectTimer = setTimeout(() => {
        connectStreamerBot(options);
      }, CONFIG.websocket.reconnectDelay);
    }

    function disconnectStreamerBot() {
      CONFIG.websocket.reconnect = false;
      clearTimeout(reconnectTimer);

      if (streamerBotSocket) {
        streamerBotSocket.close();
      }

      streamerBotSocket = null;
      setConnectionState("disconnected", "WS OFF");
    }

    function boolParam(params, name, fallback) {
      if (!params.has(name)) return fallback;
      const value = String(params.get(name)).toLowerCase();
      return value === "1" || value === "true" || value === "yes" || value === "on";
    }

    function applyUrlConfig() {
      const params = new URLSearchParams(window.location.search);

      if (params.has("removeFallback")) {
        CONFIG.removeFallback = params.get("removeFallback") === "1";
      }

      CONFIG.showPlatform = boolParam(params, "showPlatform", CONFIG.showPlatform);
      CONFIG.showAvatar = boolParam(params, "showAvatar", CONFIG.showAvatar);
      CONFIG.showTimestamp = boolParam(params, "showTimestamp", boolParam(params, "showTimestamps", CONFIG.showTimestamp));
      CONFIG.showBadges = boolParam(params, "showBadges", CONFIG.showBadges);
      CONFIG.showPronouns = boolParam(params, "showPronouns", CONFIG.showPronouns);
      CONFIG.showUsername = boolParam(params, "showUsername", CONFIG.showUsername);
      CONFIG.customEmotes = boolParam(params, "customEmotes", CONFIG.customEmotes);
      CONFIG.enlargeEmotes = boolParam(params, "enlargeEmotes", CONFIG.enlargeEmotes);
      CONFIG.gigantifyEmotes = boolParam(params, "gigantifyEmotes", CONFIG.gigantifyEmotes);

      if (params.has("emoteSize")) {
        const size = Number(params.get("emoteSize"));
        if (Number.isFinite(size) && size > 8) {
          CONFIG.emoteSize = size;
          document.documentElement.style.setProperty("--emote-size", size + "px");
        }
      }

      if (params.has("emoteLargeSize")) {
        const size = Number(params.get("emoteLargeSize"));
        if (Number.isFinite(size) && size > 24) {
          CONFIG.emoteLargeSize = size;
          document.documentElement.style.setProperty("--emote-large-size", size + "px");
        }
      }

      applyVisualConfig({
        font: params.get("font") || CONFIG.font,
        fontSize: params.has("fontSize") ? Number(params.get("fontSize")) : CONFIG.fontSize,
        lineSpacing: params.has("lineSpacing") ? Number(params.get("lineSpacing")) : CONFIG.lineSpacing,
        messageSpacing: params.has("messageSpacing") ? Number(params.get("messageSpacing")) : CONFIG.messageSpacing,
        chatBubbles: boolParam(params, "chatBubbles", CONFIG.chatBubbles),
        hideAfter: params.has("hideAfter") ? Number(params.get("hideAfter")) : CONFIG.hideAfter,
        excludeCommands: boolParam(params, "excludeCommands", CONFIG.excludeCommands),
        commandPrefix: params.get("commandPrefix") || CONFIG.commandPrefix,
        ignoreChatters: params.has("ignoreChatters") ? params.get("ignoreChatters") : CONFIG.ignoreChatters,
        scrollDirection: params.get("scrollDirection") || CONFIG.scrollDirection,
        groupConsecutiveMessages: boolParam(params, "groupConsecutiveMessages", CONFIG.groupConsecutiveMessages),
        /* --- Ajuste v119: inlineChat por URL explícito; 1 activa inline y 0 lo desactiva --- */
        inlineChat: params.has("inlineChat")
          ? ["1", "true", "yes", "on"].includes(String(params.get("inlineChat")).toLowerCase())
          : CONFIG.inlineChat,
        highlightMentions: boolParam(params, "highlightMentions", CONFIG.highlightMentions),
        streamerNames: params.get("streamerNames") || CONFIG.streamerNames,
        embedImages: params.get("embedImages") || CONFIG.embedImages,
        showYouTubeLinkPreviews: boolParam(params, "showYouTubeLinkPreviews", CONFIG.showYouTubeLinkPreviews)
      });

      if (params.has("defaultAvatarUrl")) {
        CONFIG.defaultAvatarUrl = params.get("defaultAvatarUrl") || "";
      }

      if (params.has("avatarMap")) {
        try {
          CONFIG.avatarMap = JSON.parse(params.get("avatarMap") || "{}");
        } catch (error) {
          console.warn("[Hipe Multichat] avatarMap inválido", error);
        }
      }

      ["twitch", "youtube", "kick", "tiktok"].forEach((platform) => {
        const prefix = platform + ".";
        params.forEach((value, key) => {
          if (key.startsWith(prefix)) {
            setFilter(platform, key.slice(prefix.length), value === "1" || value === "true" || value === "show-highlight" ? value : (value !== "0" && value !== "false"));
          }
        });
      });

      CONFIG.websocket.debug = boolParam(params, "debugWS", CONFIG.websocket.debug);
      CONFIG.websocket.debugPayload = boolParam(params, "debugPayload", CONFIG.websocket.debugPayload);
      CONFIG.websocket.subscribe = boolParam(params, "subscribe", CONFIG.websocket.subscribe);
      CONFIG.websocket.reconnect = boolParam(params, "reconnect", CONFIG.websocket.reconnect);

      if (params.has("sbHost")) CONFIG.websocket.host = params.get("sbHost");
      if (params.has("sbPort")) CONFIG.websocket.port = Number(params.get("sbPort"));
      if (params.has("wsUrl")) CONFIG.websocket.url = params.get("wsUrl");
      if (params.has("connect")) CONFIG.websocket.enabled = params.get("connect") === "1";
      CONFIG.tiktok.enabled = params.get("tiktok") === "1";
      if (params.has("tfUrl")) CONFIG.tiktok.url = params.get("tfUrl");

      if (params.get("debug") === "1") {
        scene.dataset.debug = "1";
      }

      let nextOpacity = params.has("opacity") ? Number(params.get("opacity")) : CONFIG.canvasOpacity;

      if (
        params.get("transparent") === "1" ||
        params.get("trnsparent") === "1" ||
        params.get("transparente") === "1" ||
        params.get("panel") === "0"
      ) {
        nextOpacity = 0;
      }

      setPanelBackground(params.get("bg") || CONFIG.canvasColor, nextOpacity);

      /* --- Ajuste v100: parámetros para personalizar chatBubbles --- */
      setBubbleStyle(
        params.get("bubbleColor") || params.get("bubbleBg") || "#0a0c14",
        params.has("bubbleOpacity") ? Number(params.get("bubbleOpacity")) : 0.34,
        params.has("bubbleBorderOpacity") ? Number(params.get("bubbleBorderOpacity")) : 0.08
      );

      /* --- Ajuste v109: un solo color de acento controla menciones y detalles visuales del overlay --- */
      setHighlightStyle(params.get("accentColor") || params.get("highlightColor") || params.get("mentionColor") || "#8b5cf6");

      const widthParam = params.has("chatWidth") ? params.get("chatWidth") : params.get("w");
      const offsetXParam = params.has("offsetX") ? params.get("offsetX") : params.get("x");
      const offsetYParam = params.has("offsetY") ? params.get("offsetY") : params.get("y");
      const heightParam = params.get("chatHeight") || params.get("height") || params.get("h");

      setChatLayout({
        width: widthParam ? Number(widthParam) : CONFIG.chatWidth,
        position: params.get("position") || params.get("pos") || CONFIG.chatPosition,
        offsetX: offsetXParam ? Number(offsetXParam) : CONFIG.chatOffsetX,
        offsetY: offsetYParam ? Number(offsetYParam) : CONFIG.chatOffsetY,
        height: heightParam || CONFIG.chatHeight
      });

      if (params.get("scrollTest") === "1") {
        document.documentElement.style.setProperty("--chat-height", "520px");
      }

      setScrollbar(params.get("scroll") || (params.get("stress") === "1" ? "always" : "hidden"));

      if (params.get("loop") === "1") {
        CONFIG.removeFallback = true;
        removeFallbackRows();
        startDemoLoop();
      }

      if (params.get("stress") === "1") {
        CONFIG.removeFallback = true;
        removeFallbackRows();

        const stressMessages = [
          {
            platform: "twitch",
            username: "jsmoctezuma",
            nameColor: "#1e90ff",
            pronouns: "él",
            badges: ["cam", "star", "heart"],
            message: "mensaje corto de prueba"
          },
          {
            platform: "youtube",
            username: "MarianaPlays",
            pronouns: "ella",
            badges: ["heart"],
            message: "mensaje largo para forzar varias líneas y comprobar que el avatar se mantiene centrado respecto al bloque completo del mensaje"
          },
          {
            platform: "twitch",
            username: "UsuarioMuyActivo",
            nameColor: "#34d399",
            pronouns: "elle",
            badges: [],
            message: "mensaje normal con emotes chicos HipeDance HipeDance",
            emotes: [
              { name: "HipeDance", url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'%3E%3Crect width='128' height='128' fill='transparent'/%3E%3Ccircle cx='64' cy='64' r='48' fill='%23ff4fa0'/%3E%3Ccircle cx='48' cy='52' r='8' fill='white'/%3E%3Ccircle cx='80' cy='52' r='8' fill='white'/%3E%3Cpath d='M42 78 Q64 98 86 78' fill='none' stroke='white' stroke-width='8' stroke-linecap='round'/%3E%3C/svg%3E", provider: "demo", pixel: true }
            ]
          }
        ];

        for (let i = 0; i < 26; i += 1) {
          addMessage(stressMessages[i % stressMessages.length]);
        }
      }

      if (params.get("gigantifyTest") === "1") {
        CONFIG.removeFallback = true;
        removeFallbackRows();

        addMessage({
          platform: "twitch",
          username: "jsmoctezuma",
          nameColor: "#1e90ff",
          badges: ["star", "heart"],
          message: "HipeDance HipeDance",
          powerUpType: "gigantify",
          gigantify: true,
          emotes: [
            { name: "HipeDance", url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'%3E%3Crect width='128' height='128' fill='transparent'/%3E%3Ccircle cx='64' cy='64' r='48' fill='%23ff4fa0'/%3E%3Ccircle cx='48' cy='52' r='8' fill='white'/%3E%3Ccircle cx='80' cy='52' r='8' fill='white'/%3E%3Cpath d='M42 78 Q64 98 86 78' fill='none' stroke='white' stroke-width='8' stroke-linecap='round'/%3E%3C/svg%3E", provider: "demo", pixel: true }
          ]
        });
      }

      if (CONFIG.websocket.enabled) {
        connectStreamerBot({
          host: CONFIG.websocket.host,
          port: CONFIG.websocket.port,
          url: CONFIG.websocket.url
        });
      } else {
        setConnectionState("disconnected", "WS OFF");
      }

      if (CONFIG.tiktok.enabled) {
        connectTikFinity({ url: CONFIG.tiktok.url });
      }
    }

    hydrateStaticIcons();
    applyUrlConfig();

    window.HipeMultichat = {
      addMessage,
      addEvent,
      clear: clearChat,
      setPanelBackground,
      setChatLayout,
      setScrollbar,
      startDemoLoop,
      removeFallbackRows,
      push,
      configure,
      normalizeMessagePayload,
      normalizeEventPayload,
      renderMessageContent,
      renderGigantifyContent,
      normalizeEmotes,
      isGigantifyPowerUp,
      applyVisualConfig,
      setFilter,
      setFilters,
      shouldShowPayload,
      connectStreamerBot,
      disconnectStreamerBot,
      connectTikFinity,
      sendStreamerBotRequest,
      handleStreamerBotMessage,
      handleTikFinityMessage,
      mapStreamerBotPayload,
      mapTikFinityPayload,
      config: CONFIG
    };
