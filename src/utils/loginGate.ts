/** Blocks foreground sync while cloud login is writing employee/session rows. */
let loginInProgress = false;

export function setLoginInProgress(value: boolean): void {
  loginInProgress = value;
}

export function isLoginInProgress(): boolean {
  return loginInProgress;
}
