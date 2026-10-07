// A stand-in for the backend's OTP session, with the rules the real one keeps (OtpSessionService and
// OtpChallengeService in users-core-service): five minutes to use a code, three minutes before a resend
// or a channel change, one of each per session, five wrong codes. Messages are the backend's own.

export const DEV_OTP = "515060";
export type OtpChannel = "SMS" | "ZALO";

const TTL_MS = 300_000;
const COOLDOWN_MS = 180_000;
const MAX_ATTEMPTS = 5;

export interface OtpFailure {
  status: number;
  code: string;
  message: string;
  extra?: Record<string, unknown>;
}

export const SESSION_CLOSED: OtpFailure = {
  status: 400, code: "OTP_SESSION_CLOSED", message: "Phiên nhận mã đã kết thúc. Bạn nhận mã mới để tiếp tục nhé.",
};

export class OtpSessionMock {
  private status = "PENDING";
  private channel: string = "SMS";
  private version = 1;
  private sentAt = 0;
  private attempts = 0;
  private resends = 0;
  private channelChanges = 0;

  /**
   * `now` is the clock shared with the page, so countdowns and deadlines agree. `channels` are the ways
   * the code can reach this destination: SMS and Zalo for a phone number, only "EMAIL" for an email.
   */
  constructor(readonly id: string, private readonly masked: string, private readonly now: () => number,
    private readonly channels: readonly string[] = ["SMS", "ZALO"]) {}

  get expiresAt(): string { return new Date(this.sentAt + TTL_MS).toISOString(); }
  get resendAvailableAt(): string { return new Date(this.sentAt + COOLDOWN_MS).toISOString(); }
  private get expired(): boolean { return this.sentAt + TTL_MS <= this.now(); }

  /** A first code, or a brand-new session after the previous one ended. */
  start(channel: string): void {
    this.status = "PENDING";
    this.channel = channel;
    this.version = 1;
    this.sentAt = this.now();
    this.attempts = 0;
    this.resends = 0;
    this.channelChanges = 0;
  }

  /** The body of GET /v1/otp-sessions/{id}. */
  snapshot(): Record<string, unknown> {
    return {
      otp_session_id: this.id, challenge_id: this.id, status: this.status, channel: this.channel,
      masked_destination: this.masked, expires_at: this.expiresAt, resend_available_at: this.resendAvailableAt,
      version: this.version, remaining_attempts: MAX_ATTEMPTS - this.attempts,
      resends_remaining: 1 - this.resends,
      channel_changes_remaining: this.channels.length > 1 ? 1 - this.channelChanges : 0,
      available_channels: this.channels.map((channel) => ({ channel, masked_destination: this.masked })),
    };
  }

  /** POST /v1/otp-sessions/delivery: a resend or a channel change. */
  deliver(body: Record<string, unknown>): Record<string, unknown> | OtpFailure {
    if (this.status !== "PENDING" || this.expired) return SESSION_CLOSED;
    if (body.action === "RESEND") this.resends += 1;
    else { this.channelChanges += 1; this.channel = this.channels.includes(String(body.channel)) ? String(body.channel) : this.channels[0]!; }
    this.version += 1;
    this.sentAt = this.now();
    return this.snapshot();
  }

  /** Null when the code is accepted. */
  verify(code: unknown): OtpFailure | null {
    if (this.status !== "PENDING") return SESSION_CLOSED;
    if (this.expired) return { status: 400, code: "OTP_EXPIRED", message: "Mã OTP không hợp lệ hoặc đã hết hạn." };
    if (code === DEV_OTP) { this.status = "VERIFIED"; return null; }
    this.attempts += 1;
    const remaining = MAX_ATTEMPTS - this.attempts;
    if (remaining === 0) this.status = "BLOCKED";
    return {
      status: 400,
      code: remaining === 0 ? "OTP_ATTEMPTS_EXCEEDED" : "OTP_INCORRECT",
      message: remaining === 0
        ? "Bạn đã nhập sai quá số lần cho phép. Hãy yêu cầu mã OTP mới."
        : `Mã OTP không đúng. Bạn còn ${remaining} lần nhập.`,
      extra: { remaining_attempts: remaining, max_attempts: MAX_ATTEMPTS },
    };
  }
}

export const isFailure = (value: unknown): value is OtpFailure =>
  typeof value === "object" && value !== null && "status" in value && "code" in value && "message" in value;
