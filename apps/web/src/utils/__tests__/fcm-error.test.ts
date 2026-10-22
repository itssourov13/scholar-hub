import { describe, expect, test } from "vitest";
import { isPermanentFcmTokenError, isTransientFcmError } from "../fcm-error";

function fcmJson(status: string, message: string, errorCode?: string): string {
  return JSON.stringify({
    error: {
      code: 400,
      status,
      message,
      details: errorCode ? [{ errorCode }] : [],
    },
  });
}

describe("isPermanentFcmTokenError", () => {
  test("404 is always a dead token", () => {
    expect(isPermanentFcmTokenError(404, "")).toBe(true);
  });

  test("UNREGISTERED (uninstall / rotation) is permanent", () => {
    expect(
      isPermanentFcmTokenError(
        404,
        fcmJson("NOT_FOUND", "Requested entity was not found.", "UNREGISTERED"),
      ),
    ).toBe(true);
    expect(
      isPermanentFcmTokenError(
        400,
        fcmJson("NOT_FOUND", "Requested entity was not found.", "UNREGISTERED"),
      ),
    ).toBe(true);
  });

  test("a malformed registration token is permanent", () => {
    expect(
      isPermanentFcmTokenError(
        400,
        fcmJson(
          "INVALID_ARGUMENT",
          "The registration token is not a valid FCM registration token",
          "INVALID_ARGUMENT",
        ),
      ),
    ).toBe(true);
  });

  test("INVALID_ARGUMENT on the payload is NOT a dead token", () => {
    // This is the bug: a bad image URL / data type used to disable every device.
    expect(
      isPermanentFcmTokenError(
        400,
        fcmJson(
          "INVALID_ARGUMENT",
          "Invalid value at 'message.notification.image'",
          "INVALID_ARGUMENT",
        ),
      ),
    ).toBe(false);
    expect(
      isPermanentFcmTokenError(
        400,
        fcmJson("INVALID_ARGUMENT", "Invalid data payload", "INVALID_ARGUMENT"),
      ),
    ).toBe(false);
  });

  test("transient errors are retryable", () => {
    expect(
      isPermanentFcmTokenError(429, fcmJson("RESOURCE_EXHAUSTED", "Quota exceeded")),
    ).toBe(false);
    expect(
      isPermanentFcmTokenError(500, fcmJson("INTERNAL", "Internal error")),
    ).toBe(false);
    expect(isPermanentFcmTokenError(503, "upstream timeout")).toBe(false);
  });

  test("isTransientFcmError matches Google INTERNAL / 5xx and not dead tokens", () => {
    expect(isTransientFcmError(500, fcmJson("INTERNAL", "Internal error occurred.", "INTERNAL"))).toBe(
      true,
    );
    expect(isTransientFcmError(503, "upstream timeout")).toBe(true);
    expect(
      isTransientFcmError(
        404,
        fcmJson("NOT_FOUND", "Requested entity was not found.", "UNREGISTERED"),
      ),
    ).toBe(false);
  });

  test("plain-text UNREGISTERED still matches when JSON parse fails", () => {
    expect(isPermanentFcmTokenError(400, "error: UNREGISTERED")).toBe(true);
  });
});
