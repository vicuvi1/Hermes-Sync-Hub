import { Notification } from 'electron';

export function sendDesktopNotification(
  title: string,
  body: string,
  onClick?: () => void
): boolean {
  if (!Notification.isSupported()) {
    return false;
  }

  try {
    const notification = new Notification({
      title,
      body,
      silent: false,
    });

    if (onClick) {
      notification.on('click', onClick);
    }

    notification.show();
    return true;
  } catch (err) {
    console.warn('Failed to display desktop notification:', err);
    return false;
  }
}
