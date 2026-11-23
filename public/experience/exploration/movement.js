export function createWalkInput(canvas, stick, knob) {
  const keys = new Set();
  let canvasPointer = null;
  let stickPointer = null;
  let lastX=0, lastY=0;
  let dragX = 0;
  let dragY = 0;
  let joyX = 0;
  let joyY = 0;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const length = (x, y) => Math.hypot(x, y) || 1;
  const resetState = () => {
    keys.clear();
    dragX = dragY = joyX = joyY = 0;
    canvasPointer = stickPointer = null;
    if (knob) knob.style.transform = "translate(0px, 0px)";
  };
  const allowedTarget = (target) =>
    target === canvas ||
    target === document.body ||
    (target instanceof Element &&
      !target.closest("form,dialog,button,input,textarea,select,[contenteditable=true]"));

  const onKeyDown = (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || !allowedTarget(event.target)) return;
    const key = event.key.toLowerCase();
    if (["w","a","s","d","z","q","arrowup","arrowdown","arrowleft","arrowright","shift"].includes(key)) {
      keys.add(key);
      event.preventDefault();
    }
  };
  const onKeyUp = (event) => {
    const key = event.key.toLowerCase();
    if (keys.has(key)) keys.delete(key);
  };

  document.addEventListener("keydown", onKeyDown, { passive: false });
  document.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", resetState);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) resetState();
  });

  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", (event) => {
    if (canvasPointer !== null) return;
    canvasPointer = event.pointerId;lastX=event.clientX;lastY=event.clientY;
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerId !== canvasPointer) return;
    dragX = clamp(dragX + (event.clientX-lastX) * 0.003, -1, 1);
    dragY = clamp(dragY - (event.clientY-lastY) * 0.003, -0.7, 0.7);
    lastX=event.clientX;lastY=event.clientY;
    event.preventDefault();
  });
  const endCanvas = (event) => {
    if (event.pointerId === canvasPointer) canvasPointer = null;
  };
  canvas.addEventListener("pointerup", endCanvas);
  canvas.addEventListener("pointercancel", endCanvas);
  canvas.addEventListener("lostpointercapture", endCanvas);

  if (stick) {
    stick.style.touchAction = "none";
    stick.addEventListener("pointerdown", (event) => {
      if (stickPointer !== null) return;
      stickPointer = event.pointerId;
      stick.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    });
    stick.addEventListener("pointermove", (event) => {
      if (event.pointerId !== stickPointer) return;
      const rect = stick.getBoundingClientRect();
      const radius = Math.max(1, rect.width / 2);
      let x = (event.clientX - (rect.left + rect.width / 2)) / radius;
      let y = (event.clientY - (rect.top + rect.height / 2)) / radius;
      const mag = length(x, y);
      if (mag > 1) {
        x /= mag;
        y /= mag;
      }
      joyX = clamp(x, -1, 1);
      joyY = clamp(-y, -1, 1);
      if (knob) knob.style.transform = `translate(${joyX * radius}px, ${-joyY * radius}px)`;
      event.preventDefault();
      event.stopPropagation();
    });
    const endStick = (event) => {
      if (event.pointerId !== stickPointer) return;
      stickPointer = null;
      joyX = joyY = 0;
      if (knob) knob.style.transform = "translate(0px, 0px)";
    };
    stick.addEventListener("pointerup", endStick);
    stick.addEventListener("pointercancel", endStick);
    stick.addEventListener("lostpointercapture", endStick);
  }

  return {
    read(dt) {
      const step = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.20);
      const down = (...names) => names.some((name) => keys.has(name));
      let forward = (down("w", "z", "arrowup") ? 1 : 0) - (down("s", "arrowdown") ? 1 : 0);
      let strafe = (down("d") ? 1 : 0) - (down("a", "q") ? 1 : 0);
      let yaw = (down("arrowright") ? 1 : 0) - (down("arrowleft") ? 1 : 0);
      forward += joyY;
      strafe += joyX;
      const magnitude = length(forward, strafe);
      if (magnitude > 1) {
        forward /= magnitude;
        strafe /= magnitude;
      }
      const result = {
        forward,
        strafe,
        yaw: clamp(yaw * 2.2 * step + dragX, -1, 1),
        pitch: clamp(dragY, -0.7, 0.7),
        run: down("shift")
      };
      dragX = dragY = 0;
      return result;
    },
    reset: resetState,
    dispose() {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", resetState);
      resetState();
    }
  };
}