export function buildCameraConstraints(deviceId = undefined) {
  const baseConstraints = {
    width: { ideal: 1280, max: 1280 },
    height: { ideal: 720, max: 720 },
    frameRate: { ideal: 30, max: 60 }
  };

  const constraints = {
    video: {
      ...baseConstraints,
      ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" })
    }
  };

  return constraints;
}
