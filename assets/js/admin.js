    const $ = (id) => document.getElementById(id);
    const LS_KEY = "hipeMultichatAdmin.v25";
    function getOverlayBase(options = {}){
      const mode = options.mode === "vertical" ? "vertical" : "horizontal";
      const file = mode === "vertical" ? "vertical.html" : "horizontal.html";

      // Para vista previa interna basta la ruta corta.
      // Para copiar a OBS usamos URL completa calculada desde donde esté abierto admin.html.
      // PC local: file:///.../horizontal.html o vertical.html
      // Hosting: https://.../horizontal.html o vertical.html
      if (options.absolute) {
        return new URL(file, window.location.href).href;
      }
      return file;
    }

    const fields = [
      "font","fontSize","emoteSize","emoteLargeSize","messageSpacing","accentColor","bg","opacity","hideAfter","sbHost","sbPort",
      "showAvatar","showBadges","showTimestamp","showPlatform","inlineChat","groupConsecutiveMessages",
      "highlightMentions","chatBubbles","showCommands",
      "ignoreChatters",
      "twChat","twFollows","twSubs","twCheers","twRaids","twRewards","twStreaks","twAnnouncements","twChatState",
      "ytChat","ytSuperChats","ytSuperStickers","ytGifts","ytMemberships",
      "kickChat","kickFollows","kickSubs","kickRewards","kickGifts",
      "ttEnabled","ttChat","ttGifts","ttLikes","ttShares","ttSocial"
    ];

    function bool(id){ return $(id).checked ? "1" : "0"; }
    function enc(value){ return encodeURIComponent(String(value || "")); }
    function positiveNumber(id, fallback = 0){
      const value = Number($(id)?.value);
      return Number.isFinite(value) && value >= 0 ? String(value) : String(fallback);
    }
    function streamerBotHost(){
      return String($("sbHost")?.value || "").trim() || "127.0.0.1";
    }
    function streamerBotPort(){
      const value = Number($("sbPort")?.value);
      return Number.isFinite(value) && value > 0 && value <= 65535 ? String(Math.round(value)) : "8080";
    }

    function selectedOverlayMode(){
      return $("chatTypeVertical").checked ? "vertical" : "horizontal";
    }

    function buildUrl(overrides = {}){
      const mode = overrides.forceHorizontal === true ? "horizontal" : (overrides.mode || selectedOverlayMode());
      const modeScroll = overrides.scroll || "hidden";
      const showCommands = $("showCommands").checked;
      const overlayOpacity = overrides.opacity ?? $("opacity").value;
      const params = [
        ["connect", "1"],
        ["bg", $("bg").value],
        ["opacity", overlayOpacity],
        ["font", $("font").value],
        ["fontSize", $("fontSize").value],
        ["emoteSize", positiveNumber("emoteSize", 28)],
        ["emoteLargeSize", positiveNumber("emoteLargeSize", 220)],
        ["messageSpacing", $("messageSpacing").value],
        ["hideAfter", positiveNumber("hideAfter", 0)],
        ["sbHost", streamerBotHost()],
        ["sbPort", streamerBotPort()],
        ["accentColor", $("accentColor").value],
        ["scroll", modeScroll],
        ["showAvatar", bool("showAvatar")],
        ["showBadges", bool("showBadges")],
        ["showTimestamp", bool("showTimestamp")],
        ["showPlatform", bool("showPlatform")],
        ["inlineChat", bool("inlineChat")],
        ["groupConsecutiveMessages", bool("groupConsecutiveMessages")],
        ["highlightMentions", bool("highlightMentions")],
        // Siempre activo: no se expone como opción porque las previews útiles deben mostrarse por default.
        ["showYouTubeLinkPreviews", "1"],
        ["chatBubbles", bool("chatBubbles")],
        ["excludeCommands", showCommands ? "0" : "1"],
        ["ignoreChatters", $("ignoreChatters").value],
        ["twitch.chatMessages", bool("twChat")],
        ["twitch.newFollowers", bool("twFollows")],
        ["twitch.newSubscribers", bool("twSubs")],
        ["twitch.cheers", bool("twCheers")],
        ["twitch.raids", bool("twRaids")],
        ["twitch.channelPointRedemptions", bool("twRewards")],
        ["twitch.watchStreaks", bool("twStreaks")],
        ["twitch.announcements", bool("twAnnouncements")],
        ["twitch.chatState", bool("twChatState")],
        ["youtube.chatMessages", bool("ytChat")],
        ["youtube.superChats", bool("ytSuperChats")],
        ["youtube.superStickers", bool("ytSuperStickers")],
        ["youtube.gifts", bool("ytGifts")],
        ["youtube.memberships", bool("ytMemberships")],
        ["kick.chatMessages", bool("kickChat")],
        ["kick.newFollowers", bool("kickFollows")],
        ["kick.newSubscribers", bool("kickSubs")],
        ["kick.channelPointRedemptions", bool("kickRewards")],
        ["kick.gifts", bool("kickGifts")],
        ["tiktok", bool("ttEnabled")],
        ["tiktok.chatMessages", bool("ttChat")],
        ["tiktok.gifts", bool("ttGifts")],
        ["tiktok.likes", bool("ttLikes")],
        ["tiktok.shares", bool("ttShares")],
        ["tiktok.newFollowers", bool("ttSocial")],
        ["tiktok.newSubscribers", bool("ttSocial")]
      ];

      if (mode === "vertical") {
        const verticalHiddenParams = new Set([
          "chatBubbles",
          "inlineChat",
          "messageSpacing",
          "showYouTubeLinkPreviews",
          "scroll"
        ]);

        for (let i = params.length - 1; i >= 0; i--) {
          if (verticalHiddenParams.has(params[i][0])) params.splice(i, 1);
        }
      }

      const base = overrides.forceHorizontalPreview
        ? "horizontal.html"
        : getOverlayBase({ mode, absolute: overrides.absolute === true });
      return base + "?" + params.map(([k,v]) => `${encodeURIComponent(k)}=${enc(v)}`).join("&");
    }

    function toast(text, type = "success"){
      const box = $("toast");
      const icon = $("toastIcon").querySelector("iconify-icon");

      box.classList.remove("show", "warning", "info");
      if (type === "warning") box.classList.add("warning");
      if (type === "info") box.classList.add("info");

      const icons = {
        success: "solar:check-circle-bold-duotone",
        warning: "solar:danger-triangle-bold-duotone",
        info: "solar:info-circle-bold-duotone"
      };

      icon.setAttribute("icon", icons[type] || icons.success);
      $("toastText").textContent = text;

      // Reinicia la animación aunque se dispare varias veces seguido.
      void box.offsetWidth;
      box.classList.add("show");

      clearTimeout(toast.timer);
      toast.timer = setTimeout(() => {
        box.classList.remove("show", "warning", "info");
      }, 3000);
    }

    async function copyText(text, label = "URL"){
      try{
        await navigator.clipboard.writeText(text);
        toast(`${label} copiado al portapapeles`, "success");
      }catch(error){
        toast("No se pudo copiar. Revisa los permisos del navegador.", "warning");
      }
    }

    function save(){
      const data = {};
      fields.forEach(id => {
        const el = $(id);
        data[id] = el.type === "checkbox" ? el.checked : el.value;
      });
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    }

    function load(){
      try{
        const data = JSON.parse(localStorage.getItem(LS_KEY) || "{}");

        Object.entries(data).forEach(([id, value]) => {
          const el = $(id);
          if (!el) return;
          if (el.type === "checkbox") el.checked = Boolean(value);
          else if (el.type !== "radio") el.value = value;
        });
      }catch(error){
        console.warn("No se pudo cargar configuración previa", error);
      }

      // El Admin siempre abre por default en Horizontal.
      // Vertical queda disponible para generar su link, pero no se guarda como estado inicial.
      $("chatTypeHorizontal").checked = true;
      $("chatTypeVertical").checked = false;
    }

    function updatePreview(){
      clearTimeout(updatePreview.timer);
      updatePreview.timer = setTimeout(() => {
        $("livePreview").src = buildUrl();
      }, 240);
    }

    function update(){
      if (Number($("hideAfter").value) < 0 || !String($("hideAfter").value).trim()) $("hideAfter").value = "0";
      if (!Number.isFinite(Number($("emoteSize").value)) || Number($("emoteSize").value) < 12) $("emoteSize").value = "28";
      if (!Number.isFinite(Number($("emoteLargeSize").value)) || Number($("emoteLargeSize").value) < 48) $("emoteLargeSize").value = "220";
      if (!String($("sbHost").value).trim()) $("sbHost").value = "127.0.0.1";
      if (!Number.isFinite(Number($("sbPort").value)) || Number($("sbPort").value) <= 0) $("sbPort").value = "8080";
      document.documentElement.style.setProperty("--accent", $("accentColor").value);
      $("opacityValue").textContent = Math.round(Number($("opacity").value) * 100) + "%";
      updatePreview();
      save();
    }

    function setRowVisibility(inputId, visible){
      const el = $(inputId);
      const row = el && el.closest(".switch-row");
      if (row) row.style.display = visible ? "" : "none";
    }

    function setFieldVisibility(inputId, visible){
      const el = $(inputId);
      const field = el && el.closest(".field");
      if (field) field.style.display = visible ? "" : "none";
    }

    function applyModeVisibility(){
      const isVertical = $("chatTypeVertical").checked;
      const frameTitle = document.querySelector(".frame-head strong");
      const frameSub = document.querySelector(".frame-head span");

      if (frameTitle) frameTitle.textContent = isVertical ? "Preview vertical" : "Preview horizontal";
      if (frameSub) frameSub.textContent = isVertical ? "Base vertical actual" : "Base horizontal actual";

      // Ocultar solo en UI de Vertical. No se eliminan del HTML ni de fields.
      // Al volver a Horizontal reaparecen con su valor intacto.
      setRowVisibility("chatBubbles", !isVertical);
      setRowVisibility("inlineChat", !isVertical);
      setFieldVisibility("messageSpacing", !isVertical);
    }

    function handleChatTypeChange(){
      applyModeVisibility();
      update();
    }

    $("copyObsBtnRight").addEventListener("click", () => copyText(buildUrl({ scroll: "hidden", absolute: true }), "URL para OBS"));
    // NO TOCAR: el panel/dock siempre usa horizontal.html.
    // Aunque selecciones Vertical, este botón no cambia.
    $("copyDockBtnTop").addEventListener("click", () => copyText(buildUrl({ forceHorizontal: true, scroll: "hover", opacity: "1", absolute: true }), "URL para panel"));

    $("chatTypeHorizontal").addEventListener("change", handleChatTypeChange);
    $("chatTypeVertical").addEventListener("change", handleChatTypeChange);

    fields.forEach(id => {
      const el = $(id);
      el.addEventListener("input", update);
      el.addEventListener("change", update);
    });

    $("chatTypeHorizontal").checked = true;
    $("chatTypeVertical").checked = false;
    load();
    applyModeVisibility();
    update();
