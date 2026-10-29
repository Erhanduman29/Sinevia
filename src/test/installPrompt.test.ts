import { describe, it, expect } from 'vitest';
import {
  detectInstallBrowser,
  detectInstallPlatform,
  getInstallSignal,
  promptInstall,
} from '../lib/installPrompt';

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1';
const IPAD_OS_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const ANDROID_CHROME_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const WINDOWS_CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const WINDOWS_EDGE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0';
const WINDOWS_FIREFOX_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0';
const MAC_SAFARI_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

describe('detectInstallPlatform', () => {
  it('iPhone ve iPad UA\'larını iOS olarak tanır', () => {
    expect(detectInstallPlatform(IPHONE_UA)).toBe('ios');
    expect(detectInstallPlatform(IPAD_OS_UA, 5, 'MacIntel')).toBe('ios');
  });

  it('iPadOS masaüstü UA\'sını dokunmatik desteğiyle iOS sayar', () => {
    expect(detectInstallPlatform(IPAD_OS_UA, 0, 'MacIntel')).toBe('desktop');
    expect(detectInstallPlatform(IPAD_OS_UA, 5, 'MacIntel')).toBe('ios');
  });

  it('Android ve masaüstünü ayırır', () => {
    expect(detectInstallPlatform(ANDROID_CHROME_UA)).toBe('android');
    expect(detectInstallPlatform(WINDOWS_CHROME_UA)).toBe('desktop');
    expect(detectInstallPlatform(MAC_SAFARI_UA)).toBe('desktop');
  });
});

describe('detectInstallBrowser', () => {
  it('Safari, Chrome, Edge, Firefox ve Samsung Internet\'i ayırır', () => {
    expect(detectInstallBrowser(IPHONE_UA)).toBe('safari');
    expect(detectInstallBrowser(IPHONE_CHROME_UA)).toBe('chrome');
    expect(detectInstallBrowser(ANDROID_CHROME_UA)).toBe('chrome');
    expect(detectInstallBrowser(WINDOWS_EDGE_UA)).toBe('edge');
    expect(detectInstallBrowser(WINDOWS_FIREFOX_UA)).toBe('firefox');
    expect(
      detectInstallBrowser(
        'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36',
      ),
    ).toBe('samsung');
  });

  it('Edge UA\'sını Chrome sanmaz (Chrome parçası içerse bile)', () => {
    expect(WINDOWS_EDGE_UA).toContain('Chrome');
    expect(detectInstallBrowser(WINDOWS_EDGE_UA)).toBe('edge');
  });
});

describe('getInstallSignal / promptInstall', () => {
  it('sunucu tarafında (window yok) güvenli varsayılan döner', () => {
    const signal = getInstallSignal();
    expect(signal.platform).toBe('desktop');
    expect(signal.installed).toBe(false);
    expect(signal.canPrompt).toBe(false);
  });

  it('yakalanmış kurulum olayı yokken promptInstall "unavailable" döner', async () => {
    await expect(promptInstall()).resolves.toEqual({ ok: false, reason: 'unavailable' });
  });
});
