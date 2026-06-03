const MIN_REQUIRED_SHOTS = 8;

function shot(title, hint, guide, orientation = "portrait") {
  return { title, hint, guide, orientation };
}

const subjects = {
  office: {
    label: "辦公",
    filePrefix: "office",
    tasks: [
      shot("大樓主視覺", "站到對街或稍遠處，讓整棟建築完整入鏡，注意垂直線不要歪。", "facade", "portrait"),
      shot("45 度外觀", "移到建物斜前方，讓正面與側面都入鏡，拍出立體感。", "perspective", "landscape"),
      shot("入口與招牌", "把入口放在畫面中央，招牌和門口不要被裁切。", "symmetry", "portrait"),
      shot("街道環境", "帶到道路、人行道和鄰近建物，讓看照片的人理解位置感。", "street", "landscape"),
      shot("大廳或門廳", "站在入口中軸線上，讓左右牆面或柱子看起來平衡。", "symmetry", "portrait"),
      shot("立面細節", "靠近拍玻璃、窗格、材質或外牆紋理，補一張有質感的近景。", "detail", "portrait"),
      shot("車道或停車", "用道路線條帶出車輛進出的方向，避免只拍到局部。", "street", "landscape"),
      shot("低角度仰拍", "靠近建築底部往上拍，保留一點天空，呈現高度與氣勢。", "highrise", "portrait")
    ]
  },
  land: {
    label: "土地",
    filePrefix: "land",
    tasks: [
      shot("土地全貌", "站在對面或稍高的位置，把基地和周邊環境一起拍進來。", "land", "landscape"),
      shot("臨路面", "沿著道路方向拍，讓道路寬度、出入口和基地關係清楚。", "street", "landscape"),
      shot("左側邊界", "用畫面左側線條對齊邊界，讓人看得出基地範圍。", "land", "portrait"),
      shot("右側邊界", "換到另一側補拍，和左側照片形成完整對照。", "land", "portrait"),
      shot("由內往外", "站在基地內往道路拍，表現視野、出口和進出感。", "horizon", "landscape"),
      shot("由外往內", "從道路往基地內拍，讓人理解進入基地後看到的空間。", "land", "landscape"),
      shot("周邊環境", "帶到鄰地、建物、景觀或使用狀況，讓照片更有故事。", "horizon", "landscape"),
      shot("地勢高低差", "保持水平線，讓坡度、落差或填土狀況更容易判斷。", "horizon", "landscape")
    ]
  },
  factory: {
    label: "廠房",
    filePrefix: "factory",
    tasks: [
      shot("廠房主外觀", "從正面或斜前方拍，讓建物高度、寬度和入口一起入鏡。", "facade", "landscape"),
      shot("大門與招牌", "把門口放中央，招牌、門牌和出入口動線要清楚。", "symmetry", "portrait"),
      shot("車道動線", "沿著車道拍，表現貨車進出是否順暢。", "street", "landscape"),
      shot("裝卸區或月台", "拍出裝卸位置、遮雨棚、月台高度和貨車停靠空間。", "facade", "landscape"),
      shot("內部大空間", "站在角落或入口往內拍，讓空間深度、寬度和地坪完整呈現。", "wide", "landscape"),
      shot("柱距與挑高", "保持垂直線，讓柱子、天花板和梁的位置清楚。", "wide", "portrait"),
      shot("設備細節", "拍電力、消防、空調、天車或其他關鍵設備，畫面要清楚不晃。", "detail", "portrait"),
      shot("周邊腹地", "拍空地、迴車空間、鄰近道路或擴充區域，呈現使用彈性。", "land", "landscape")
    ]
  }
};

const state = {
  subjectKey: "office",
  taskIndex: 0,
  shots: createShotState("office"),
  stream: null,
  lastPhotoBlob: null,
  lastPhotoUrl: "",
  levelEnabled: false,
  isCameraReady: false,
  shotOrientation: "portrait"
};

const els = {
  appShell: document.querySelector("#appShell"),
  cameraView: document.querySelector("#cameraView"),
  photoCanvas: document.querySelector("#photoCanvas"),
  cameraPlaceholder: document.querySelector("#cameraPlaceholder"),
  cameraStatus: document.querySelector("#cameraStatus"),
  guideOverlay: document.querySelector("#guideOverlay"),
  levelMeter: document.querySelector("#levelMeter"),
  permissionBtn: document.querySelector("#permissionBtn"),
  levelBtn: document.querySelector("#levelBtn"),
  captureBtn: document.querySelector("#captureBtn"),
  prevBtn: document.querySelector("#prevBtn"),
  nextBtn: document.querySelector("#nextBtn"),
  skipBtn: document.querySelector("#skipBtn"),
  progressPill: document.querySelector("#progressPill"),
  taskStep: document.querySelector("#taskStep"),
  taskTitle: document.querySelector("#taskTitle"),
  taskHint: document.querySelector("#taskHint"),
  completionText: document.querySelector("#completionText"),
  subjectName: document.querySelector("#subjectName"),
  progressFill: document.querySelector("#progressFill"),
  shotList: document.querySelector("#shotList"),
  reviewDialog: document.querySelector("#reviewDialog"),
  reviewImage: document.querySelector("#reviewImage"),
  reviewTitle: document.querySelector("#reviewTitle"),
  saveNote: document.querySelector("#saveNote"),
  retakeBtn: document.querySelector("#retakeBtn"),
  saveBtn: document.querySelector("#saveBtn"),
  acceptBtn: document.querySelector("#acceptBtn")
};

document.querySelectorAll(".subject-tab").forEach((button) => {
  button.addEventListener("click", () => switchSubject(button.dataset.subject));
});

document.querySelectorAll(".orientation-tab").forEach((button) => {
  button.addEventListener("click", () => setOrientation(button.dataset.orientation));
});

els.permissionBtn.addEventListener("click", () => startCamera({ auto: false }));
els.levelBtn.addEventListener("click", enableLevel);
els.captureBtn.addEventListener("click", capturePhoto);
els.prevBtn.addEventListener("click", () => moveTask(-1));
els.nextBtn.addEventListener("click", () => moveTask(1));
els.skipBtn.addEventListener("click", skipCurrentTask);
els.saveBtn.addEventListener("click", saveCurrentPhoto);
els.acceptBtn.addEventListener("click", acceptCurrentPhoto);
els.retakeBtn.addEventListener("click", clearLastPhoto);

window.addEventListener("beforeunload", () => {
  if (state.lastPhotoUrl) {
    URL.revokeObjectURL(state.lastPhotoUrl);
  }
  stopCamera();
});

setOrientation(currentTask().orientation);
render();
window.setTimeout(() => startCamera({ auto: true }), 250);

function createShotState(subjectKey) {
  return subjects[subjectKey].tasks.map(() => ({
    status: "pending",
    savedAt: null
  }));
}

function switchSubject(subjectKey) {
  if (!subjects[subjectKey]) {
    return;
  }

  state.subjectKey = subjectKey;
  state.taskIndex = 0;
  state.shots = createShotState(subjectKey);
  clearLastPhoto();
  setOrientation(currentTask().orientation);

  document.querySelectorAll(".subject-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.subject === subjectKey);
  });

  render();
}

async function startCamera({ auto = false } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    const message = "這個瀏覽器不支援網頁相機。請改用手機上的 Chrome、Edge 或 Safari。";
    setCameraStatus(message);
    if (!auto) {
      showMessage(message);
    }
    return;
  }

  try {
    stopCamera();
    state.isCameraReady = false;
    els.permissionBtn.textContent = "開啟中";
    els.cameraPlaceholder.hidden = false;
    setCameraStatus("正在開啟相機，請允許瀏覽器使用鏡頭。");

    state.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: cameraConstraints()
    });

    els.cameraView.srcObject = state.stream;
    els.cameraView.muted = true;
    els.cameraView.playsInline = true;
    await waitForVideoReady(els.cameraView);
    await els.cameraView.play();
    await waitForVideoReady(els.cameraView);

    state.isCameraReady = true;
    els.cameraPlaceholder.hidden = true;
    els.permissionBtn.textContent = "已開";
  } catch (error) {
    const message = auto
      ? "瀏覽器沒有自動開啟相機。請按左上角「相機」重試，並允許鏡頭權限。"
      : "無法開啟相機。請確認瀏覽器已允許相機權限，且網頁是用 HTTPS 開啟。";
    state.isCameraReady = false;
    els.permissionBtn.textContent = "相機";
    els.cameraPlaceholder.hidden = false;
    setCameraStatus(message);
    if (!auto) {
      showMessage(message);
    }
  }
}

function setCameraStatus(message) {
  els.cameraStatus.textContent = message;
}

function cameraConstraints() {
  const isPortrait = state.shotOrientation === "portrait";
  return {
    facingMode: { ideal: "environment" },
    width: { ideal: isPortrait ? 1080 : 1440 },
    height: { ideal: isPortrait ? 1440 : 1080 },
    aspectRatio: { ideal: isPortrait ? 0.75 : 1.333 }
  };
}

function waitForVideoReady(video) {
  if (video.videoWidth > 0 && video.readyState >= 2) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("camera preview timeout"));
    }, 6000);

    const check = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        cleanup();
        resolve();
      }
    };

    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("loadedmetadata", check);
      video.removeEventListener("canplay", check);
    };

    video.addEventListener("loadedmetadata", check);
    video.addEventListener("canplay", check);
    check();
  });
}

function stopCamera() {
  state.isCameraReady = false;
  if (!state.stream) {
    return;
  }

  state.stream.getTracks().forEach((track) => track.stop());
  state.stream = null;
}

async function enableLevel() {
  try {
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission !== "granted") {
        showMessage("沒有取得動作感測權限，水平儀暫時無法使用。");
        return;
      }
    }

    if (!state.levelEnabled) {
      window.addEventListener("deviceorientation", updateLevel);
      state.levelEnabled = true;
    }
    els.levelBtn.textContent = "已開";
    els.levelBtn.classList.add("active");
  } catch (error) {
    showMessage("這個瀏覽器無法開啟水平儀。");
  }
}

function updateLevel(event) {
  const tilt = Number.isFinite(event.gamma) ? event.gamma : 0;
  const clampedTilt = Math.max(-35, Math.min(35, tilt));
  els.levelMeter.style.transform = `translateY(-50%) rotate(${clampedTilt}deg)`;
  els.levelMeter.classList.toggle("level-ok", Math.abs(clampedTilt) < 2);
}

function capturePhoto() {
  if (!state.stream) {
    showMessage("請先開啟相機，再按拍照。");
    return;
  }

  if (!state.isCameraReady || !els.cameraView.videoWidth) {
    showMessage("相機已開啟，但預覽影像還沒出現。請等畫面出現後再拍。");
    return;
  }

  const video = els.cameraView;
  const canvas = els.photoCanvas;
  const width = video.videoWidth;
  const height = video.videoHeight;
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  context.drawImage(video, 0, 0, width, height);

  canvas.toBlob(
    (blob) => {
      if (!blob) {
        showMessage("照片產生失敗，請再拍一次。");
        return;
      }

      if (state.lastPhotoUrl) {
        URL.revokeObjectURL(state.lastPhotoUrl);
      }

      state.lastPhotoBlob = blob;
      state.lastPhotoUrl = URL.createObjectURL(blob);
      els.reviewImage.src = state.lastPhotoUrl;
      els.reviewTitle.textContent = currentTask().title;
      els.saveNote.textContent = "請先儲存到手機，再按已儲存進入下一張。";
      els.reviewDialog.showModal();
    },
    "image/jpeg",
    0.92
  );
}

async function saveCurrentPhoto() {
  if (!state.lastPhotoBlob) {
    return;
  }

  const fileName = buildFileName();
  const file = new File([state.lastPhotoBlob], fileName, { type: "image/jpeg" });

  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({
        files: [file],
        title: currentTask().title,
        text: "請選擇儲存圖片，或分享到你要保存照片的位置。"
      });
      els.saveNote.textContent = "如果你已在系統介面完成儲存，請按已儲存。";
      return;
    } catch (error) {
      if (error.name === "AbortError") {
        els.saveNote.textContent = "你取消了分享。可以再按一次儲存到手機。";
        return;
      }
    }
  }

  const link = document.createElement("a");
  link.href = state.lastPhotoUrl;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  els.saveNote.textContent = "已送出下載。iPhone 可長按預覽圖片，選擇儲存到照片。";
}

function acceptCurrentPhoto() {
  state.shots[state.taskIndex] = {
    status: "done",
    savedAt: new Date().toISOString()
  };
  clearLastPhoto();
  moveToNextPendingTask();
  render();
}

function clearLastPhoto() {
  if (state.lastPhotoUrl) {
    URL.revokeObjectURL(state.lastPhotoUrl);
  }
  state.lastPhotoBlob = null;
  state.lastPhotoUrl = "";
  els.reviewImage.removeAttribute("src");
}

function skipCurrentTask() {
  if (state.shots[state.taskIndex].status === "done") {
    moveTask(1);
    return;
  }

  state.shots[state.taskIndex] = {
    status: "skipped",
    savedAt: null
  };
  moveToNextPendingTask();
  render();
}

function moveTask(direction) {
  const total = currentSubject().tasks.length;
  state.taskIndex = (state.taskIndex + direction + total) % total;
  setOrientation(currentTask().orientation);
  render();
}

function moveToNextPendingTask() {
  const total = currentSubject().tasks.length;
  for (let offset = 1; offset <= total; offset += 1) {
    const nextIndex = (state.taskIndex + offset) % total;
    if (state.shots[nextIndex].status !== "done") {
      state.taskIndex = nextIndex;
      setOrientation(currentTask().orientation);
      return;
    }
  }
}

function setOrientation(orientation) {
  const nextOrientation = orientation === "landscape" ? "landscape" : "portrait";
  state.shotOrientation = nextOrientation;
  els.appShell.dataset.orientation = nextOrientation;

  document.querySelectorAll(".orientation-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.orientation === nextOrientation);
  });
}

function orientationLabel(orientation) {
  return orientation === "landscape" ? "橫拍" : "直拍";
}

function currentSubject() {
  return subjects[state.subjectKey];
}

function currentTask() {
  return currentSubject().tasks[state.taskIndex];
}

function completedCount() {
  return state.shots.filter((shot) => shot.status === "done").length;
}

function render() {
  const subject = currentSubject();
  const task = currentTask();
  const done = completedCount();
  const total = subject.tasks.length;

  els.progressPill.textContent = `${done} / ${total}`;
  els.taskStep.textContent = `第 ${state.taskIndex + 1} 張 · 建議${orientationLabel(task.orientation)}`;
  els.taskTitle.textContent = task.title;
  els.taskHint.textContent = task.hint;
  els.subjectName.textContent = subject.label;
  els.completionText.textContent = done >= MIN_REQUIRED_SHOTS
    ? `已完成 ${done} 張，這組照片已達標`
    : `已完成 ${done} 張，建議至少 ${MIN_REQUIRED_SHOTS} 張`;
  els.progressFill.style.width = `${Math.round((done / total) * 100)}%`;
  els.guideOverlay.dataset.guide = task.guide;

  renderShotList();
}

function renderShotList() {
  const subject = currentSubject();
  els.shotList.innerHTML = "";

  subject.tasks.forEach((task, index) => {
    const shot = state.shots[index];
    const item = document.createElement("button");
    item.type = "button";
    item.className = "shot-item";
    item.classList.toggle("active", index === state.taskIndex);
    item.classList.toggle("done", shot.status === "done");
    item.addEventListener("click", () => {
      state.taskIndex = index;
      setOrientation(currentTask().orientation);
      render();
    });

    const statusText = shot.status === "done" ? "完成" : shot.status === "skipped" ? "略過" : "待拍";

    item.innerHTML = `
      <span class="shot-index">${index + 1}</span>
      <span class="shot-copy">
        <strong>${task.title}</strong>
        <span>${orientationLabel(task.orientation)}</span>
      </span>
      <span class="shot-state">${statusText}</span>
    `;
    els.shotList.append(item);
  });
}

function buildFileName() {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0")
  ].join("");
  const index = String(state.taskIndex + 1).padStart(2, "0");
  return `${currentSubject().filePrefix}_${index}_${stamp}.jpg`;
}

function showMessage(message) {
  els.saveNote.textContent = message;
  if (!els.reviewDialog.open) {
    alert(message);
  }
}
