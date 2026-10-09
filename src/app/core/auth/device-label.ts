const MAX_LABEL_LENGTH = 60;

// Order matters: Edge and Opera also say Chrome, and Chrome also says Safari.
const BROWSERS: ReadonlyArray<[RegExp, string]> = [
  [/Edg(e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari']
];

// iPad and iPhone come before Mac because an iPad can describe itself as a Mac.
const SYSTEMS: ReadonlyArray<[RegExp, string]> = [
  [/iPhone|iPod/, 'iPhone'],
  [/iPad/, 'iPad'],
  [/Android/, 'Android'],
  [/Windows/, 'Windows'],
  [/CrOS/, 'ChromeOS'],
  [/Macintosh|Mac OS X/, 'Mac'],
  [/Linux/, 'Linux']
];

function firstMatch(userAgent: string, table: ReadonlyArray<[RegExp, string]>): string | null {
  return table.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null;
}

/**
 * A short label for this device, such as "Chrome on Windows", that the devices list shows.
 * It is made from fixed names only, so nothing from the user agent string reaches the server as is.
 */
export function deviceLabelFrom(userAgent: string | null | undefined): string {
  const agent = userAgent ?? '';
  const browser = firstMatch(agent, BROWSERS);
  const system = firstMatch(agent, SYSTEMS);
  const label = browser && system ? `${browser} on ${system}` : browser ?? (system ? `Browser on ${system}` : 'Web browser');
  return label.slice(0, MAX_LABEL_LENGTH);
}

export function currentDeviceLabel(): string {
  return deviceLabelFrom(typeof navigator === 'undefined' ? '' : navigator.userAgent);
}
