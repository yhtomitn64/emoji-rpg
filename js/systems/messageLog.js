export const MESSAGE_LOG_CAP = 50;

export function appendMessage(log, text) {
  const next = [...log, text];
  if (next.length > MESSAGE_LOG_CAP) {
    return next.slice(next.length - MESSAGE_LOG_CAP);
  }
  return next;
}
